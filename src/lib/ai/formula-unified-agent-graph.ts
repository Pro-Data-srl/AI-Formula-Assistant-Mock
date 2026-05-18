/**
 * Unified formula agent: planning coordinator LLM (no tools) + tool-coordinator LLM (tools)
 * + deterministic validate/evaluate gate before streaming polish.
 *
 * @author Lukas Alber
 */

import { z } from "zod";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  getLangChainChatModel,
  getLangChainChatModelForStructuredOutput,
  LLMUseCases,
} from "@/lib/ai/llm-config";
import { UNIFIED_COORDINATOR_SYSTEM } from "@/lib/ai/prompting/unified-coordinator";
import { buildClarificationAnswerSystemPrompt } from "@/lib/ai/prompting/clarification-answer";
import { runToolCoordinatorPhase } from "@/lib/ai/tool-coordinator-phase";
import type { ToolCoordinatorPhaseStatus } from "@/lib/ai/tool-coordinator-phase";
import { langchainMessageContentToText } from "@/lib/ai/langchain-message-content";
import { validateFormula, evaluateFormula } from "@/lib/formula-executor";
import { FUNCTION_NAMES_SET } from "@/lib/formula-functions/registry";
import {
  MOCK_FIELDS,
  getMockFieldValues,
  getMockCollections,
  getMockSessionValues,
  getMockMemUserValues,
} from "@/data/fields";

/** Phases surfaced to the client for the graph agent (unified pipeline). */
export type UnifiedFormulaAgentStatus =
  | "thinking"
  | "coordinating"
  | "planning"
  | "retrieving"
  | "evaluating"
  | "validating"
  | "digesting"
  | "answering"
  | "clarifying";

export type UnifiedChatMessage = { role: string; content: string };

const CoordinatorDecision = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("use_capabilities"),
    capability_brief: z.string().min(1),
  }),
  z.object({
    step: z.literal("finalize"),
    draft_markdown: z.string().min(1),
    formula_candidate: z.string().optional(),
  }),
]);

type CoordinatorDecisionType = z.infer<typeof CoordinatorDecision>;

const KNOWN_FIELD_NAMES = new Set(MOCK_FIELDS.map((f) => f.internalName));

const MAX_COORDINATOR_ROUNDS = 10;

function toBaseMessages(msgs: UnifiedChatMessage[]): BaseMessage[] {
  return msgs.map((m) => {
    const content = String(m.content ?? "");
    if (m.role === "assistant") return new AIMessage(content);
    if (m.role === "system") return new SystemMessage(content);
    return new HumanMessage(content);
  });
}

function extractFormulaFromMarkdown(md: string): string | undefined {
  const fence = md.match(/```(?:[a-zA-Z]*)?\s*([\s\S]*?)```/);
  if (!fence?.[1]) return undefined;
  const inner = fence[1].trim();
  return inner.length > 0 ? inner : undefined;
}

function runDeterministicReview(
  formula: string | undefined
): { ok: true } | { ok: false; diagnosis: string } {
  const f = formula?.trim();
  if (!f) return { ok: true };
  const v = validateFormula(f, {
    knownFunctionNames: FUNCTION_NAMES_SET,
    knownFieldInternalNames: KNOWN_FIELD_NAMES,
  });
  if (v) {
    return {
      ok: false,
      diagnosis: `Validierung fehlgeschlagen: ${v.message}${v.start != null ? ` (Zeichen ${v.start + 1})` : ""}`,
    };
  }
  const e = evaluateFormula(f, {
    fieldValues: getMockFieldValues(),
    collections: getMockCollections(),
    sessionValues: getMockSessionValues(),
    memUserValues: getMockMemUserValues(),
  });
  if (!e.success) {
    return { ok: false, diagnosis: `Ausführungstest fehlgeschlagen: ${e.error}` };
  }
  return { ok: true };
}

function mapToolCoordStatus(
  s: ToolCoordinatorPhaseStatus,
  onStatus?: (u: UnifiedFormulaAgentStatus) => void
) {
  const map: Record<ToolCoordinatorPhaseStatus, UnifiedFormulaAgentStatus> = {
    thinking: "thinking",
    planning: "planning",
    retrieving: "retrieving",
    evaluating: "evaluating",
    validating: "validating",
    digesting: "digesting",
    clarifying: "clarifying",
  };
  onStatus?.(map[s]);
}

