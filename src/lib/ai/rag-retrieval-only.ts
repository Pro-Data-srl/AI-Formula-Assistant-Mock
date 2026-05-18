/**
 * RAG retrieval loop (plan → retrieve → check) without a final answer model.
 * Used by the {@code retrieveFormulaContext} tool inside the tool-coordinator LLM.
 *
 * @author Lukas Alber
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { getLangChainChatModelForStructuredOutput, LLMUseCases } from "@/lib/ai/llm-config";
import {
  RAG_PLAN_SYSTEM,
  RAG_CHECK_SYSTEM,
  buildRagPlanUserMessage,
  buildRagCheckUserMessage,
} from "@/lib/ai/prompting";
import type { RetrievedFormulaDoc } from "@/lib/rag/retriever";
import { retrieveFormulaDocsForQueries } from "@/lib/rag/retriever";

const PlanOutputSchema = z.object({
  reasoning: z.string(),
  queries: z.array(z.string()).max(10),
});

const CheckOutputSchema = z.object({
  reasoning: z.string(),
  sufficient: z.boolean(),
});

const planCheckModel = getLangChainChatModelForStructuredOutput(LLMUseCases.AGENTIC_RAG);
const planModel = planCheckModel.withStructuredOutput(PlanOutputSchema);
const checkModel = planCheckModel.withStructuredOutput(CheckOutputSchema);

export type RagRetrievalChatMessage = { role: string; content: string };

export type RagRetrievalHooks = {
  onStatus?: (phase: "planning" | "retrieving" | "evaluating") => void;
};

function formatChatHistoryForContext(msgs: RagRetrievalChatMessage[]): string {
  if (msgs.length === 0) return "";
  return msgs
    .map((m) => `${m.role === "user" ? "Nutzer" : "Assistent"}: ${m.content}`)
    .join("\n\n");
}

function getLastUserMessage(messages: RagRetrievalChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return String(messages[i].content ?? "");
  }
  return "";
}

/**
 * Runs up to two retrieval rounds (plan → retrieve → check) until the check model
 * marks the bundle sufficient or the round cap is reached.
 */
export async function runRagRetrievalOnly(
  input: {
    messages: RagRetrievalChatMessage[];
    currentFormula: string;
    /** Optional focus line from the coordinator LLM (high-level, no tool jargon). */
    coordinatorFocus?: string;
  },
  hooks?: RagRetrievalHooks
): Promise<{ retrievedDocs: RetrievedFormulaDoc[]; fulfilled: boolean }> {
  const userMessage = getLastUserMessage(input.messages ?? []);
  let plannedQueries: string[] = [];
  let retrievedDocs: RetrievedFormulaDoc[] = [];
  let retrievalRound = 0;
  let checkFeedback = "";
  let fulfilled = false;

  while (!fulfilled && retrievalRound < 2) {
    hooks?.onStatus?.("planning");
    const history = formatChatHistoryForContext(input.messages ?? []);
    const currentPart =
      userMessage + (input.currentFormula ? `\nAktuelle Formel: ${input.currentFormula}` : "");
    let basePart = history
      ? `Bisheriger Verlauf:\n${history}\n\n---\nAktuelle Frage:\n${currentPart}`
      : currentPart;
    if (input.coordinatorFocus?.trim()) {
      basePart = `${basePart}\n\n---\nFokus vom Koordinator (ohne Werkzeug-Details):\n${input.coordinatorFocus.trim()}`;
    }
    const text = buildRagPlanUserMessage(basePart, {
      checkFeedback: checkFeedback || undefined,
    });

    try {
      const result = await planModel.invoke([
        new SystemMessage(RAG_PLAN_SYSTEM),
        new HumanMessage(text),
      ]);
      plannedQueries = result.queries;
    } catch {
      plannedQueries = [userMessage.slice(0, 80)].filter(Boolean);
    }

    hooks?.onStatus?.("retrieving");
    const queries = plannedQueries.length > 0 ? plannedQueries : [userMessage];
    const docs = await retrieveFormulaDocsForQueries(queries, { topKPerQuery: 5 });
    retrievalRound += 1;
    retrievedDocs = retrievalRound > 1 ? [...retrievedDocs, ...docs] : docs;

    hooks?.onStatus?.("evaluating");
    if (retrievedDocs.length === 0) {
      fulfilled = true;
      break;
    }
    const contextSnippet = retrievedDocs
      .map(
        (d) =>
          `${d.name}: ${d.signature} — ${d.content}${d.example ? ` (Beispiel: ${d.example})` : ""}`
      )
      .join("\n---\n");
    const checkContent = buildRagCheckUserMessage(input.messages ?? [], contextSnippet);
    const checkResult = await checkModel.invoke([
      new SystemMessage(RAG_CHECK_SYSTEM),
      new HumanMessage(checkContent),
    ]);
    fulfilled = checkResult.sufficient;
    checkFeedback = checkResult.sufficient ? "" : checkResult.reasoning;
  }

  return { retrievedDocs, fulfilled };
}
