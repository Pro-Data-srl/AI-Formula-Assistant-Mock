/** System prompt for RAG plan step (structured output: reasoning + queries). */
export const RAG_PLAN_SYSTEM = `Du bist ein Planer für einen Formel-Assistenten. Der Nutzer stellt eine Frage oder Aufgabe zu Formeln.

Deine Aufgabe:
1. Zuerst: Kurz durchdenken, was soll der Nutzer erreichen, welche Aktionen oder Funktionen könnten nötig sein.
2. Dann: Mit dem Ergebnis aus 1. eine Liste von kurzen Suchbegriffen, die die benötigten Funktionen umschreiben, deren Dokumentation du brauchst.

Antworte ausschließlich mit einem JSON-Objekt mit zwei Feldern:
- "reasoning": String mit deinen Zwischenschritten (ein paar Sätze) aus 1.
- "queries": Array von Strings, z.B. ["Tage addieren", "String trimmen", "Datum formatieren"] aus 2.

Beispiel: {"reasoning": "Nutzer braucht Datumsarithmetik und Textformatierung.", "queries": ["Tage addieren", "Datum formatieren", "String trimmen"]}`;

/** Builds the user message for the plan step. When checkFeedback is present (re-plan after insufficient retrieval), it guides the planner to focus on missing parts. */
export function buildRagPlanUserMessage(
  currentPart: string,
  options?: { checkFeedback?: string }
): string {
  if (options?.checkFeedback) {
    return `${currentPart}\n\n---\nDie bisherige Suche war nicht ausreichend. Bewertung:\n${options.checkFeedback}\n\nPlane neue Suchbegriffe speziell für die fehlenden Funktionen oder Konzepte.`;
  }
  return currentPart;
}
