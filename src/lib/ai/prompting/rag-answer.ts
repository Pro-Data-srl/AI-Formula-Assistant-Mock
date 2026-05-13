export type RagAnswerDoc = {
  name: string;
  signature: string;
  content: string;
  example: string;
};

export type RagAnswerField = { name: string; internalName: string };

export type RagAnswerContext = {
  retrievedDocs: RagAnswerDoc[];
  fields: RagAnswerField[];
  currentFormula?: string;
};

function formatDocContext(docs: RagAnswerDoc[]): string {
  if (docs.length === 0) return "Keine spezifische Funktionsdokumentation abgerufen.";
  return docs
    .map((d) => `- ${d.name}: ${d.signature} — ${d.content} (Beispiel: ${d.example})`)
    .join("\n");
}

function formatFieldList(fields: RagAnswerField[]): string {
  return fields.map((f) => `- ${f.name} (field("${f.internalName}"))`).join("\n");
}

/** System prompt for RAG answer step (with retrieved docs and fields). */
export function buildRagAnswerSystemPrompt(options: RagAnswerContext): string {
  const { retrievedDocs, fields, currentFormula } = options;
  const docContext = formatDocContext(retrievedDocs);
  const fieldList = formatFieldList(fields);
  return `Du bist ein Assistent für Formeln. Antworte auf Deutsch. Nutze ausschließlich die folgenden Informationen.

## Abgerufene Funktionsdokumentation
${docContext}

## Verfügbare Felder
${fieldList}
${currentFormula ? `\n## Aktuelle Formel\n${currentFormula}\n` : ""}

## Wichtig: Vollständige Formel in Code-Blöcken
Bei geänderter oder korrigierter Formel immer die **vollständige** Formel in einem Code-Block angeben.
Operatoren: + - * / % ; == != < > <= >= ; && || ! ; field("Feldname") ; funktion(arg1, arg2)`;
}
