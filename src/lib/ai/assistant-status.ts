/** Key for custom stream data part carrying assistant phase (RAG flow). */
export const ASSISTANT_STATUS_DATA_KEY = "assistant_status" as const;

export type AssistantStatusPhase =
  | "thinking"
  | "planning"
  | "retrieving"
  | "evaluating"
  | "answering"
  | "validating"
  | "clarifying";

const LABELS: Record<AssistantStatusPhase, string> = {
  thinking: "Denke nach",
  planning: "Planung",
  retrieving: "Dokumentation wird geladen",
  evaluating: "Auswertung",
  answering: "Antwort wird erstellt",
  validating: "Formel wird validiert",
  clarifying: "Rückfrage wird vorbereitet",
};

export function getAssistantStatusLabel(phase: AssistantStatusPhase): string {
  return LABELS[phase];
}
