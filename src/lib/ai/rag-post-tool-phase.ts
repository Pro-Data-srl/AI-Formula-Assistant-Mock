/**
 * Post-retrieval tool loop for the RAG agent: validate / evaluate / askClarification.
 * Uses the same LangGraph pattern as the clarification agent but omits {@code retrieveDocs}
 * (documentation is already injected via {@link buildRagToolAgentSystemPrompt}).
 *
 * @author Lukas Alber
 */

import {
  Annotation,
  END,
  START,
  StateGraph,
  messagesStateReducer,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  isAIMessage,
  isToolMessage,
} from "@langchain/core/messages";
import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { getLangChainChatModel, LLMUseCases } from "@/lib/ai/llm-config";
import { langchainMessageContentToText } from "@/lib/ai/langchain-message-content";
import { buildRagToolAgentSystemPrompt } from "@/lib/ai/prompting/rag-tool-agent";
import { buildClarificationAnswerSystemPrompt } from "@/lib/ai/prompting/clarification-answer";
import { MOCK_FIELDS } from "@/data/fields";
import type { RetrievedFormulaDoc } from "@/lib/rag/retriever";
import { RAG_POST_RETRIEVAL_TOOLS, ASK_CLARIFICATION_TOOL_NAME } from "@/lib/ai/tools";
import { LangChainToolStatusCallback } from "@/lib/ai/langchain-tool-status-callback";
import type { RagAnswerDoc } from "@/lib/ai/prompting/rag-answer";

export type RagPostToolPhaseStatus =
  | "thinking"
  | "answering"
  | "validating"
  | "evaluating"
  | "clarifying";

export type RagPostToolPhaseConfig = {
  onStatus?: (status: RagPostToolPhaseStatus) => void;
  onChunk?: (chunk: string) => void;
};

export type RagPostToolChatMessage = { role: string; content: string };

