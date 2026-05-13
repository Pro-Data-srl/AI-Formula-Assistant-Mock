/**
 * LangChain tools for the formula agent.
 * askClarification is the Clarification tool (human-in-the-loop); the rest are formula tools.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { retrieveFormulaDocsForQueries } from "@/lib/rag/retriever";
import { validateFormula, evaluateFormula } from "@/lib/formula-executor";
import {
  MOCK_FIELDS,
  getMockFieldValues,
  getMockCollections,
  getMockSessionValues,
  getMockMemUserValues,
} from "@/data/fields";
import { FUNCTION_NAMES_SET } from "@/lib/formula-functions/registry";

const KNOWN_FIELD_NAMES = new Set(MOCK_FIELDS.map((f) => f.internalName));

export const retrieveDocsTool = tool(
  async ({ query }) => {
    const queries = typeof query === "string" ? [query] : Array.isArray(query) ? query : [String(query)];
    const docs = await retrieveFormulaDocsForQueries(queries, { topKPerQuery: 5 });
    return docs
      .map(
        (d) =>
          `${d.name}: ${d.signature} — ${d.content}${d.example ? ` (Beispiel: ${d.example})` : ""}`
      )
      .join("\n---\n");
  },
  {
    name: "retrieveDocs",
    description:
      "Funktionsdokumentation aus der Wissensdatenbank abrufen. Suchbegriffe für Formelfunktionen (z.B. 'addDays', 'Datum', 'Text').",
    schema: z.object({
      query: z
        .union([z.string(), z.array(z.string())])
        .describe("Suchbegriff(e) für Funktionsdokumentation"),
    }),
  }
);

export const validateFormulaTool = tool(
  async ({ formula }) => {
    const result = validateFormula(formula, {
      knownFunctionNames: FUNCTION_NAMES_SET,
      knownFieldInternalNames: KNOWN_FIELD_NAMES,
    });
    if (!result) return "OK: Formel ist syntaktisch gültig und verwendet nur bekannte Funktionen/Felder.";
    return `Fehler: ${result.message}${result.start != null ? ` (Zeichen ${result.start + 1})` : ""}`;
  },
  {
    name: "validateFormula",
    description:
      "Formel validieren: Syntax, unbekannte Funktionen/Felder, Arity-Fehler. Nutze vor dem Vorschlagen einer Formel.",
    schema: z.object({
      formula: z.string().describe("Die zu prüfende Formel"),
    }),
  }
);

export const evaluateFormulaTool = tool(
  async ({ formula }) => {
    const fieldValues = getMockFieldValues();
    const collections = getMockCollections();
    const sessionValues = getMockSessionValues();
    const memUserValues = getMockMemUserValues();
    const result = evaluateFormula(formula, {
      fieldValues,
      collections,
      sessionValues,
      memUserValues,
    });
    if (result.success) {
      return `Ergebnis: ${JSON.stringify(result.value)}`;
    }
    return `Laufzeitfehler: ${result.error}`;
  },
  {
    name: "evaluateFormula",
    description:
      "Formel mit Beispieldaten ausführen. Nutze um zu prüfen ob eine vorgeschlagene Formel korrekt läuft.",
    schema: z.object({
      formula: z.string().describe("Die auszuführende Formel"),
    }),
  }
);

/** Tool name for the Clarification tool (human-in-the-loop). */
export const ASK_CLARIFICATION_TOOL_NAME = "askClarification" as const;

/** Clarification tool: asks the user when intent is unclear. */
export const askClarificationTool = tool(
  async ({ question }) => {
    return question;
  },
  {
    name: ASK_CLARIFICATION_TOOL_NAME,
    description:
      "Rufe auf, wenn die Nutzerabsicht unklar ist: mehrdeutige Formulierung, fehlende Feldnamen, widersprüchliche Anforderungen. Stellt die Rückfrage an den Nutzer. Nicht aufrufen wenn du genug Kontext hast.",
    schema: z.object({
      question: z
        .string()
        .describe("Konkrete Rückfrage an den Nutzer (auf Deutsch, höflich formuliert)"),
    }),
  }
);

/** All agent tools: formula tools + Clarification tool. */
export const AGENT_TOOLS = [
  retrieveDocsTool,
  validateFormulaTool,
  evaluateFormulaTool,
  askClarificationTool,
];
