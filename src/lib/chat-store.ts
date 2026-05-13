import { eq, desc } from "drizzle-orm";
import { generateText } from "ai";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import type { NewConversation } from "@/db/schema";
import { getVercelAITitleModel } from "@/lib/ai/llm-config";
import {
  CONVERSATION_TITLE_SYSTEM,
  buildConversationTitlePrompt,
} from "@/lib/ai/prompting/conversation-title";

export type ChatMessageForStore = { id?: string; role: string; content: string };

/** Ensure conversation exists; create with given id if not. Returns true if created. */
export async function ensureConversation(id: string): Promise<boolean> {
  const existing = await db.query.conversations.findFirst({
    where: eq(conversations.id, id),
  });
  if (existing) return false;
  await db.insert(conversations).values({
    id: id as NewConversation["id"],
    title: null,
  });
  return true;
}

/** Load messages for a conversation, ordered by createdAt. */
export async function loadMessages(conversationId: string) {
  const rows = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: [messages.createdAt],
  });
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
  }));
}

/** Save messages for a conversation. Replaces all existing messages. */
export async function saveMessages(
  conversationId: string,
  msgs: ChatMessageForStore[]
) {
  await db.delete(messages).where(eq(messages.conversationId, conversationId));
  if (msgs.length === 0) return;
  await db.insert(messages).values(
    msgs.map((m) => ({
      conversationId,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }))
  );
}

/** List recent conversations with title and createdAt. */
export async function listConversations(limit = 50) {
  const rows = await db.query.conversations.findMany({
    orderBy: [desc(conversations.createdAt)],
    limit,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? formatFallbackTitle(r.createdAt),
    createdAt: r.createdAt,
  }));
}

function formatFallbackTitle(createdAt: Date): string {
  return `Chat vom ${createdAt.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;
}

/** Update conversation title. */
export async function updateTitle(
  conversationId: string,
  title: string
): Promise<void> {
  await db
    .update(conversations)
    .set({ title: title.trim().slice(0, 200) })
    .where(eq(conversations.id, conversationId));
}

/** Generate title from first user message using cheapest LLM. Fire-and-forget. */
export async function generateAndUpdateTitle(
  conversationId: string,
  firstUserMessage: string
): Promise<void> {
  const trimmed = firstUserMessage.trim().slice(0, 500);
  if (!trimmed) return;
  try {
    const { text } = await generateText({
      model: getVercelAITitleModel(),
      system: CONVERSATION_TITLE_SYSTEM,
      prompt: buildConversationTitlePrompt(trimmed),
    });
    const title = text?.trim().slice(0, 200);
    if (title) await updateTitle(conversationId, title);
  } catch (err) {
    console.error("[chat-store] Title generation failed:", err);
  }
}
