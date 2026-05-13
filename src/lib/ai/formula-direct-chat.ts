/**
 * Direct formula chat (no RAG). Uses LangChain for streaming and LangSmith tracing.
 * Same streaming pattern as RAG and Clarification agents.
 */

import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLangChainChatModel, LLMUseCases } from "@/lib/ai/llm-config";
import { buildDirectChatSystemPrompt } from "@/lib/ai/prompting";
import { buildFormulaContext } from "@/lib/ai/formula-context";
import { langchainMessageContentToText } from "@/lib/ai/langchain-message-content";

export type DirectChatConfig = {
  /** Called at start of streaming (e.g. "answering"). */
  onStatus?: (status: "answering") => void;
  /** Called with each streamed text chunk. */
  onChunk?: (chunk: string) => void;
};

export type DirectChatInput = {
  messages: { role: string; content: string }[];
  currentFormula?: string;
};

function toLangChainMessages(msgs: DirectChatInput["messages"]) {
  return msgs.map((m) => {
    const content = String(m.content ?? "");
    if (m.role === "assistant") return new AIMessage(content);
    if (m.role === "system") return new SystemMessage(content);
    return new HumanMessage(content);
  });
}

export async function runDirectChat(
  input: DirectChatInput,
  options: DirectChatConfig = {}
): Promise<{ finalAnswer: string }> {
  const { onStatus, onChunk } = options;
  onStatus?.("answering");
  const model = getLangChainChatModel(LLMUseCases.SIMPLE_CHAT);

  const context = buildFormulaContext({ currentFormula: input.currentFormula });
  const systemPrompt = buildDirectChatSystemPrompt(context);

  const messages = [
    new SystemMessage(systemPrompt),
    ...toLangChainMessages(input.messages ?? []),
  ];

  let finalAnswer = "";
  const stream = await model.stream(messages);
  for await (const chunk of stream) {
    const text = langchainMessageContentToText(chunk.content);
    if (text) {
      finalAnswer += text;
      onChunk?.(text);
    }
  }

  return { finalAnswer };
}
