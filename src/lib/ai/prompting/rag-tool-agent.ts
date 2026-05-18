/**
 * System prompt for the RAG post-retrieval tool agent (validate / evaluate / askClarification).
 */

import type { RagAnswerContext } from "./rag-answer";
import { buildRagAnswerSystemPrompt } from "./rag-answer";

/**
 * Same factual context as the RAG answer step, plus instructions for the tool phase after retrieval.
 * Omits {@code retrieveDocs}: retrieved snippets are already injected above.
 */
export function buildRagToolAgentSystemPrompt(ctx: RagAnswerContext): string {
  const base = buildRagAnswerSystemPrompt(ctx);
  return `${base}

## Tools (nach Abruf)
Die relevante Funktionsdokumentation wurde bereits geladen (siehe „Abgerufene Funktionsdokumentation“). **Kein** separates Abruf-Tool: verwende ausschließlich die oben genannten Auszüge.

Verfügbare Tools:
- **validateFormula**: Formel prüfen (Syntax, unbekannte Funktionen/Felder)
- **evaluateFormula**: Formel mit Beispieldaten testen
- **askClarification**: Rückfrage an den Nutzer, wenn die Absicht unklar ist

## Ablauf
1. Nutze **validateFormula** und **evaluateFormula**, sobald du eine konkrete Formel prüfen oder testen sollst.
2. Bei unklarer Nutzerabsicht: **askClarification** mit einer präzisen Rückfrage.
3. Wenn du eine fertige Lösung hast: formuliere sie in deiner Antwort klar (inkl. vollständiger Formel in einem Code-Block wie oben).`;
}
