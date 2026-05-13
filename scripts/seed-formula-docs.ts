/**
 * Seed formula_docs table with embedded function documentation.
 * Run after db:migrate. Requires OPENAI_API_KEY and DATABASE_URL.
 *
 * Usage (from project root): npx tsx scripts/seed-formula-docs.ts
 * Or with env: node --env-file=.env --import tsx scripts/seed-formula-docs.ts
 * TODO: Later shall be a python notebook to generate the embeddings and seed the database.
 */
import { config } from "dotenv";
config(); // load .env if present
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { getFunctionDocuments } from "../src/lib/rag/function-docs";
import { embedDocuments } from "../src/lib/rag/embeddings";
import { formulaDocs } from "../src/db/schema";

const BATCH_SIZE = 10;

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://formel:formel@localhost:5433/formel_assistent";

async function main() {
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const docs = getFunctionDocuments();
    if (docs.length === 0) {
      console.log("No function documents to seed.");
      return;
    }

    const texts = docs.map((d) => d.pageContent);
    const metadatas = docs.map((d) => d.metadata as { name: string; category: string; signature: string; example: string });

    console.log(`Embedding ${texts.length} documents...`);
    const embeddings = await embedDocuments(texts);

    console.log("Clearing existing formula_docs...");
    await db.delete(formulaDocs);

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const embChunk = embeddings.slice(i, i + BATCH_SIZE);
      const metaChunk = metadatas.slice(i, i + BATCH_SIZE);
      await db.insert(formulaDocs).values(
        chunk.map((d, j) => ({
          name: metaChunk[j].name,
          content: d.pageContent,
          embedding: embChunk[j],
          category: metaChunk[j].category,
          signature: metaChunk[j].signature,
          example: metaChunk[j].example,
        }))
      );
      console.log(`Inserted ${Math.min(i + BATCH_SIZE, docs.length)} / ${docs.length}`);
    }

    console.log("Done. formula_docs seeded.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
