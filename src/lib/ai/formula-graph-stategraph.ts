/**
 * Graph agent: LangGraph {@link StateGraph} — planning coordinator orchestrates parallel capabilities
 * (field agent, function RAG, validate, evaluate, clarify) → deterministic review → polish.
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
import {
  runGraphCapabilities,
  formatCapabilityResults,
  type CapabilityRequest,
  type GraphCapabilityStatus,
} from "@/lib/ai/graph-capabilities";
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
  | "resolving_fields"
  | "answering"
  | "clarifying";

export type GraphFormulaAgentResult =
  | { type: "answer"; finalAnswer: string }
  | { type: "clarification"; question: string };

const CapabilityRequestFlat = z.object({
  request_type: z.enum(["function_rag", "resolve_fields", "validate", "evaluate", "clarify"]),
  goal: z.string().optional().default(""),
  query: z.string().optional().default(""),
  formula: z.string().optional().default(""),
  question: z.string().optional().default(""),
});

/** Loose schema for {@code withStructuredOutput} — models often put capability names in {@code step}. */
const CoordinatorDecisionFlat = z.object({
  step: z.string(),
  requests: z.array(CapabilityRequestFlat).optional().default([]),
  draft_markdown: z.string().optional().default(""),
  formula_candidate: z.string().optional(),
});

const CAPABILITY_NAMES = new Set([
  "function_rag",
  "resolve_fields",
  "validate",
  "evaluate",
  "clarify",
]);

type CoordinatorDecisionType =
  | {
      step: "gather";
      requests: CapabilityRequest[];
      draft_markdown?: string;
      formula_candidate?: string;
    }
  | { step: "finalize"; draft_markdown: string; formula_candidate?: string };

function parseFlatRequest(
  raw: z.infer<typeof CapabilityRequestFlat>
): CapabilityRequest | null {
  switch (raw.request_type) {
    case "function_rag":
      return raw.goal.trim() ? { type: "function_rag", goal: raw.goal.trim() } : null;
    case "resolve_fields":
      return raw.query.trim() ? { type: "resolve_fields", query: raw.query.trim() } : null;
    case "validate":
      return raw.formula.trim() ? { type: "validate", formula: raw.formula.trim() } : null;
    case "evaluate":
      return raw.formula.trim() ? { type: "evaluate", formula: raw.formula.trim() } : null;
    case "clarify":
      return raw.question.trim() ? { type: "clarify", question: raw.question.trim() } : null;
  }
}

type CoordinatorDecisionLoose = z.infer<typeof CoordinatorDecisionFlat>;

/**
 * Coerces model output when {@code step} is a capability name (e.g. {@code evaluate}) instead of {@code gather}.
 */
function normalizeCoordinatorDecisionLoose(raw: CoordinatorDecisionLoose): CoordinatorDecisionLoose {
  let step = raw.step.trim().toLowerCase();
  let requests = [...(raw.requests ?? [])];
  const formula =
    raw.formula_candidate?.trim() ||
    requests.find((r) => r.formula.trim())?.formula.trim() ||
    "";

  if (CAPABILITY_NAMES.has(step)) {
    const cap = step as z.infer<typeof CapabilityRequestFlat>["request_type"];
    step = "gather";
    const hasCapRequest = requests.some((r) => r.request_type === cap);
    if (!hasCapRequest) {
      requests = [
        ...requests,
        {
          request_type: cap,
          goal: cap === "function_rag" ? raw.draft_markdown?.slice(0, 200) ?? "" : "",
          query: cap === "resolve_fields" ? raw.draft_markdown?.slice(0, 200) ?? "" : "",
          formula: cap === "validate" || cap === "evaluate" ? formula : "",
          question: cap === "clarify" ? raw.draft_markdown ?? "" : "",
        },
      ];
    }
  }

  return { ...raw, step, requests };
}

function parseCoordinatorDecision(raw: unknown): CoordinatorDecisionType | null {
  const parsed = CoordinatorDecisionFlat.safeParse(raw);
  if (!parsed.success) return null;
  const { step, requests: rawRequests, draft_markdown, formula_candidate } =
    normalizeCoordinatorDecisionLoose(parsed.data);

  if (step === "finalize") {
    if (!draft_markdown.trim()) return null;
    return {
      step: "finalize",
      draft_markdown: draft_markdown.trim(),
      formula_candidate: formula_candidate?.trim() || undefined,
    };
  }

  if (step !== "gather") return null;

  const requests = (rawRequests ?? [])
    .map(parseFlatRequest)
    .filter((r): r is CapabilityRequest => r != null);
  if (requests.length === 0) return null;

  return {
    step: "gather",
    requests,
    draft_markdown: draft_markdown.trim() || undefined,
    formula_candidate: formula_candidate?.trim() || undefined,
  };
}

