/**
 * Clarification agent mode: same unified pipeline as RAG (coordinator + tool coordinator + review gate).
 */

import {
  runUnifiedFormulaAgent,
  type UnifiedFormulaAgentStatus,
  type UnifiedChatMessage,
} from "@/lib/ai/formula-unified-agent-graph";

export type ClarificationAgentStatus = UnifiedFormulaAgentStatus;

export type ClarificationAgentInput = {
  messages: { role: string; content: string }[];
  currentFormula?: string;
};

export type ChatMessage = UnifiedChatMessage;

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
  return runUnifiedFormulaAgent(
    { messages: input.messages ?? [], currentFormula: input.currentFormula },
    options
  );
}
