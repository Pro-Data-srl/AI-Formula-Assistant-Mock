/**
 * Graph capability dispatcher: runs coordinator requests in parallel (RAG, fields, validate, evaluate, clarify).
 *
 * @author Lukas Alber
 */

import { validateFormula, evaluateFormula } from "@/lib/formula-executor";
import { FUNCTION_NAMES_SET } from "@/lib/formula-functions/registry";
import {
  MOCK_FIELDS,
  getMockFieldValues,
  getMockCollections,
  getMockSessionValues,
  getMockMemUserValues,
} from "@/data/fields";
import { runRagRetrievalOnly, type RagRetrievalChatMessage } from "@/lib/ai/rag-retrieval-only";
import { runFieldResolveAgent } from "@/lib/ai/field-agent";
/** Status phases emitted while running a single capability (mapped to graph UI in the state graph). */
export type GraphCapabilityStatus =
  | "planning"
  | "retrieving"
  | "evaluating"
  | "validating"
  | "resolving_fields"
  | "clarifying";

const KNOWN_FIELD_NAMES = new Set(MOCK_FIELDS.map((f) => f.internalName));

export type CapabilityRequest =
  | { type: "function_rag"; goal: string }
  | { type: "resolve_fields"; query: string }
  | { type: "validate"; formula: string }
  | { type: "evaluate"; formula: string }
  | { type: "clarify"; question: string };

export type CapabilityResultItem =
  | { type: "function_rag"; goal: string; fulfilled: boolean; docs: { name: string; signature: string; excerpt: string }[] }
  | { type: "resolve_fields"; query: string; fields: Awaited<ReturnType<typeof runFieldResolveAgent>> }
  | { type: "validate"; formula: string; ok: true } | { type: "validate"; formula: string; ok: false; message: string }
  | { type: "evaluate"; formula: string; ok: true; value: unknown } | { type: "evaluate"; formula: string; ok: false; error: string }
  | { type: "clarify"; question: string };

export type RunCapabilitiesOutcome =
  | { kind: "results"; items: CapabilityResultItem[] }
  | { kind: "clarify"; question: string };

export type RunCapabilitiesInput = {
  requests: CapabilityRequest[];
  messages: RagRetrievalChatMessage[];
  currentFormula: string;
  onStatus?: (status: GraphCapabilityStatus) => void;
};

async function runOneCapability(
  req: CapabilityRequest,
  ctx: Omit<RunCapabilitiesInput, "requests">
): Promise<CapabilityResultItem> {
  const { messages, currentFormula, onStatus } = ctx;

  switch (req.type) {
    case "function_rag": {
      onStatus?.("planning");
      const { retrievedDocs, fulfilled } = await runRagRetrievalOnly(
        {
          messages,
          currentFormula,
          coordinatorFocus: req.goal,
        },
        {
          onStatus: (phase) => {
            if (phase === "planning") onStatus?.("planning");
            if (phase === "retrieving") onStatus?.("retrieving");
            if (phase === "evaluating") onStatus?.("evaluating");
          },
        }
      );
      return {
        type: "function_rag",
        goal: req.goal,
        fulfilled,
        docs: retrievedDocs.map((d) => ({
          name: d.name,
          signature: d.signature,
          excerpt: d.content.slice(0, 280) + (d.content.length > 280 ? "…" : ""),
        })),
      };
    }
    case "resolve_fields": {
      onStatus?.("resolving_fields");
      const fields = await runFieldResolveAgent(req.query);
      return { type: "resolve_fields", query: req.query, fields };
    }
    case "validate": {
      onStatus?.("validating");
      const err = validateFormula(req.formula, {
        knownFunctionNames: FUNCTION_NAMES_SET,
        knownFieldInternalNames: KNOWN_FIELD_NAMES,
      });
      if (!err) return { type: "validate", formula: req.formula, ok: true };
      return {
        type: "validate",
        formula: req.formula,
        ok: false,
        message: `${err.message}${err.start != null ? ` (Zeichen ${err.start + 1})` : ""}`,
      };
    }
    case "evaluate": {
      onStatus?.("evaluating");
      const result = evaluateFormula(req.formula, {
        fieldValues: getMockFieldValues(),
        collections: getMockCollections(),
        sessionValues: getMockSessionValues(),
        memUserValues: getMockMemUserValues(),
      });
      if (result.success) {
        return { type: "evaluate", formula: req.formula, ok: true, value: result.value };
      }
      return { type: "evaluate", formula: req.formula, ok: false, error: result.error };
    }
    case "clarify":
      onStatus?.("clarifying");
      return { type: "clarify", question: req.question };
  }
}

/**
 * Runs capability requests in parallel. If any request is {@code clarify}, only that request runs (HITL).
 */
export async function runGraphCapabilities(input: RunCapabilitiesInput): Promise<RunCapabilitiesOutcome> {
  const { requests } = input;
  if (requests.length === 0) {
    return { kind: "results", items: [] };
  }

  const clarify = requests.find((r) => r.type === "clarify");
  const toRun = clarify ? [clarify] : requests;

  const ctx = {
    messages: input.messages,
    currentFormula: input.currentFormula,
    onStatus: input.onStatus,
  };

  const items = await Promise.all(toRun.map((r) => runOneCapability(r, ctx)));

  const clarifyItem = items.find((i) => i.type === "clarify");
  if (clarifyItem && clarifyItem.type === "clarify") {
    return {
      kind: "clarify",
      question: clarifyItem.question.trim() || "Könnten Sie bitte präzisieren?",
    };
  }

  return { kind: "results", items };
}

/** Formats capability results for the planning coordinator thread. */
export function formatCapabilityResults(items: CapabilityResultItem[]): string {
  if (items.length === 0) return "(Keine Fähigkeitsergebnisse.)";

  return items
    .map((item) => {
      switch (item.type) {
        case "function_rag": {
          const docLines =
            item.docs.length > 0
              ? item.docs.map((d) => `- **${d.name}** \`${d.signature}\`: ${d.excerpt}`).join("\n")
              : "(keine Treffer)";
          return `### function_rag — ${item.goal}\nAusreichend: ${item.fulfilled ? "ja" : "nein"}\n${docLines}`;
        }
        case "resolve_fields": {
          if (item.fields.length === 0) {
            return `### resolve_fields — ${item.query}\n(keine passenden Felder)`;
          }
          const lines = item.fields.map(
            (f) =>
              `- **${f.name}** → \`field("${f.internalName}")\` (${f.dataType}, ${f.handler})${f.rationale ? ` — ${f.rationale}` : ""}`
          );
          return `### resolve_fields — ${item.query}\n${lines.join("\n")}`;
        }
        case "validate":
          return item.ok
            ? `### validate\nFormel OK.`
            : `### validate\nFehler: ${item.message}`;
        case "evaluate":
          return item.ok
            ? `### evaluate\nErgebnis: ${JSON.stringify(item.value)}`
            : `### evaluate\nLaufzeitfehler: ${item.error}`;
        case "clarify":
          return `### clarify\n${item.question}`;
      }
    })
    .join("\n\n");
}
