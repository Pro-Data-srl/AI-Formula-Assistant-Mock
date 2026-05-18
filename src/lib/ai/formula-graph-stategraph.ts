/**
 * Graph agent: LangGraph {@link StateGraph} with explicit nodes and edges for the two-LLM pipeline
 * (planning coordinator → tool coordinator → deterministic review → streamed polish).
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
  Annotation,
  END,
  START,
  StateGraph,
} from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getLangChainChatModelForStructuredOutput, getLangChainChatModel, LLMUseCases } from "@/lib/ai/llm-config";
import { GRAPH_PLANNING_COORDINATOR_SYSTEM } from "@/lib/ai/prompting/graph-planning-coordinator";
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

/** Chat messages passed into the graph agent (graph-mode input). */
export type GraphAgentChatMessage = { role: string; content: string };

/** Phases surfaced to the client for the graph agent. */
export type GraphFormulaAgentStatus =
  | "thinking"
  | "coordinating"
  | "planning"
  | "retrieving"
  | "evaluating"
  | "validating"
  | "digesting"
  | "answering"
  | "clarifying";

export type GraphFormulaAgentResult =
  | { type: "answer"; finalAnswer: string }
  | { type: "clarification"; question: string };

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

const NODE = {
  COORDINATE: "coordinate_plan",
  CAPABILITIES: "capabilities",
  FINALIZE_REVIEW: "finalize_review",
  POLISH: "polish",
} as const;

type GraphConfigurable = {
  onStatus?: (status: GraphFormulaAgentStatus) => void;
  onChunk?: (chunk: string) => void;
};

function graphCfg(config?: LangGraphRunnableConfig): GraphConfigurable {
  return (config?.configurable ?? {}) as GraphConfigurable;
}

const FormulaGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => {
      if (right == null) return left;
      const chunk = Array.isArray(right) ? right : [right as BaseMessage];
      return left.concat(chunk);
    },
    default: () => [],
  }),
  coordinatorPass: Annotation<number>(),
  lastDecision: Annotation<CoordinatorDecisionType | null>(),
  userMessagesSnapshot: Annotation<GraphAgentChatMessage[]>(),
  currentFormula: Annotation<string>(),
  result: Annotation<GraphFormulaAgentResult | null>(),
  /** Routing hint set only by {@code finalize_review}. */
  reviewRoute: Annotation<"unset" | "polish" | "loop_plan">(),
});

type GraphState = typeof FormulaGraphState.State;

