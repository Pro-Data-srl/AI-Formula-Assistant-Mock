/**
 * RAG agent mode: delegates to the unified coordinator + tool-coordinator pipeline.
 */

import {
  runUnifiedFormulaAgent,
  type UnifiedFormulaAgentStatus,
  type UnifiedChatMessage,
} from "@/lib/ai/formula-unified-agent-graph";

export type FormulaRagStatus = UnifiedFormulaAgentStatus;

export type FormulaRagInput = {
  messages: { role: string; content: string }[];
  currentFormula?: string;
};

export type ChatMessage = UnifiedChatMessage;

export type FormulaRagResult =
  | { type: "answer"; finalAnswer: string }
  | { type: "clarification"; question: string };

export async function runFormulaRag(
  input: FormulaRagInput,
  options: { onStatus?: (status: FormulaRagStatus) => void; onChunk?: (chunk: string) => void } = {}
): Promise<FormulaRagResult> {
  return runUnifiedFormulaAgent(
    { messages: input.messages ?? [], currentFormula: input.currentFormula },
    options
  );
}
