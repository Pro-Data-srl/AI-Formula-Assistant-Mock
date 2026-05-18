/**
 * Graph agent mode: unified coordinator + tool-coordinator pipeline (embedded RAG retrieval tool).
 */

import {
  runUnifiedFormulaAgent,
  type UnifiedFormulaAgentStatus,
  type UnifiedChatMessage,
} from "@/lib/ai/formula-unified-agent-graph";

export type GraphFormulaAgentStatus = UnifiedFormulaAgentStatus;

export type GraphFormulaAgentInput = {
  messages: { role: string; content: string }[];
  currentFormula?: string;
};

export type ChatMessage = UnifiedChatMessage;

export type GraphFormulaAgentResult =
  | { type: "answer"; finalAnswer: string }
  | { type: "clarification"; question: string };

export async function runGraphFormulaAgent(
  input: GraphFormulaAgentInput,
  options: {
    onStatus?: (status: GraphFormulaAgentStatus) => void;
    onChunk?: (chunk: string) => void;
  } = {}
): Promise<GraphFormulaAgentResult> {
  return runUnifiedFormulaAgent(
    { messages: input.messages ?? [], currentFormula: input.currentFormula },
    options
  );
}
