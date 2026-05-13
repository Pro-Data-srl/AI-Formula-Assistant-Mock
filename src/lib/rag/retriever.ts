import { desc, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import { db } from "@/db";
import { formulaDocs } from "@/db/schema";
import { embedQuery } from "./embeddings";

const DEFAULT_TOP_K = 9;
const MIN_SIMILARITY = 0.3;

export type RetrievedFormulaDoc = {
  id: number;
  name: string;
  content: string;
  category: string;
  signature: string;
  example: string;
  similarity: number;
};

/**
 * Semantic search over formula documentation using pgvector.
 * Returns docs ordered by cosine similarity (higher = more similar).
 */
export async function retrieveFormulaDocs(
  query: string,
  options: { topK?: number; minSimilarity?: number } = {}
): Promise<RetrievedFormulaDoc[]> {
  const { topK = DEFAULT_TOP_K, minSimilarity = MIN_SIMILARITY } = options;
  const embedding = await embedQuery(query);

  // Cosine distance in pgvector: <=> operator. Smaller = more similar.
  // similarity = 1 - distance (higher = better).
  const distance = cosineDistance(formulaDocs.embedding, embedding);
  const similarity = sql<number>`(1 - (${distance}))`;

  const rows = await db
    .select({
      id: formulaDocs.id,
      name: formulaDocs.name,
      content: formulaDocs.content,
      category: formulaDocs.category,
      signature: formulaDocs.signature,
      example: formulaDocs.example,
      similarity,
    })
    .from(formulaDocs)
    .where(sql`${similarity} >= ${minSimilarity}`)
    .orderBy(desc(similarity))
    .limit(topK);

  return rows as RetrievedFormulaDoc[];
}

/**
 * Retrieve formula docs for multiple queries in parallel, then merge and dedupe by name.
 */
export async function retrieveFormulaDocsForQueries(
  queries: string[],
  options: { topKPerQuery?: number } = {}
): Promise<RetrievedFormulaDoc[]> {
  const { topKPerQuery = 6 } = options;
  const results = await Promise.all(
    queries.map((q) => retrieveFormulaDocs(q, { topK: topKPerQuery }))
  );
  const byName = new Map<string, RetrievedFormulaDoc>();
  for (const list of results) {
    for (const doc of list) {
      const existing = byName.get(doc.name);
      if (!existing || doc.similarity > existing.similarity) {
        byName.set(doc.name, doc);
      }
    }
  }
  return Array.from(byName.values()).sort((a, b) => b.similarity - a.similarity);
}
