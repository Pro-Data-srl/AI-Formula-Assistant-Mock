/**
 * Formula agent with tools + Clarification (human-in-the-loop).
 * Tools: retrieveDocs, validateFormula, evaluateFormula.
 * Clarification tool: askClarification — when called, returns question to user and ends turn.
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
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import { getLangChainChatModel, LLMUseCases } from "@/lib/ai/llm-config";
import { langchainMessageContentToText } from "@/lib/ai/langchain-message-content";
import {
  buildClarificationAgentSystemPrompt,
  buildClarificationAnswerSystemPrompt,
} from "@/lib/ai/prompting";
import { MOCK_FIELDS } from "@/data/fields";
import { AGENT_TOOLS, ASK_CLARIFICATION_TOOL_NAME } from "@/lib/ai/tools";

/** Status strings sent to the client during clarification agent flow. */
export type ClarificationAgentStatus =
  | "thinking"
  | "answering"
  | "retrieving"
  | "validating"
  | "evaluating"
  | "clarifying";

export type ClarificationAgentConfig = {
  onStatus?: (status: ClarificationAgentStatus) => void;
  onChunk?: (chunk: string) => void;
};

export type ChatMessage = { role: string; content: string };

const ClarificationAgentState = Annotation.Root({
  messages: Annotation({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  currentFormula: Annotation<string>({
    reducer: (_, next) => next ?? "",
    default: () => "",
  }),
  /** Set when Clarification tool was called; returned to API for client display. */
  clarificationQuestion: Annotation<string>({
    reducer: (_, next) => next ?? "",
    default: () => "",
  }),
  /** Streamed markdown answer from answer node (when agent produced valid answer). */
  finalAnswer: Annotation<string>({
    reducer: (_, next) => next ?? "",
    default: () => "",
  }),
});

type State = typeof ClarificationAgentState.State;

function getOnStatus(config: {
  configurable?: ClarificationAgentConfig;
}): ClarificationAgentConfig["onStatus"] {
  return config?.configurable?.onStatus;
}

function getOnChunk(config: {
  configurable?: ClarificationAgentConfig;
}): ClarificationAgentConfig["onChunk"] {
  return config?.configurable?.onChunk;
}

const agentModel = getLangChainChatModel(LLMUseCases.FORMULA_AGENT);
const agentModelWithTools = agentModel.bindTools!(AGENT_TOOLS);
const answerModel = getLangChainChatModel(LLMUseCases.CLARIFICATION_CHAT);

/** Map tool names to status strings for client display. */
const TOOL_TO_STATUS: Record<string, ClarificationAgentStatus> = {
  retrieveDocs: "retrieving",
  validateFormula: "validating",
  evaluateFormula: "evaluating",
  askClarification: "clarifying",
};

/** Callback handler that emits status when a tool starts (used with standard ToolNode). */
class ToolStatusCallbackHandler extends BaseCallbackHandler {
  name = "ToolStatusCallbackHandler";
  constructor(private onStatus: (status: ClarificationAgentStatus) => void) {
    super();
  }
  async handleToolStart(
    tool: Serialized,
    _input: string,
    _runId?: string,
    _parentRunId?: string,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
    runName?: string
  ) {
    const name =
      runName ??
      (tool && "kwargs" in tool ? (tool.kwargs?.name as string | undefined) : undefined);
    const status = name ? TOOL_TO_STATUS[name] : undefined;
    if (status) this.onStatus(status);
  }
}

const toolNode = new ToolNode(AGENT_TOOLS);

async function agentNode(
  state: State,
  config: { configurable?: ClarificationAgentConfig }
): Promise<Partial<State>> {
  const onStatus = getOnStatus(config);
  onStatus?.("thinking");

  const systemPrompt = buildClarificationAgentSystemPrompt({
    fields: MOCK_FIELDS.map((f) => ({ name: f.name, internalName: f.internalName })),
    currentFormula: state.currentFormula || undefined,
  });

  const response = await agentModelWithTools.invoke(
    [new SystemMessage(systemPrompt), ...(state.messages ?? [])],
    config
  );
  return { messages: [response] };
}

/** Route after agent: tools if tool_calls, else answer node (valid final answer). */
function routeAfterAgent(state: State): "tools" | "answer" {
  const last = state.messages?.[state.messages.length - 1];
  if (last && "tool_calls" in last && Array.isArray(last.tool_calls) && last.tool_calls.length > 0) {
    return "tools";
  }
  return "answer";
}

async function answerNode(
  state: State,
  config: { configurable?: ClarificationAgentConfig }
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
  const stream = await answerModel.stream(
    [new SystemMessage(systemPrompt), userMessage],
    config
  );
  for await (const chunk of stream) {
    const text = langchainMessageContentToText(chunk.content);
    if (text) {
      finalAnswer += text;
      onChunk?.(text);
    }
  }
  return { finalAnswer };
}

/** Route after tools: clarification if Clarification tool was called, else back to agent. */
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

const graphBuilder = new StateGraph(ClarificationAgentState)
  .addNode("agent", agentNode)
  .addNode("tools", toolNode)
  .addNode("clarification", clarificationNode)
  .addNode("answer", answerNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", routeAfterAgent, ["tools", "answer"])
  .addConditionalEdges("tools", routeAfterTools, ["clarification", "agent"])
  .addEdge("clarification", END)
  .addEdge("answer", END);

export const formulaClarificationGraph = graphBuilder.compile();

export type ClarificationAgentInput = {
  messages: { role: string; content: string }[];
  currentFormula?: string;
};

function toBaseMessages(msgs: ChatMessage[]) {
  return msgs.map((m) => {
    const content = String(m.content ?? "");
    if (m.role === "assistant") return new AIMessage(content);
    if (m.role === "system") return new SystemMessage(content);
    return new HumanMessage(content);
  });
}

export type ClarificationAgentResult =
  | { type: "answer"; finalAnswer: string }
  | { type: "clarification"; question: string };

export async function runClarificationAgent(
  input: ClarificationAgentInput,
  options: {
    onStatus?: (status: ClarificationAgentStatus) => void;
    onChunk?: (chunk: string) => void;
  } = {}
): Promise<ClarificationAgentResult> {
  options.onStatus?.("thinking");
  const configurable: ClarificationAgentConfig = {};
  if (options.onStatus) configurable.onStatus = options.onStatus;
  if (options.onChunk) configurable.onChunk = options.onChunk;

  const messages = toBaseMessages(input.messages ?? []);
  const initialState: Partial<State> = {
    messages,
    currentFormula: input.currentFormula ?? "",
    clarificationQuestion: "",
    finalAnswer: "",
  };

  const config: { configurable?: ClarificationAgentConfig; callbacks?: BaseCallbackHandler[] } = {};
  if (Object.keys(configurable).length > 0) config.configurable = configurable;
  if (options.onStatus) config.callbacks = [new ToolStatusCallbackHandler(options.onStatus)];
  const finalState = await formulaClarificationGraph.invoke(
    initialState,
    Object.keys(config).length > 0 ? config : undefined
  );

  const clarificationQuestion = (finalState as State).clarificationQuestion ?? "";
  if (clarificationQuestion) {
    return { type: "clarification", question: clarificationQuestion };
  }

  const finalAnswer = (finalState as State).finalAnswer ?? "";
  return { type: "answer", finalAnswer };
}
