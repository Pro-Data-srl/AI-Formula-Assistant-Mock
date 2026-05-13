import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  getLangChainChatModel,
  getLangChainChatModelForStructuredOutput,
  LLMUseCases,
} from "@/lib/ai/llm-config";
import { langchainMessageContentToText } from "@/lib/ai/langchain-message-content";
import {
  RAG_PLAN_SYSTEM,
  RAG_CHECK_SYSTEM,
  buildRagPlanUserMessage,
  buildRagCheckUserMessage,
  buildRagAnswerSystemPrompt,
} from "@/lib/ai/prompting";
import type { RetrievedFormulaDoc } from "@/lib/rag/retriever";
import { retrieveFormulaDocsForQueries } from "@/lib/rag/retriever";
import { MOCK_FIELDS } from "@/data/fields";

/** Structured output from the plan step: chain-of-thought + search queries. Only queries are used downstream for now; reasoning is for future eval. */
const PlanOutputSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "Kurze Zwischenschritte: Was soll der Nutzer erreichen, welche Aktionen/Funktionen könnten nötig sein, daraus Suchbegriffe ableiten."
    ),
  queries: z
    .array(z.string().describe("Kurzer Suchbegriff für Funktionsdokumentation"))
    .max(10)
    .describe("Suchbegriffe, die die benötigten Funktionen umschreiben"),
});

/** Structured output from the check step: whether retrieved docs are sufficient to answer the user question. */
const CheckOutputSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "Kurze Zwischenschritte: Welche Doku wurde abgerufen, deckt sie die Nutzerfrage ab oder fehlen Funktionen/Konzepte?"
    ),
  sufficient: z
    .boolean()
    .describe("true wenn die abgerufene Doku ausreicht um die Nutzerfrage zu beantworten, sonst false"),
});

/** Status strings sent to the client during RAG flow. */
export type FormulaRagStatus =
  | "thinking"
  | "planning"
  | "retrieving"
  | "evaluating"
  | "answering";

export type FormulaRagConfig = {
  onStatus?: (status: FormulaRagStatus) => void;
  /** Called with each streamed text chunk from the answer node. */
  onChunk?: (chunk: string) => void;
};

export type ChatMessage = { role: string; content: string };

const FormulaRagState = Annotation.Root({
  messages: Annotation<ChatMessage[]>({
    reducer: (_, next) => next ?? [],
    default: () => [],
  }),
  userMessage: Annotation<string>(),
  currentFormula: Annotation<string>({
    reducer: (_, next) => next ?? "",
    default: () => "",
  }),
  plannedQueries: Annotation<string[]>({
    reducer: (_, next) => next ?? [],
    default: () => [],
  }),
  retrievedDocs: Annotation<RetrievedFormulaDoc[]>({
    reducer: (_, next) => next ?? [],
    default: () => [],
  }),
  fulfilled: Annotation<boolean>({
    reducer: (_, next) => next ?? false,
    default: () => false,
  }),
  finalAnswer: Annotation<string>({
    reducer: (_, next) => next ?? "",
    default: () => "",
  }),
  retrievalRound: Annotation<number>({
    reducer: (_, next) => (next !== undefined ? next : 0),
    default: () => 0,
  }),
  /** Reasoning from check when sufficient=false; used by plan to target missing docs. */
  checkFeedback: Annotation<string>({
    reducer: (_, next) => next ?? "",
    default: () => "",
  }),
});

type State = typeof FormulaRagState.State;

/** Plan/check only: structured JSON; Anthropic thinking forced off (see llm-config). */
const planCheckModel = getLangChainChatModelForStructuredOutput(LLMUseCases.AGENTIC_RAG);
/** Answer node streams markdown. */
const answerModel = getLangChainChatModel(LLMUseCases.AGENTIC_CHAT);

const planModel = planCheckModel.withStructuredOutput(PlanOutputSchema);
const checkModel = planCheckModel.withStructuredOutput(CheckOutputSchema);

function getOnStatus(config: { configurable?: FormulaRagConfig }): FormulaRagConfig["onStatus"] {
  return config?.configurable?.onStatus;
}

function getOnChunk(config: { configurable?: FormulaRagConfig }): FormulaRagConfig["onChunk"] {
  return config?.configurable?.onChunk;
}

function toLangChainMessages(msgs: ChatMessage[]) {
  return msgs.map((m) => {
    const content = String(m.content ?? "");
    if (m.role === "assistant") return new AIMessage(content);
    if (m.role === "system") return new SystemMessage(content);
    return new HumanMessage(content);
  });
}

function formatChatHistoryForContext(msgs: ChatMessage[]): string {
  if (msgs.length === 0) return "";
  return msgs
    .map((m) => `${m.role === "user" ? "Nutzer" : "Assistent"}: ${m.content}`)
    .join("\n\n");
}