function toBaseMessages(msgs: GraphAgentChatMessage[]): BaseMessage[] {
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
  onStatus?: (u: GraphFormulaAgentStatus) => void
) {
  const map: Record<ToolCoordinatorPhaseStatus, GraphFormulaAgentStatus> = {
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

const coordinatorModel = getLangChainChatModelForStructuredOutput(LLMUseCases.COORDINATOR);
const structuredCoordinator = coordinatorModel.withStructuredOutput(CoordinatorDecision);
const polishModel = getLangChainChatModel(LLMUseCases.CLARIFICATION_CHAT);

async function coordinatePlanNode(
  state: GraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<GraphState>> {
  const { onStatus } = graphCfg(config);
  if (state.result) return {};

  if (state.coordinatorPass >= MAX_COORDINATOR_ROUNDS) {
    return {
      result: {
        type: "answer",
        finalAnswer:
          "Die Koordination hat das Rundenlimit erreicht. Bitte präzisieren Sie die Frage oder versuchen Sie es erneut.",
      },
    };
  }

  onStatus?.("coordinating");
  let decision: CoordinatorDecisionType;
  try {
    const raw = await structuredCoordinator.invoke(state.messages);
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

  return {
    coordinatorPass: state.coordinatorPass + 1,
    lastDecision: decision,
    reviewRoute: "unset",
  };
}

async function capabilitiesNode(
  state: GraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<GraphState>> {
  const { onStatus } = graphCfg(config);
  const decision = state.lastDecision;
  if (!decision || decision.step !== "use_capabilities") {
    return {};
  }

  const msgs: BaseMessage[] = [
    new AIMessage(
      `[Koordinator → Fähigkeiten] Ich benötige Unterstützung für: ${decision.capability_brief}`
    ),
  ];

  const toolPhase = await runToolCoordinatorPhase({
    capabilityBrief: decision.capability_brief,
    messages: state.userMessagesSnapshot,
    currentFormula: state.currentFormula,
    options: {
      onStatus: (s) => mapToolCoordStatus(s, onStatus),
    },
  });

  if (toolPhase.kind === "hitl") {
    onStatus?.("clarifying");
    return {
      result: { type: "clarification", question: toolPhase.question },
      messages: msgs,
      lastDecision: null,
    };
  }

  return {
    messages: [
      ...msgs,
      new HumanMessage(
        `## Aufbereitete Fähigkeitsergebnisse (nur Zusammenfassung; keine Roh-Logs)\n${toolPhase.text}`
      ),
    ],
    lastDecision: null,
  };
}

async function finalizeReviewNode(state: GraphState): Promise<Partial<GraphState>> {
  const decision = state.lastDecision;
  if (!decision || decision.step !== "finalize") {
    return { reviewRoute: "unset" };
  }

  const formula =
    decision.formula_candidate?.trim() ||
    extractFormulaFromMarkdown(decision.draft_markdown) ||
    undefined;
  const review = runDeterministicReview(formula);
  if (!review.ok) {
    return {
      reviewRoute: "loop_plan",
      messages: [
        new HumanMessage(
          `## Prüfung vor der Antwort (deterministisch)\n${review.diagnosis}\nBitte Entwurf anpassen und erneut finalisieren.`
        ),
      ],
      lastDecision: null,
    };
  }

  return { reviewRoute: "polish", lastDecision: decision };
}

async function polishNode(state: GraphState, config?: LangGraphRunnableConfig): Promise<Partial<GraphState>> {
  const { onStatus, onChunk } = graphCfg(config);
  const decision = state.lastDecision;
  if (!decision || decision.step !== "finalize") {
    return {
      result: {
        type: "answer",
        finalAnswer: "Interner Zustandsfehler in der Polish-Phase.",
      },
    };
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
  return { result: { type: "answer", finalAnswer } };
}

function routeAfterCoordinate(state: GraphState): string {
  if (state.result) return END;
  const d = state.lastDecision;
  if (!d) return END;
  if (d.step === "use_capabilities") return NODE.CAPABILITIES;
  if (d.step === "finalize") return NODE.FINALIZE_REVIEW;
  return END;
}

function routeAfterCapabilities(state: GraphState): string {
  if (state.result?.type === "clarification") return END;
  return NODE.COORDINATE;
}

function routeAfterFinalizeReview(state: GraphState): string {
  if (state.reviewRoute === "polish") return NODE.POLISH;
  if (state.reviewRoute === "loop_plan") return NODE.COORDINATE;
  return END;
}

function buildGraphAgentGraph() {
  return (
    new StateGraph(FormulaGraphState)
      .addNode(NODE.COORDINATE, coordinatePlanNode)
      .addNode(NODE.CAPABILITIES, capabilitiesNode)
      .addNode(NODE.FINALIZE_REVIEW, finalizeReviewNode)
      .addNode(NODE.POLISH, polishNode)
      .addEdge(START, NODE.COORDINATE)
      .addConditionalEdges(NODE.COORDINATE, routeAfterCoordinate, {
        [NODE.CAPABILITIES]: NODE.CAPABILITIES,
        [NODE.FINALIZE_REVIEW]: NODE.FINALIZE_REVIEW,
        [END]: END,
      })
      .addConditionalEdges(NODE.CAPABILITIES, routeAfterCapabilities, {
        [NODE.COORDINATE]: NODE.COORDINATE,
        [END]: END,
      })
      .addConditionalEdges(NODE.FINALIZE_REVIEW, routeAfterFinalizeReview, {
        [NODE.POLISH]: NODE.POLISH,
        [NODE.COORDINATE]: NODE.COORDINATE,
        [END]: END,
      })
      .addEdge(NODE.POLISH, END)
  );
}

let compiledGraph: ReturnType<ReturnType<typeof buildGraphAgentGraph>["compile"]> | null = null;

function getCompiledGraph() {
  if (!compiledGraph) {
    compiledGraph = buildGraphAgentGraph().compile();
  }
  return compiledGraph;
}

/**
 * Runs the graph agent via a compiled LangGraph {@link StateGraph} (nodes and edges above).
 */
export async function invokeGraphFormulaAgent(
  input: { messages: GraphAgentChatMessage[]; currentFormula?: string },
  options: {
    onStatus?: (status: GraphFormulaAgentStatus) => void;
    onChunk?: (chunk: string) => void;
  } = {}
): Promise<GraphFormulaAgentResult> {
  const { onStatus, onChunk } = options;
  onStatus?.("thinking");

  const initial: Partial<GraphState> = {
    messages: [
      new SystemMessage(GRAPH_PLANNING_COORDINATOR_SYSTEM),
      ...toBaseMessages(input.messages ?? []),
    ],
    coordinatorPass: 0,
    lastDecision: null,
    userMessagesSnapshot: input.messages ?? [],
    currentFormula: input.currentFormula ?? "",
    result: null,
    reviewRoute: "unset",
  };

  const final = await getCompiledGraph().invoke(initial, {
    configurable: { onStatus, onChunk },
  });

  if (!final.result) {
    return {
      type: "answer",
      finalAnswer: "Der Graph wurde ohne Ergebnis beendet.",
    };
  }
  return final.result;
}
