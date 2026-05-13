/** System prompt for RAG check step (sufficiency of retrieved docs). Output is structured (sufficient: boolean). */
export const RAG_CHECK_SYSTEM = `Du bewertest, ob die abgerufene Formel-Dokumentation die richtige ist, um die Nutzerfrage zu beantworten.
Gib an, ob für die Nutzerfrage alle relevanten Funktionen beschrieben sind (sufficient: true) oder nicht (sufficient: false). Es ist irrelevant, wie du die Dokumentation bewertest, sondern nur ob alle relevanten Funktionen minimal beschrieben sind.`;

export type ChatMessageForContext = { role: string; content: string };

export function buildRagCheckUserMessage(
  messages: ChatMessageForContext[],
  contextSnippet: string
): string {
  const history =
    messages.length === 0
      ? ""
      : messages
          .map((m) => `${m.role === "user" ? "Nutzer" : "Assistent"}: ${m.content}`)
          .join("\n\n");
  const contextBlock = history ? `Kontext (Chat-Verlauf):\n${history}\n\n` : "";
  return `${contextBlock}Abgerufene Doku (Auszug):\n${contextSnippet}\n\nSind alle relevanten Funktionen beschrieben, um die letzte Nutzerfrage zu beantworten?`;
}
