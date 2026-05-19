import { FORMULA_FUNCTIONS } from "@/lib/formula-functions/registry";
import { MOCK_FIELDS } from "@/data/fields";

export type FormulaFieldRef = { name: string; internalName: string };

/**
 * Markdown list of available data fields for prompts (display name → internal `field("…")` name).
 */
export function buildFieldListContext(
  fields: FormulaFieldRef[] = MOCK_FIELDS
): string {
  return fields.map((f) => `- ${f.name} (field("${f.internalName}"))`).join("\n");
}

/**
 * Builds context string for the formula assistant.
 * Used in system prompt. RAG can augment this later.
 */
export function buildFormulaContext(options: {
  currentFormula?: string;
  fields?: FormulaFieldRef[];
}): string {
  const { currentFormula = "", fields = MOCK_FIELDS } = options;

  const functionList = FORMULA_FUNCTIONS.map(
    (f) =>
      `- ${f.name}: ${f.signature} — ${f.description} (Beispiel: ${f.example})`
  ).join("\n");

  const fieldList = buildFieldListContext(fields);

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
