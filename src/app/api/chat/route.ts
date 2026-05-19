import { createDataStreamResponse, formatDataStreamPart } from "ai";
import { AgentModes } from "@/lib/ai/llm-config";
import { runDirectChat } from "@/lib/ai/formula-direct-chat";
import { runGraphFormulaAgent, type GraphFormulaAgentStatus } from "@/lib/ai/formula-graph-agent";
import { runFreeFormulaAgent, type FreeFormulaAgentStatus } from "@/lib/ai/formula-free-agent";
import { ASSISTANT_STATUS_DATA_KEY } from "@/lib/ai/assistant-status";
import { CLARIFICATION_DATA_KEY } from "@/lib/ai/clarification-response";
import {
  ensureConversation,
  saveMessages,
  generateAndUpdateTitle,
} from "@/lib/chat-store";

export const maxDuration = 30;

const DEFAULT_FORMULA_SOURCE = (process.env.FORMULA_SOURCE ?? AgentModes.DIRECT) as string;

/**
 * Converts a raw error into a user-facing message string.
 * Handles known network/infrastructure error codes explicitly so the client
 * receives an actionable message instead of a raw stack trace or empty string.
 */
function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    // ECONNREFUSED is thrown when the database (or any downstream TCP service) is unreachable.
    if ("code" in error && error.code === "ECONNREFUSED") {
      return "Database connection refused — make sure the PostgreSQL container is running (`docker compose up -d`).";
    }
    return error.message || "An unexpected error occurred.";
  }
  return String(error);
}

/** Accepts legacy env values {@code rag} / {@code clarification} from older configs. */
function normalizeAgentMode(mode: string): string {
  if (mode === "rag") return AgentModes.GRAPH;
  if (mode === "clarification") return AgentModes.FREE;
  return mode;
}

export async function POST(req: Request) {
  const { messages, formula, formulaSource, conversationId } = (await req.json()) as {
    messages: { role: string; content: string }[];
    formula?: string;
    formulaSource?: string;
    conversationId?: string;
  };

  if (!messages?.length) {
    return new Response("Missing messages", { status: 400 });
  }

  const convId = conversationId ?? crypto.randomUUID();
  await ensureConversation(convId);

  const mode = normalizeAgentMode(formulaSource ?? DEFAULT_FORMULA_SOURCE);

  switch (mode) {
    case AgentModes.GRAPH:
      return handleGraphChat(messages, formula ?? "", convId);
    case AgentModes.FREE:
      return handleFreeChat(messages, formula ?? "", convId);
    default:
      return handleDirectChat(messages, formula, convId);
  }
}

async function handleDirectChat(
  messages: { role: string; content: string }[],
  formula: string | undefined,
  conversationId: string
) {
  return createDataStreamResponse({
    execute: async (writer) => {
      const onStatus = (status: "answering") => {
        writer.writeData({ [ASSISTANT_STATUS_DATA_KEY]: status });
      };
      const onChunk = (chunk: string) => {
        writer.write(formatDataStreamPart("text", chunk));
      };

      const { finalAnswer } = await runDirectChat(
        { messages, currentFormula: formula },
        { onStatus, onChunk }
      );

      const fullMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "assistant" as const, content: finalAnswer },
      ];
      await saveMessages(conversationId, fullMessages);
      const firstUser = messages.find((m) => m.role === "user");
      if (firstUser) {
        generateAndUpdateTitle(conversationId, firstUser.content).catch(() => {});
      }

      writer.write(
        formatDataStreamPart("finish_message", {
          finishReason: "stop",
          usage: undefined,
        })
      );
    },
    onError: (error) => {
      console.error("[chat/direct]", error);
      return formatApiError(error);
    },
  });
}

async function handleGraphChat(
  messages: { role: string; content: string }[],
  currentFormula: string,
  conversationId: string
) {
  return createDataStreamResponse({
    execute: async (writer) => {
      const onStatus = (status: GraphFormulaAgentStatus) => {
        writer.writeData({ [ASSISTANT_STATUS_DATA_KEY]: status });
      };
      const onChunk = (chunk: string) => {
        writer.write(formatDataStreamPart("text", chunk));
      };

      const result = await runGraphFormulaAgent({ messages, currentFormula }, { onStatus, onChunk });

      if (result.type === "clarification") {
        writer.writeData({ [CLARIFICATION_DATA_KEY]: { question: result.question } });
        writer.write(formatDataStreamPart("text", result.question));
        const fullMessages = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant" as const, content: result.question },
        ];
        await saveMessages(conversationId, fullMessages);
      } else {
        const fullMessages = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant" as const, content: result.finalAnswer },
        ];
        await saveMessages(conversationId, fullMessages);
      }
      const firstUser = messages.find((m) => m.role === "user");
      if (firstUser) {
        generateAndUpdateTitle(conversationId, firstUser.content).catch(() => {});
      }

      writer.write(
        formatDataStreamPart("finish_message", {
          finishReason: "stop",
          usage: undefined,
        })
      );
    },
    onError: (error) => {
      console.error("[chat/graph]", error);
      return formatApiError(error);
    },
  });
}

async function handleFreeChat(
  messages: { role: string; content: string }[],
  currentFormula: string,
  conversationId: string
) {
  return createDataStreamResponse({
    execute: async (writer) => {
      const onStatus = (status: FreeFormulaAgentStatus) => {
        writer.writeData({ [ASSISTANT_STATUS_DATA_KEY]: status });
      };
      const onChunk = (chunk: string) => {
        writer.write(formatDataStreamPart("text", chunk));
      };

      const result = await runFreeFormulaAgent({ messages, currentFormula }, { onStatus, onChunk });

      if (result.type === "clarification") {
        writer.writeData({ [CLARIFICATION_DATA_KEY]: { question: result.question } });
        writer.write(formatDataStreamPart("text", result.question));
        const fullMessages = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant" as const, content: result.question },
        ];
        await saveMessages(conversationId, fullMessages);
      } else {
        const fullMessages = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant" as const, content: result.finalAnswer },
        ];
        await saveMessages(conversationId, fullMessages);
      }

      writer.write(
        formatDataStreamPart("finish_message", {
          finishReason: "stop",
          usage: undefined,
        })
      );
    },
    onError: (error) => {
      console.error("[chat/free]", error);
      return formatApiError(error);
    },
  });
}
