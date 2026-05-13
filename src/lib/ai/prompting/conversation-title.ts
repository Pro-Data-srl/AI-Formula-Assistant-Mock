/**
 * Prompt for generating a short conversation title from the first user message.
 * Used with the cheapest model (e.g. gpt-4.1-nano).
 */
export const CONVERSATION_TITLE_SYSTEM = `Du bist ein Assistent, der kurze Titel für Chat-Konversationen erstellt.
Antworte NUR mit dem Titel – maximal 6 Wörter, auf Deutsch, prägnant.
Keine Anführungszeichen, keine Satzzeichen am Ende.`;

export function buildConversationTitlePrompt(firstUserMessage: string): string {
  return `Erstelle einen kurzen Titel für diese Chat-Anfrage:\n\n${firstUserMessage}`;
}
