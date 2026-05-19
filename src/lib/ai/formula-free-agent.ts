/**
 * Free agent: LangChain {@code createAgent} (ReAct) with full formula tools + polish stream.
 *
 * @author Lukas Alber
 */

import { createAgent } from "langchain";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  isAIMessage,
  isToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { getLangChainChatModel, LLMUseCases } from "@/lib/ai/llm-config";
import { langchainMessageContentToText } from "@/lib/ai/langchain-message-content";
import { LangChainToolStatusCallback } from "@/lib/ai/langchain-tool-status-callback";
import { buildClarificationAgentSystemPrompt, buildClarificationAnswerSystemPrompt } from "@/lib/ai/prompting";
import { MOCK_FIELDS } from "@/data/fields";
import { AGENT_TOOLS, ASK_CLARIFICATION_TOOL_NAME } from "@/lib/ai/tools";

export type FreeFormulaAgentStatus =
  | "thinking"
  | "answering"
  | "retrieving"
  | "validating"
  | "evaluating"
  | "clarifying";

const TOOL_TO_STATUS: Record<string, FreeFormulaAgentStatus> = {
  retrieveDocs: "retrieving",
  validateFormula: "validating",
  evaluateFormula: "evaluating",
  askClarification: "clarifying",
};

export type FreeFormulaAgentInput = {
  messages: { role: string; content: string }[];
  currentFormula?: string;
};

export type FreeFormulaAgentResult =
  | { type: "answer"; finalAnswer: string }
  | { type: "clarification"; question: string };

function toBaseMessages(msgs: FreeFormulaAgentInput["messages"]): BaseMessage[] {
  return (msgs ?? []).map((m) => {
    const content = String(m.content ?? "");
    if (m.role === "assistant") return new AIMessage(content);
    if (m.role === "system") return new SystemMessage(content);
    return new HumanMessage(content);
  });
}

/** Tool names from {@link AIMessage.tool_calls} and Anthropic {@code tool_use} content blocks. */
function getToolCallNames(message: AIMessage): string[] {
  const names: string[] = [];
  for (const tc of message.tool_calls ?? []) {
    if (tc.name) names.push(tc.name);
  }
  const content = message.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        block.type === "tool_use" &&
        "name" in block &&
        typeof block.name === "string"
      ) {
        names.push(block.name);
      }
    }
  }
  return names;
}

/**
 * Replays status phases from new agent messages (matches LangSmith tool/model turns).
 * Fallback when {@code createAgent} does not forward tool callbacks on invoke.
 */
function emitStatusesFromAgentMessages(
  msgs: BaseMessage[],
  onStatus?: (status: FreeFormulaAgentStatus) => void
): void {
  if (!onStatus) return;
  for (const m of msgs) {
    if (!isAIMessage(m)) continue;
    onStatus("thinking");
    for (const name of getToolCallNames(m)) {
      const phase = TOOL_TO_STATUS[name];
      if (phase) onStatus(phase);
    }
  }
}

/**
 * Runs the free-form tool agent (LangChain agent helper) and optional markdown polish.
 */
export async function runFreeFormulaAgent(
  input: FreeFormulaAgentInput,
  options: {
    onStatus?: (status: FreeFormulaAgentStatus) => void;
    onChunk?: (chunk: string) => void;
  } = {}
): Promise<FreeFormulaAgentResult> {
  const { onStatus, onChunk } = options;
  let sawToolPhase = false;
  const emitStatus = (status: FreeFormulaAgentStatus) => {
    if (
      status === "retrieving" ||
      status === "validating" ||
      status === "evaluating" ||
      status === "clarifying"
    ) {
      sawToolPhase = true;
    }
    onStatus?.(status);
  };

  emitStatus("thinking");

  const systemPrompt = buildClarificationAgentSystemPrompt({
    fields: MOCK_FIELDS.map((f) => ({ name: f.name, internalName: f.internalName })),
    currentFormula: input.currentFormula || undefined,
  });

  const model = getLangChainChatModel(LLMUseCases.FORMULA_AGENT);
  const agent = createAgent({
    model,
    tools: AGENT_TOOLS,
    systemPrompt,
  });

  const invokeMessages = toBaseMessages(input.messages ?? []);
  const priorMessageCount = invokeMessages.length;
  const callbacks: BaseCallbackHandler[] = onStatus
    ? [new LangChainToolStatusCallback(emitStatus, TOOL_TO_STATUS, "thinking")]
    : [];

  const result = await agent.invoke(
    { messages: invokeMessages },
    {
      recursionLimit: 40,
      callbacks: callbacks.length ? callbacks : undefined,
    }
  );

  const msgs = (result as { messages?: BaseMessage[] }).messages ?? [];
  const newMsgs = msgs.slice(priorMessageCount);

  if (!sawToolPhase) {
    emitStatusesFromAgentMessages(newMsgs, emitStatus);
  }

  for (let i = newMsgs.length - 1; i >= 0; i--) {
    const m = newMsgs[i];
    if (isToolMessage(m) && m.name === ASK_CLARIFICATION_TOOL_NAME) {
      const q = typeof m.content === "string" ? m.content : "";
      emitStatus("clarifying");
      return { type: "clarification", question: q.trim() || "Könnten Sie bitte präzisieren?" };
    }
  }

  const lastAi = [...newMsgs].reverse().find(isAIMessage);
  const agentConclusion = lastAi ? langchainMessageContentToText(lastAi.content) : "";

  emitStatus("answering");
  const polishModel = getLangChainChatModel(LLMUseCases.CLARIFICATION_CHAT);
  const polishSystem = buildClarificationAnswerSystemPrompt();
  const polishUser = new HumanMessage(
    `Formuliere die folgende Assistenten-Antwort als Markdown-Erklärung:\n\n${agentConclusion}`
  );

  let finalAnswer = "";
  const stream = await polishModel.stream([new SystemMessage(polishSystem), polishUser]);
  for await (const chunk of stream) {
    const text = langchainMessageContentToText(chunk.content);
    if (text) {
      finalAnswer += text;
      onChunk?.(text);
    }
  }

  return { type: "answer", finalAnswer };
}
