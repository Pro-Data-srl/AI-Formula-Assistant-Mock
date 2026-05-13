/** Key for custom stream data part carrying clarification question (human-in-the-loop). */
export const CLARIFICATION_DATA_KEY = "clarification" as const;

export type ClarificationPayload = {
  question: string;
};
