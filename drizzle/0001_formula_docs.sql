-- Ensure pgvector extension exists (required for formula_docs.embedding)
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "formula_docs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"category" text NOT NULL,
	"signature" text NOT NULL,
	"example" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "formula_docs_embedding_idx" ON "formula_docs" USING hnsw ("embedding" vector_cosine_ops);
