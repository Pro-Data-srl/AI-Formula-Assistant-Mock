/**
 * Tool-coordinator LLM: selects and runs tools (including RAG retrieval loop as one tool),
 * then returns a digest for the planning coordinator, or a human-in-the-loop question from askClarification.
 *
 * @author Lukas Alber
 */

import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  isAIMessage,
  isToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { z } from "zod";
import { getLangChainChatModel, LLMUseCases } from "@/lib/ai/llm-config";
import { langchainMessageContentToText } from "@/lib/ai/langchain-message-content";
import { TOOL_COORDINATOR_SYSTEM, TOOL_DIGEST_SYSTEM } from "@/lib/ai/prompting/tool-coordinator";
import {
  validateFormulaTool,
  evaluateFormulaTool,
  askClarificationTool,
  ASK_CLARIFICATION_TOOL_NAME,
} from "@/lib/ai/tools";
import { runRagRetrievalOnly, type RagRetrievalChatMessage } from "@/lib/ai/rag-retrieval-only";
import { LangChainToolStatusCallback } from "@/lib/ai/langchain-tool-status-callback";

export type ToolCoordinatorPhaseStatus =
  | "thinking"
  | "planning"
  | "retrieving"
  | "evaluating"
  | "validating"
  | "digesting"
  | "clarifying";

export type ToolCoordinatorPhaseConfig = {
  onStatus?: (status: ToolCoordinatorPhaseStatus) => void;
};

export type ToolCoordinatorPhaseResult =
  | { kind: "digest"; text: string }
  | { kind: "hitl"; question: string };

const TOOL_TO_STATUS: Record<string, ToolCoordinatorPhaseStatus> = {
  retrieveFormulaContext: "retrieving",
  validateFormula: "validating",
  evaluateFormula: "evaluating",
  askClarification: "clarifying",
};

const MAX_AGENT_STEPS = 12;

function formatChatTail(messages: RagRetrievalChatMessage[], maxChars = 4000): string {
  const flat = messages
    .map((m) => `${m.role}: ${String(m.content ?? "").slice(0, 2000)}`)
    .join("\n---\n");
  return flat.length > maxChars ? `${flat.slice(0, maxChars)}\n…` : flat;
}

/**
 * Builds the LangChain tool that wraps {@link runRagRetrievalOnly} for the tool coordinator.
 */
function createRetrieveFormulaContextTool(ctx: {
  messages: RagRetrievalChatMessage[];
  currentFormula: string;
  onRagPhase: (phase: "planning" | "retrieving" | "evaluating") => void;
}) {
  return tool(
    async ({ goal }: { goal: string }) => {
      const { retrievedDocs, fulfilled } = await runRagRetrievalOnly(
        {
          messages: ctx.messages,
          currentFormula: ctx.currentFormula,
          coordinatorFocus: goal,
        },
        {
          onStatus: (phase) => {
            ctx.onRagPhase(phase);
          },
        }
      );
      const lines = retrievedDocs
        .map((d) => `- ${d.name}: ${d.signature} — ${d.content.slice(0, 240)}${d.content.length > 240 ? "…" : ""}`)
        .join("\n");
      return `Ziel (goal): ${goal}\nAusreichend (Check): ${fulfilled ? "ja" : "nein"}\nTreffer: ${retrievedDocs.length}\nAuszug:\n${lines || "(keine Treffer)"}`;
    },
    {
      name: "retrieveFormulaContext",
      description:
        "Lädt relevante Funktionsdokumentation per semantischer Suche (intern: planen → abrufen → prüfen bis ausreichend oder Rundenlimit). Nutze goal als kurze Zielbeschreibung.",
      schema: z.object({
        goal: z.string().describe("Was für Doku/Funktionen benötigt werden (Deutsch, präzise)"),
      }),
    }
  );
}

const toolCoordinatorModel = getLangChainChatModel(LLMUseCases.TOOL_COORDINATOR);
const digestModel = getLangChainChatModel(LLMUseCases.TOOL_COORDINATOR);

async function runDigestPass(messages: BaseMessage[]): Promise<string> {
  const tail = messages.slice(-24);
  const text = tail
    .map((m) => {
      const role = m._getType();
      const body = langchainMessageContentToText(m.content);
      return `${role}: ${body}`;
    })
    .join("\n\n---\n\n");
  const res = await digestModel.invoke([
    new SystemMessage(TOOL_DIGEST_SYSTEM),
    new HumanMessage(`Unterhaltungsausschnitt (Werkzeugläufe):\n\n${text.slice(0, 12000)}`),
  ]);
  return langchainMessageContentToText(res.content).trim() || "(Keine Zusammenfassung erzeugt.)";
}

/**
 * Runs the tool-coordinator LLM loop. Stops immediately when {@code askClarification} was executed (HITL).
 */
export async function runToolCoordinatorPhase(input: {
  capabilityBrief: string;
  messages: RagRetrievalChatMessage[];
  currentFormula: string;
  options?: ToolCoordinatorPhaseConfig;
}): Promise<ToolCoordinatorPhaseResult> {
  const { capabilityBrief, messages, currentFormula, options } = input;
  const onStatus = options?.onStatus;

  const retrieveTool = createRetrieveFormulaContextTool({
    messages,
    currentFormula,
    onRagPhase: (phase) => onStatus?.(phase),
  });

  const tools = [retrieveTool, validateFormulaTool, evaluateFormulaTool, askClarificationTool];
  const toolNode = new ToolNode(tools);
  const modelWithTools = toolCoordinatorModel.bindTools!(tools);

  const thread: BaseMessage[] = [
    new SystemMessage(TOOL_COORDINATOR_SYSTEM),
    new HumanMessage(
      `Auftrag vom Planungs-Koordinator:\n${capabilityBrief}\n\nChat-Kontext (Auszug):\n${formatChatTail(messages)}`
    ),
  ];

  const callbacks: BaseCallbackHandler[] = onStatus
    ? [new LangChainToolStatusCallback<ToolCoordinatorPhaseStatus>(onStatus, TOOL_TO_STATUS)]
    : [];

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    onStatus?.("thinking");
    const ai = await modelWithTools.invoke(thread, callbacks.length ? { callbacks } : undefined);
    thread.push(ai);
    if (!isAIMessage(ai) || !ai.tool_calls?.length) {
      const direct = langchainMessageContentToText(ai.content).trim();
      if (direct.length > 0) return { kind: "digest", text: direct };
      onStatus?.("digesting");
      return { kind: "digest", text: await runDigestPass(thread) };
    }
    const toolOut = await toolNode.invoke({ messages: [ai] });
    const extra = toolOut.messages ?? [];
    thread.push(...extra);
    for (const tm of extra) {
      if (isToolMessage(tm) && tm.name === ASK_CLARIFICATION_TOOL_NAME) {
        const q = typeof tm.content === "string" ? tm.content : "";
        return { kind: "hitl", question: q.trim() || "Könnten Sie bitte präzisieren?" };
      }
    }
  }

  onStatus?.("digesting");
  return { kind: "digest", text: await runDigestPass(thread) };
}
