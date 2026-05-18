import { createDataStreamResponse, formatDataStreamPart } from "ai";
import { AgentModes } from "@/lib/ai/llm-config";
import { runDirectChat } from "@/lib/ai/formula-direct-chat";
import { runFormulaRag, type FormulaRagStatus } from "@/lib/ai/formula-rag-graph";
import {
  runClarificationAgent,
  type ClarificationAgentStatus,
} from "@/lib/ai/formula-clarification-graph";
import { ASSISTANT_STATUS_DATA_KEY } from "@/lib/ai/assistant-status";
import { CLARIFICATION_DATA_KEY } from "@/lib/ai/clarification-response";
import {
  ensureConversation,
  saveMessages,
  generateAndUpdateTitle,
} from "@/lib/chat-store";

export const maxDuration = 30;

const DEFAULT_FORMULA_SOURCE = (process.env.FORMULA_SOURCE ?? AgentModes.DIRECT) as string;

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

  const mode = formulaSource ?? DEFAULT_FORMULA_SOURCE;

  switch (mode) {
    case AgentModes.RAG:
      return handleRagChat(messages, formula ?? "", convId);
    case AgentModes.CLARIFICATION:
      return handleClarificationChat(messages, formula ?? "", convId);
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
      return String(error instanceof Error ? error.message : error);
    },
  });
}

async function handleRagChat(
  messages: { role: string; content: string }[],
  currentFormula: string,
  conversationId: string
) {
  return createDataStreamResponse({
    execute: async (writer) => {
      const onStatus = (status: FormulaRagStatus) => {
        writer.writeData({ [ASSISTANT_STATUS_DATA_KEY]: status });
      };
      const onChunk = (chunk: string) => {
        writer.write(formatDataStreamPart("text", chunk));
      };

      const result = await runFormulaRag({ messages, currentFormula }, { onStatus, onChunk });

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
      console.error("[chat/rag]", error);
      return String(error instanceof Error ? error.message : error);
    },
  });
}

async function handleClarificationChat(
  messages: { role: string; content: string }[],
  currentFormula: string,
  conversationId: string
) {
  return createDataStreamResponse({
    execute: async (writer) => {
      const onStatus = (status: ClarificationAgentStatus) => {
        writer.writeData({ [ASSISTANT_STATUS_DATA_KEY]: status });
      };
      const onChunk = (chunk: string) => {
        writer.write(formatDataStreamPart("text", chunk));
      };

      const result = await runClarificationAgent(
        { messages, currentFormula },
        { onStatus, onChunk }
      );

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
      console.error("[chat/clarification]", error);
      return String(error instanceof Error ? error.message : error);
    },
  });
}
