/**
 * Shared input/output shape for eval scripts and LangSmith targets so **direct**, **graph**, and **free** agents can be invoked uniformly.
 */

import { AgentModes, type AgentMode } from "@/lib/ai/llm-config";
import { runDirectChat } from "@/lib/ai/formula-direct-chat";
import { runGraphFormulaAgent } from "@/lib/ai/formula-graph-agent";
import { runFreeFormulaAgent } from "@/lib/ai/formula-free-agent";

/** Shared input for all agent target functions. */
export type AgentTargetInput = {
  messages: { role: string; content: string }[];
  formula?: string;
};

/** Shared output for all agent target functions (LangSmith evaluate format). */
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

/** Run graph agent as target (sync, no streaming callbacks). */
export async function runGraphAsTarget(
  input: AgentTargetInput
): Promise<AgentTargetOutput> {
  const result = await runGraphFormulaAgent({
    messages: input.messages,
    currentFormula: input.formula ?? "",
  });
  if (result.type === "clarification") {
    return { answer: result.question };
  }
  return { answer: result.finalAnswer };
}

/** Run free agent as target (sync, no streaming callbacks). */
export async function runFreeAsTarget(
  input: AgentTargetInput
): Promise<AgentTargetOutput> {
  const result = await runFreeFormulaAgent({
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
    case AgentModes.GRAPH:
      return runGraphAsTarget(input);
    case AgentModes.FREE:
      return runFreeAsTarget(input);
    default:
      return runDirectChatSync(input);
  }
}
