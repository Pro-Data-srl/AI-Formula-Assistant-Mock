import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  serial,
  vector,
} from "drizzle-orm/pg-core";

/** Embedding dimensions for OpenAI text-embedding-3-small / ada-002 */
export const EMBEDDING_DIMENSIONS = 1536;

export const formulaDocs = pgTable(
  "formula_docs",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    category: text("category").notNull(),
    signature: text("signature").notNull(),
    example: text("example").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("formula_docs_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);

export type FormulaDoc = typeof formulaDocs.$inferSelect;
export type NewFormulaDoc = typeof formulaDocs.$inferInsert;

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
