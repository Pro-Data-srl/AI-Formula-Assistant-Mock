import { FORMULA_FUNCTIONS } from "@/lib/formula-functions/registry";
import { MOCK_FIELDS } from "@/data/fields";

/**
 * Builds context string for the formula assistant.
 * Used in system prompt. RAG can augment this later.
 */
export function buildFormulaContext(options: {
  currentFormula?: string;
  fields?: { name: string; internalName: string }[];
}): string {
  const { currentFormula = "", fields = MOCK_FIELDS } = options;

  const functionList = FORMULA_FUNCTIONS.map(
    (f) =>
      `- ${f.name}: ${f.signature} — ${f.description} (Beispiel: ${f.example})`
  ).join("\n");

  const fieldList = fields
    .map((f) => `- ${f.name} (field("${f.internalName}"))`)
    .join("\n");

  const parts: string[] = [
    "## Verfügbare Funktionen (Formel-Subset)",
    functionList,
    "",
    "## Verfügbare Felder",
    fieldList,
  ];

  if (currentFormula.trim()) {
    parts.unshift(
      "## Aktuelle Formel (vollständig – bei Änderungen diese als Ganzes anpassen, nicht nur einen Teil zurückgeben)",
      currentFormula,
      ""
    );
  }

  return parts.join("\n");
}