/** Pulls JSON object from LangChain structured-output parse error text (fallback). */
function extractJsonFromParseError(err: unknown): unknown | null {
  const text = err instanceof Error ? err.message : String(err);
  const marker = 'Text: "';
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const bodyStart = start + marker.length;
  const end = text.indexOf('". Error:', bodyStart);
  if (end < 0) return null;
  const jsonStr = text.slice(bodyStart, end);
  try {
    return JSON.parse(jsonStr) as unknown;
  } catch {
    try {
      return JSON.parse(jsonStr.replace(/\\"/g, '"').replace(/\\n/g, "\n")) as unknown;
    } catch {
      return null;
    }
  }
}

const KNOWN_FIELD_NAMES = new Set(MOCK_FIELDS.map((f) => f.internalName));

const MAX_COORDINATOR_ROUNDS = 10;

const NODE = {
  COORDINATE: "coordinate_plan",
  GATHER: "gather_capabilities",
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

function mapCapabilityStatus(s: GraphCapabilityStatus): GraphFormulaAgentStatus {
  return s;
}

const coordinatorModel = getLangChainChatModelForStructuredOutput(LLMUseCases.COORDINATOR);
const structuredCoordinator = coordinatorModel.withStructuredOutput(CoordinatorDecisionFlat);
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
    const parsed = parseCoordinatorDecision(raw);
    decision = parsed ?? {
      step: "finalize",
      draft_markdown:
        "Es gab ein technisches Problem bei der strukturierten Koordinator-Antwort. Bitte die Anfrage kürzen oder erneut versuchen.",
    };
  } catch (err) {
    const recovered = extractJsonFromParseError(err);
    const parsed = recovered ? parseCoordinatorDecision(recovered) : null;
    if (parsed) {
      decision = parsed;
    } else {
      console.error("[coordinatePlanNode] structured output failed:", err);
      decision = {
        step: "finalize",
        draft_markdown:
          "Es gab ein technisches Problem bei der strukturierten Koordinator-Antwort. Bitte die Anfrage kürzen oder erneut versuchen.",
      };
    }
  }

  return {
    coordinatorPass: state.coordinatorPass + 1,
    lastDecision: decision,
    reviewRoute: "unset",
  };
}

function buildGatherFollowUpMessage(decision: Extract<CoordinatorDecisionType, { step: "gather" }>, capabilityText: string): string {
  const parts = [`## Fähigkeitsergebnisse\n${capabilityText}`];
  if (decision.draft_markdown?.trim()) {
    parts.push(`## Zwischenentwurf (Koordinator)\n${decision.draft_markdown.trim()}`);
  }
  if (decision.formula_candidate?.trim()) {
    parts.push(
      `## formula_candidate (Zwischenstand)\n\`\`\`\n${decision.formula_candidate.trim()}\n\`\`\``
    );
  }
  return parts.join("\n\n");
}

async function gatherCapabilitiesNode(
  state: GraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<GraphState>> {
  const { onStatus } = graphCfg(config);
  const decision = state.lastDecision;
  if (!decision || decision.step !== "gather") {
    return {};
  }

  const requestSummary = decision.requests
    .map((r) => {
      if (r.type === "function_rag") return `function_rag: ${r.goal}`;
      if (r.type === "resolve_fields") return `resolve_fields: ${r.query}`;
      if (r.type === "validate" || r.type === "evaluate") return `${r.type}: (Formel)`;
      return `clarify`;
    })
    .join("; ");

  const msgs: BaseMessage[] = [
    new AIMessage(`[Koordinator → Fähigkeiten] ${requestSummary}`),
  ];

  const outcome = await runGraphCapabilities({
    requests: decision.requests,
    messages: state.userMessagesSnapshot,
    currentFormula: state.currentFormula,
    onStatus: (s) => onStatus?.(mapCapabilityStatus(s)),
  });

  if (outcome.kind === "clarify") {
    onStatus?.("clarifying");
    return {
      result: { type: "clarification", question: outcome.question },
      messages: msgs,
      lastDecision: null,
    };
  }

  return {
    messages: [
      ...msgs,
      new HumanMessage(buildGatherFollowUpMessage(decision, formatCapabilityResults(outcome.items))),
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
  if (d.step === "gather") return NODE.GATHER;
  if (d.step === "finalize") return NODE.FINALIZE_REVIEW;
  return END;
}

function routeAfterGather(state: GraphState): string {
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
      .addNode(NODE.GATHER, gatherCapabilitiesNode)
      .addNode(NODE.FINALIZE_REVIEW, finalizeReviewNode)
      .addNode(NODE.POLISH, polishNode)
      .addEdge(START, NODE.COORDINATE)
      .addConditionalEdges(NODE.COORDINATE, routeAfterCoordinate, {
        [NODE.GATHER]: NODE.GATHER,
        [NODE.FINALIZE_REVIEW]: NODE.FINALIZE_REVIEW,
        [END]: END,
      })
      .addConditionalEdges(NODE.GATHER, routeAfterGather, {
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
 * Runs the graph agent via a compiled LangGraph {@link StateGraph}.
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
