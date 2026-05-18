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
import { getLangChainChatModel, LLMUseCases } from "@/lib/ai/llm-config";
import { langchainMessageContentToText } from "@/lib/ai/langchain-message-content";
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
  onStatus?.("thinking");

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
  const result = await agent.invoke(
    { messages: invokeMessages },
    { recursionLimit: 40 }
  );

  const msgs = (result as { messages?: BaseMessage[] }).messages ?? [];

  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (isToolMessage(m) && m.name === ASK_CLARIFICATION_TOOL_NAME) {
      const q = typeof m.content === "string" ? m.content : "";
      onStatus?.("clarifying");
      return { type: "clarification", question: q.trim() || "Könnten Sie bitte präzisieren?" };
    }
  }

  const lastAi = [...msgs].reverse().find(isAIMessage);
  const agentConclusion = lastAi ? langchainMessageContentToText(lastAi.content) : "";

  onStatus?.("answering");
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
