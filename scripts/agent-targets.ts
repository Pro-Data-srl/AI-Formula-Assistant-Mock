/**
 * Unified interface for agent target functions (Eval-Scripts, LangSmith evaluate).
 * All three agents (direct, RAG, Clarification) can be invoked with the same input/output shape.
 */

import {
  AgentModes,
  type AgentMode,
} from "@/lib/ai/llm-config";
import { runDirectChat } from "@/lib/ai/formula-direct-chat";
import { runFormulaRag } from "@/lib/ai/formula-rag-graph";
import { runClarificationAgent } from "@/lib/ai/formula-clarification-graph";

/** Unified input for all agent target functions. */
export type AgentTargetInput = {
  messages: { role: string; content: string }[];
  formula?: string;
};

/** Unified output for all agent target functions (LangSmith evaluate format). */
export type AgentTargetOutput = {
  answer: string;
};

/** Run Direct agent synchronously (no streaming). For eval scripts and LangSmith target functions. */
export async function runDirectChatSync(
  input: AgentTargetInput
): Promise<AgentTargetOutput> {
  const { finalAnswer } = await runDirectChat({
    messages: input.messages,
    currentFormula: input.formula,
  });
  return { answer: finalAnswer };
}

/** Run RAG agent as target (sync, no streaming callbacks). */
export async function runRagAsTarget(
  input: AgentTargetInput
): Promise<AgentTargetOutput> {
  const { finalAnswer } = await runFormulaRag({
    messages: input.messages,
    currentFormula: input.formula ?? "",
  });
  return { answer: finalAnswer };
}

/** Run Clarification agent as target (sync, no streaming callbacks). */
export async function runClarificationAsTarget(
  input: AgentTargetInput
): Promise<AgentTargetOutput> {
  const result = await runClarificationAgent({
    messages: input.messages,
    currentFormula: input.formula ?? "",
  });
  if (result.type === "clarification") {
    return { answer: result.question };
  }
  return { answer: result.finalAnswer };
}

/** Run any agent by mode. Single entry point for eval scripts and LangSmith target functions. */
export async function runAgentAsTarget(
  mode: AgentMode,
  input: AgentTargetInput
): Promise<AgentTargetOutput> {
  switch (mode) {
    case AgentModes.DIRECT:
      return runDirectChatSync(input);
    case AgentModes.RAG:
      return runRagAsTarget(input);
    case AgentModes.CLARIFICATION:
      return runClarificationAsTarget(input);
    default:
      return runDirectChatSync(input);
  }
}
