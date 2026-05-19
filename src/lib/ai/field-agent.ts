/**
 * Graph field agent: maps coordinator queries to catalog fields (structured output; no tools).
 *
 * @author Lukas Alber
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { getLangChainChatModelForStructuredOutput, LLMUseCases } from "@/lib/ai/llm-config";
import { FIELD_AGENT_SYSTEM } from "@/lib/ai/prompting/field-agent";
import { MOCK_FIELDS, type DataField } from "@/data/fields";

const FieldResolveOutputSchema = z.object({
  fields: z.array(
    z.object({
      internalName: z.string(),
      name: z.string(),
      dataType: z.string(),
      handler: z.string(),
      constraints: z.string().optional(),
      rationale: z.string().optional(),
    })
  ),
});

export type ResolvedField = z.infer<typeof FieldResolveOutputSchema>["fields"][number];

const KNOWN_INTERNAL = new Set(MOCK_FIELDS.map((f) => f.internalName));

const fieldModel = getLangChainChatModelForStructuredOutput(LLMUseCases.FIELD_AGENT);
const structuredFieldModel = fieldModel.withStructuredOutput(FieldResolveOutputSchema);

function formatFieldCatalogEntry(f: DataField): string {
  const parts = [
    `- ${f.name} → field("${f.internalName}")`,
    `  Typ: ${f.dataType}, Handler: ${f.handler}`,
    `  Lesen: ${f.forReading}, Pflicht: ${f.required}`,
  ];
  if (f.constraints) parts.push(`  Einschränkungen: ${f.constraints}`);
  return parts.join("\n");
}

function formatFieldCatalog(): string {
  return MOCK_FIELDS.map(formatFieldCatalogEntry).join("\n");
}

/**
 * Resolves a natural-language field query against the mock catalog.
 * Drops any model output whose {@code internalName} is not in the catalog.
 */
export async function runFieldResolveAgent(query: string): Promise<ResolvedField[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const raw = await structuredFieldModel.invoke([
    new SystemMessage(FIELD_AGENT_SYSTEM),
    new HumanMessage(
      `## Feldkatalog\n${formatFieldCatalog()}\n\n## Anfrage vom Koordinator\n${trimmed}`
    ),
  ]);

  const parsed = FieldResolveOutputSchema.safeParse(raw);
  if (!parsed.success) return [];

  return parsed.data.fields.filter((f) => KNOWN_INTERNAL.has(f.internalName));
}