export type UnifiedFormulaAgentResult =
  | { type: "answer"; finalAnswer: string }
  | { type: "clarification"; question: string };

/**
 * Runs the unified coordinator + tool-coordinator pipeline (graph agent API mode).
 */
export async function runUnifiedFormulaAgent(
  input: { messages: UnifiedChatMessage[]; currentFormula?: string },
  options: {
    onStatus?: (status: UnifiedFormulaAgentStatus) => void;
    onChunk?: (chunk: string) => void;
  } = {}
): Promise<UnifiedFormulaAgentResult> {
  const { onStatus, onChunk } = options;
  onStatus?.("thinking");

  const coordinatorModel = getLangChainChatModelForStructuredOutput(LLMUseCases.COORDINATOR);
  const structuredCoordinator = coordinatorModel.withStructuredOutput(CoordinatorDecision);

  const polishModel = getLangChainChatModel(LLMUseCases.CLARIFICATION_CHAT);

  const thread: BaseMessage[] = [
    new SystemMessage(UNIFIED_COORDINATOR_SYSTEM),
    ...toBaseMessages(input.messages ?? []),
  ];

  const currentFormula = input.currentFormula ?? "";

  for (let round = 0; round < MAX_COORDINATOR_ROUNDS; round++) {
    onStatus?.("coordinating");
    let decision: CoordinatorDecisionType;
    try {
      const raw = await structuredCoordinator.invoke(thread);
      const parsed = CoordinatorDecision.safeParse(raw);
      decision = parsed.success
        ? parsed.data
        : {
            step: "finalize",
            draft_markdown:
              "Es gab ein technisches Problem bei der strukturierten Koordinator-Antwort. Bitte die Anfrage kürzen oder erneut versuchen.",
          };
    } catch {
      decision = {
        step: "finalize",
        draft_markdown:
          "Es gab ein technisches Problem bei der strukturierten Koordinator-Antwort. Bitte die Anfrage kürzen oder erneut versuchen.",
      };
    }

    if (decision.step === "use_capabilities") {
      thread.push(
        new AIMessage(
          `[Koordinator → Fähigkeiten] Ich benötige Unterstützung für: ${decision.capability_brief}`
        )
      );
      const toolPhase = await runToolCoordinatorPhase({
        capabilityBrief: decision.capability_brief,
        messages: input.messages ?? [],
        currentFormula,
        options: {
          onStatus: (s) => mapToolCoordStatus(s, onStatus),
        },
      });
      if (toolPhase.kind === "hitl") {
        onStatus?.("clarifying");
        return { type: "clarification", question: toolPhase.question };
      }
      thread.push(
        new HumanMessage(
          `## Aufbereitete Fähigkeitsergebnisse (nur Zusammenfassung; keine Roh-Logs)\n${toolPhase.text}`
        )
      );
      continue;
    }

    const formula =
      decision.formula_candidate?.trim() ||
      extractFormulaFromMarkdown(decision.draft_markdown) ||
      undefined;
    const review = runDeterministicReview(formula);
    if (!review.ok) {
      thread.push(
        new HumanMessage(
          `## Prüfung vor der Antwort (deterministisch)\n${review.diagnosis}\nBitte Entwurf anpassen und erneut finalisieren.`
        )
      );
      continue;
    }

    onStatus?.("answering");
    const systemPrompt = buildClarificationAnswerSystemPrompt();
    const userMessage = new HumanMessage(
      `Formuliere die folgende Assistenten-Antwort als Markdown-Erklärung:\n\n${decision.draft_markdown}`
    );
    let finalAnswer = "";
    const stream = await polishModel.stream([new SystemMessage(systemPrompt), userMessage]);
    for await (const chunk of stream) {
      const text = langchainMessageContentToText(chunk.content);
      if (text) {
        finalAnswer += text;
        onChunk?.(text);
      }
    }
    return { type: "answer", finalAnswer };
  }

  return {
    type: "answer",
    finalAnswer:
      "Die Koordination hat das Rundenlimit erreicht. Bitte präzisieren Sie die Frage oder versuchen Sie es erneut.",
  };
}
