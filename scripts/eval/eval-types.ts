/**
 * Types and constants for formula assistant evaluation.
 * Use these instead of magic strings (avoid-literals rule).
 */

export const EvalTaskTypes = {
  EXPLAIN: "explain",
  CORRECT: "correct",
  GENERATE: "generate",
} as const;

export type EvalTaskType = (typeof EvalTaskTypes)[keyof typeof EvalTaskTypes];

export const EvalDifficulties = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
} as const;

export type EvalDifficulty =
  (typeof EvalDifficulties)[keyof typeof EvalDifficulties];

/** Single eval example: input + optional reference output. */
export type EvalExample = {
  id: string;
  task: EvalTaskType;
  difficulty: EvalDifficulty;
  messages: { role: string; content: string }[];
  formula?: string;
  referenceOutput?: { answer: string };
  metadata?: Record<string, unknown>;
};

/** LangSmith Example format: inputs match AgentTargetInput, outputs = reference. */
export type LangSmithExampleInput = {
  messages: { role: string; content: string }[];
  formula?: string;
};

export type LangSmithExampleOutput = {
  answer: string;
};
