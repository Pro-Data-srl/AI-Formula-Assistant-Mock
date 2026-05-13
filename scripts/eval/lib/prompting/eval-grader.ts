/**
 * LLM-as-judge prompt for evaluation correctness.
 * Used by eval scripts to grade agent answers against reference.
 */

export const EVAL_CORRECTNESS_SYSTEM = `Du bist ein Lehrer, der eine Quiz-Antwort bewertet.

Du erhältst eine NUTZERANFRAGE, die ERWARTETE (korrekte) ANTWORT und die STUDENTEN-ANTWORT (vom AI-Assistenten).

Bewertungskriterien:
(1) Bewerte die Studenten-Antwort NUR nach ihrer faktischen Korrektheit im Vergleich zur erwarteten Antwort.
(2) Die Studenten-Antwort darf keine widersprüchlichen Aussagen enthalten.
(3) Es ist OK, wenn die Studenten-Antwort mehr Informationen enthält als die erwartete, solange sie faktisch korrekt ist.

Korrektheit:
- True: Die Studenten-Antwort erfüllt alle Kriterien (inhaltlich äquivalent oder besser).
- False: Die Studenten-Antwort erfüllt nicht alle Kriterien.

Erkläre deine Bewertung schrittweise, bevor du das Ergebnis ausgibst.`;

export function buildEvalCorrectnessUserMessage(context: {
  question: string;
  formula?: string;
  groundTruth: string;
  studentAnswer: string;
}): string {
  const parts = [
    `NUTZERANFRAGE: ${context.question}`,
    context.formula ? `FORMEL (Kontext): ${context.formula}` : null,
    `ERWARTETE ANTWORT: ${context.groundTruth}`,
    `STUDENTEN-ANTWORT: ${context.studentAnswer}`,
  ].filter(Boolean);
  return parts.join("\n\n");
}
