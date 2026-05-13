import { Document } from "@langchain/core/documents";
import { FORMULA_FUNCTIONS } from "@/lib/formula-functions/registry";

/**
 * Converts formula function definitions to LangChain documents for RAG.
 * Content is searchable text; metadata holds structured info.
 */
export function getFunctionDocuments(): Document[] {
  return FORMULA_FUNCTIONS.map((fn) => {
    const content = [
      `Funktion: ${fn.name}`,
      `Kategorie: ${fn.category}`,
      `Signatur: ${fn.signature}`,
      `Beschreibung: ${fn.description}`,
      fn.parameters.length > 0
        ? `Parameter: ${fn.parameters.map((p) => `${p.name}: ${p.description}`).join("; ")}`
        : "",
      `Rückgabewert: ${fn.returnValue}`,
      `Beispiel: ${fn.example}`,
    ]
      .filter(Boolean)
      .join("\n");

    return new Document({
      pageContent: content,
      metadata: {
        name: fn.name,
        category: fn.category,
        signature: fn.signature,
        example: fn.example,
      },
    });
  });
}