async function planNode(state: State, config: { configurable?: FormulaRagConfig }): Promise<Partial<State>> {
  const onStatus = getOnStatus(config);
  onStatus?.("planning");

  const history = formatChatHistoryForContext(state.messages ?? []);
  const currentPart =
    state.userMessage + (state.currentFormula ? `\nAktuelle Formel: ${state.currentFormula}` : "");
  const basePart = history
    ? `Bisheriger Verlauf:\n${history}\n\n---\nAktuelle Frage:\n${currentPart}`
    : currentPart;
  const text = buildRagPlanUserMessage(basePart, {
    checkFeedback: state.checkFeedback || undefined,
  });

  let queries: string[] = [];
  try {
    const result = await planModel.invoke([
      new SystemMessage(RAG_PLAN_SYSTEM),
      new HumanMessage(text),
    ]);
    queries = result.queries;
  } catch {
    queries = [state.userMessage.slice(0, 80)].filter(Boolean);
  }
  return { plannedQueries: queries };
}

async function retrieveNode(state: State, config: { configurable?: FormulaRagConfig }): Promise<Partial<State>> {
  const onStatus = getOnStatus(config);
  onStatus?.("retrieving");

  const queries = state.plannedQueries.length > 0 ? state.plannedQueries : [state.userMessage];
  const docs = await retrieveFormulaDocsForQueries(queries, { topKPerQuery: 5 });
  const round = (state.retrievalRound ?? 0) + 1;
  const existing = state.retrievedDocs ?? [];
  const mergedDocs = round > 1 ? [...existing, ...docs] : docs;
  return {
    retrievedDocs: mergedDocs,
    retrievalRound: round,
  };
}

async function checkNode(state: State, config: { configurable?: FormulaRagConfig }): Promise<Partial<State>> {
  const onStatus = getOnStatus(config);
  onStatus?.("evaluating");

  const docs = state.retrievedDocs ?? [];
  if (docs.length === 0) {
    return { fulfilled: true };
  }
  const contextSnippet = docs
    .map(
      (d) =>
        `${d.name}: ${d.signature} — ${d.content}${d.example ? ` (Beispiel: ${d.example})` : ""}`
    )
    .join("\n---\n");
  const checkContent = buildRagCheckUserMessage(state.messages ?? [], contextSnippet);
  const result = await checkModel.invoke([
    new SystemMessage(RAG_CHECK_SYSTEM),
    new HumanMessage(checkContent),
  ]);
  return {
    fulfilled: result.sufficient,
    checkFeedback: result.sufficient ? "" : result.reasoning,
  };
}

async function answerNode(state: State, config: { configurable?: FormulaRagConfig }): Promise<Partial<State>> {
  const onStatus = getOnStatus(config);
  const onChunk = getOnChunk(config);
  onStatus?.("answering");

  const systemPrompt = buildRagAnswerSystemPrompt({
    retrievedDocs: state.retrievedDocs ?? [],
    fields: MOCK_FIELDS,
    currentFormula: state.currentFormula || undefined,
  });

  const historyMessages = toLangChainMessages(state.messages ?? []);
  const answerMessages = [
    new SystemMessage(systemPrompt),
    ...historyMessages,
  ];
  let finalAnswer = "";
  const stream = await answerModel.stream(answerMessages);
  for await (const chunk of stream) {
    const text = langchainMessageContentToText(chunk.content);
    if (text) {
      finalAnswer += text;
      onChunk?.(text);
    }
  }
  return { finalAnswer };
}

function routeAfterCheck(state: State): "plan" | "answer" {
  if (state.fulfilled) return "answer";
  if ((state.retrievalRound ?? 0) >= 2) return "answer";
  return "plan";
}

const graphBuilder = new StateGraph(FormulaRagState)
  .addNode("plan", planNode)
  .addNode("retrieve", retrieveNode)
  .addNode("check", checkNode)
  .addNode("answer", answerNode)
  .addEdge(START, "plan")
  .addEdge("plan", "retrieve")
  .addEdge("retrieve", "check")
  .addConditionalEdges("check", routeAfterCheck, ["plan", "answer"])
  .addEdge("answer", END);

export const formulaRagGraph = graphBuilder.compile();

export type FormulaRagInput = {
  messages: { role: string; content: string }[];
  currentFormula?: string;
};

function getLastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return String(messages[i].content ?? "");
  }
  return "";
}

export async function runFormulaRag(
  input: FormulaRagInput,
  options: { onStatus?: (status: FormulaRagStatus) => void; onChunk?: (chunk: string) => void } = {}
): Promise<{ finalAnswer: string; state: State }> {
  options.onStatus?.("thinking");
  const configurable: FormulaRagConfig = {};
  if (options.onStatus) configurable.onStatus = options.onStatus;
  if (options.onChunk) configurable.onChunk = options.onChunk;
  const config = Object.keys(configurable).length > 0 ? { configurable } : undefined;
  const messages = input.messages ?? [];
  const userMessage = getLastUserMessage(messages);
  const initialState: Partial<State> = {
    messages,
    userMessage,
    currentFormula: input.currentFormula ?? "",
    plannedQueries: [],
    retrievedDocs: [],
    fulfilled: false,
    finalAnswer: "",
    retrievalRound: 0,
    checkFeedback: "",
  };
  const finalState = await formulaRagGraph.invoke(initialState, config);
  return {
    finalAnswer: (finalState as State).finalAnswer ?? "",
    state: finalState as State,
  };
}
