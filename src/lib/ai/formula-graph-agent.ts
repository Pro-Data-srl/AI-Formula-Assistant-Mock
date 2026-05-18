/**
 * Graph agent mode: public entry for the LangGraph-based two-LLM pipeline (see {@link invokeGraphFormulaAgent}).
 *
 * @see `formula-graph-stategraph.ts` — {@link StateGraph} nodes, conditional edges, and {@code compile}
 */

import {
  invokeGraphFormulaAgent,
  type GraphAgentChatMessage,
  type GraphFormulaAgentStatus,
  type GraphFormulaAgentResult,
} from "@/lib/ai/formula-graph-stategraph";

export type { GraphFormulaAgentStatus, GraphFormulaAgentResult };

export type GraphFormulaAgentInput = {
  messages: { role: string; content: string }[];
  currentFormula?: string;
};

export type ChatMessage = GraphAgentChatMessage;

export async function runGraphFormulaAgent(
  input: GraphFormulaAgentInput,
  options: {
    onStatus?: (status: GraphFormulaAgentStatus) => void;
    onChunk?: (chunk: string) => void;
  } = {}
): Promise<GraphFormulaAgentResult> {
  return invokeGraphFormulaAgent(
    { messages: input.messages ?? [], currentFormula: input.currentFormula },
    options
  );
}