const RagPostToolState = Annotation.Root({
  messages: Annotation({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  retrievedDocs: Annotation<RetrievedFormulaDoc[]>({
    reducer: (_, next) => next ?? [],
    default: () => [],
  }),
  currentFormula: Annotation<string>({
    reducer: (_, next) => next ?? "",
    default: () => "",
  }),
  clarificationQuestion: Annotation<string>({
    reducer: (_, next) => next ?? "",
    default: () => "",
  }),
  finalAnswer: Annotation<string>({
    reducer: (_, next) => next ?? "",
    default: () => "",
  }),
});

type State = typeof RagPostToolState.State;

function getOnStatus(config: {
  configurable?: RagPostToolPhaseConfig;
}): RagPostToolPhaseConfig["onStatus"] {
  return config?.configurable?.onStatus;
}

function getOnChunk(config: {
  configurable?: RagPostToolPhaseConfig;
}): RagPostToolPhaseConfig["onChunk"] {
  return config?.configurable?.onChunk;
}

function retrievedDocsToRagAnswerDocs(docs: RetrievedFormulaDoc[]): RagAnswerDoc[] {
  return docs.map((d) => ({
    name: d.name,
    signature: d.signature,
    content: d.content,
    example: d.example,
  }));
}

const agentModel = getLangChainChatModel(LLMUseCases.FORMULA_AGENT);
const agentModelWithTools = agentModel.bindTools!(RAG_POST_RETRIEVAL_TOOLS);
const answerModel = getLangChainChatModel(LLMUseCases.CLARIFICATION_CHAT);

const TOOL_TO_STATUS: Record<string, RagPostToolPhaseStatus> = {
  validateFormula: "validating",
  evaluateFormula: "evaluating",
  askClarification: "clarifying",
};

const toolNode = new ToolNode(RAG_POST_RETRIEVAL_TOOLS);

async function agentNode(
  state: State,
  config: { configurable?: RagPostToolPhaseConfig }
): Promise<Partial<State>> {
  const onStatus = getOnStatus(config);
  onStatus?.("thinking");

  const systemPrompt = buildRagToolAgentSystemPrompt({
    retrievedDocs: retrievedDocsToRagAnswerDocs(state.retrievedDocs ?? []),
    fields: MOCK_FIELDS.map((f) => ({ name: f.name, internalName: f.internalName })),
    currentFormula: state.currentFormula || undefined,
  });

  const response = await agentModelWithTools.invoke(
    [new SystemMessage(systemPrompt), ...(state.messages ?? [])],
    config
  );
  return { messages: [response] };
}

function routeAfterAgent(state: State): "tools" | "answer" {
  const last = state.messages?.[state.messages.length - 1];
  if (last && "tool_calls" in last && Array.isArray(last.tool_calls) && last.tool_calls.length > 0) {
    return "tools";
  }
  return "answer";
}

async function answerNode(
  state: State,
  config: { configurable?: RagPostToolPhaseConfig }
): Promise<Partial<State>> {
  const onStatus = getOnStatus(config);
  const onChunk = getOnChunk(config);
  onStatus?.("answering");

  const lastAi = [...(state.messages ?? [])].reverse().find(isAIMessage);
  const agentConclusion = lastAi ? langchainMessageContentToText(lastAi.content) : "";

  const systemPrompt = buildClarificationAnswerSystemPrompt();
  const userMessage = new HumanMessage(
    `Formuliere die folgende Assistenten-Antwort als Markdown-Erklärung:\n\n${agentConclusion}`
  );

  let finalAnswer = "";
  const stream = await answerModel.stream([new SystemMessage(systemPrompt), userMessage], config);
  for await (const chunk of stream) {
    const text = langchainMessageContentToText(chunk.content);
    if (text) {
      finalAnswer += text;
      onChunk?.(text);
    }
  }
  return { finalAnswer };
}

function routeAfterTools(state: State): "clarification" | "agent" {
  const messages = state.messages ?? [];
  const lastAi = [...messages].reverse().find((msg) => isAIMessage(msg));
  if (lastAi && "tool_calls" in lastAi && Array.isArray(lastAi.tool_calls)) {
    const hasAskClarification = lastAi.tool_calls.some(
      (tc: { name?: string }) => tc.name === ASK_CLARIFICATION_TOOL_NAME
    );
    if (hasAskClarification) return "clarification";
  }
  return "agent";
}

async function clarificationNode(state: State): Promise<Partial<State>> {
  const messages = state.messages ?? [];
  const lastToolMessage = [...messages].reverse().find((msg) => isToolMessage(msg));
  const question =
    lastToolMessage && typeof lastToolMessage.content === "string"
      ? lastToolMessage.content
      : "Könnten Sie bitte präzisieren, was Sie möchten?";
  return { clarificationQuestion: question };
}

const graphBuilder = new StateGraph(RagPostToolState)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addNode("clarification", clarificationNode)
  .addNode("answer", answerNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", routeAfterAgent, ["tools", "answer"])
  .addConditionalEdges("tools", routeAfterTools, ["clarification", "agent"])
  .addEdge("clarification", END)
  .addEdge("answer", END);

export const ragPostToolPhaseGraph = graphBuilder.compile();

export type RagPostToolPhaseInput = {
  messages: RagPostToolChatMessage[];
  retrievedDocs: RetrievedFormulaDoc[];
  currentFormula: string;
};

export type RagPostToolPhaseResult =
  | { type: "answer"; finalAnswer: string }
  | { type: "clarification"; question: string };

function toBaseMessages(msgs: RagPostToolChatMessage[]) {
  return msgs.map((m) => {
    const content = String(m.content ?? "");
    if (m.role === "assistant") return new AIMessage(content);
    if (m.role === "system") return new SystemMessage(content);
    return new HumanMessage(content);
  });
}

/**
 * Runs validate/evaluate/askClarification after RAG retrieval, then polishes the assistant reply.
 */
export async function runRagPostToolPhase(
  input: RagPostToolPhaseInput,
  options: RagPostToolPhaseConfig = {}
): Promise<RagPostToolPhaseResult> {
  options.onStatus?.("thinking");

  const configurable: RagPostToolPhaseConfig = {};
  if (options.onStatus) configurable.onStatus = options.onStatus;
  if (options.onChunk) configurable.onChunk = options.onChunk;

  const messages = toBaseMessages(input.messages ?? []);
  const initialState: Partial<State> = {
    messages,
    retrievedDocs: input.retrievedDocs,
    currentFormula: input.currentFormula ?? "",
    clarificationQuestion: "",
    finalAnswer: "",
  };

  const config: {
    configurable?: RagPostToolPhaseConfig;
    callbacks?: BaseCallbackHandler[];
  } = { configurable };
  if (options.onStatus) {
    config.callbacks = [
      new LangChainToolStatusCallback<RagPostToolPhaseStatus>(options.onStatus, TOOL_TO_STATUS),
    ];
  }

  const finalState = await ragPostToolPhaseGraph.invoke(initialState, config);

  const clarificationQuestion = (finalState as State).clarificationQuestion ?? "";
  if (clarificationQuestion) {
    return { type: "clarification", question: clarificationQuestion };
  }

  const finalAnswer = (finalState as State).finalAnswer ?? "";
  return { type: "answer", finalAnswer };
}
