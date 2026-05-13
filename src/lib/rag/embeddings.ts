import { EMBEDDING_DIMENSIONS } from "@/db/schema";
import { getLangChainEmbeddings } from "@/lib/ai/llm-config";

/**
 * Shared embeddings model for formula docs (centralized config).
 * Uses dimensions from schema; provider and model via EMBEDDINGS env (e.g. openai:text-embedding-3-small).
 */
export const formulaEmbeddings = getLangChainEmbeddings({
  dimensions: EMBEDDING_DIMENSIONS,
  stripNewLines: true,
});

export async function embedQuery(text: string): Promise<number[]> {
  return formulaEmbeddings.embedQuery(text);
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return formulaEmbeddings.embedDocuments(texts);
}
