/**
 * Graph agent mode: thin wrapper around the unified coordinator + tool-coordinator pipeline
 * (embedded RAG retrieval as a tool).
 *
 * **“Graph” vs LangGraph:** orchestration lives in `formula-unified-agent-graph.ts` (`runUnifiedFormulaAgent`:
 * coordinator rounds, structured output, deterministic review, polish stream). That file does **not**
 * compile a top-level LangGraph `StateGraph`. LangGraph is used inside `tool-coordinator-phase.ts` via
 * `ToolNode` from `@langchain/langgraph/prebuilt` to run tool calls in the tool-coordinator loop.
 *
 * @see `formula-unified-agent-graph.ts` — main control flow
 * @see `tool-coordinator-phase.ts` — `ToolNode` + tool execution loop
 */

import {
  runUnifiedFormulaAgent,
  type UnifiedFormulaAgentStatus,
  type UnifiedChatMessage,
} from "@/lib/ai/formula-unified-agent-graph";

/** Same lifecycle phases as {@link UnifiedFormulaAgentStatus}; kept as a stable public name for graph mode. */
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
