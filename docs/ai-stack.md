# AI Stack: Vercel AI SDK & LangChain

**Last updated: 2025-03-17**

> **Maintenance:** If this document is older than 3 months, check the changelogs for updates and refresh this rule:
> - [Vercel AI SDK changelog](https://github.com/vercel/ai/releases)
> - [LangChain.js changelog](https://github.com/langchain-ai/langchainjs/releases)

How we use Vercel AI SDK and LangChain, and how to avoid deprecated APIs.

## Packages (package.json)

| Package | Purpose |
|---------|---------|
| `ai` | Core AI SDK: `streamText`, `createDataStreamResponse`, `formatDataStreamPart` (server/API routes) |
| `@ai-sdk/react` | React hooks: `useChat`, `useCompletion`, `useAssistant` (client) |
| `@ai-sdk/openai` | OpenAI provider for Vercel AI SDK |
| `@ai-sdk/anthropic` | Anthropic provider for Vercel AI SDK |
| `@langchain/openai` | LangChain OpenAI (ChatOpenAI, OpenAIEmbeddings) |
| `@langchain/anthropic` | LangChain Anthropic |
| `@langchain/core` | LangChain core (messages, documents) |
| `@langchain/langgraph` | LangGraph for RAG flow (plan → retrieve → check → answer) |
| `@langchain/community` | LangChain community (e.g. pgvector) |

## Import Rules

### ✅ Use these

```ts
// Client (React components)
import { useChat } from "@ai-sdk/react";

// Server (API routes, server components)
import { streamText, createDataStreamResponse, formatDataStreamPart } from "ai";

// LLM providers (Vercel AI SDK style)
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

// LangChain (RAG graph, embeddings)
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
```

### ❌ Avoid (deprecated)

```ts
// DEPRECATED – use @ai-sdk/react instead
import { useChat } from "ai/react";
```

The `ai/react` export is deprecated. Use `@ai-sdk/react` for `useChat`, `useCompletion`, `useAssistant`.

## When to Use What

| Use case | Package | Example |
|----------|---------|---------|
| Chat UI (streaming, client) | `@ai-sdk/react` | `useChat` in AssistantChat |
| Direct chat API (LangChain) | `@langchain/*` | `formula-direct-chat.ts`; same streaming pattern as RAG |
| RAG graph (LangGraph) | `@langchain/*` | `formula-rag-graph.ts` |
| Embeddings (pgvector) | `@langchain/openai` | `formulaEmbeddings` |
| Provider config (Vercel) | `@ai-sdk/openai` | `getVercelAIChatModel` in llm-config |
| Provider config (LangChain) | `@langchain/openai` | `getLangChainChatModel` in llm-config |
| Title generation (cheapest) | `@ai-sdk/openai` | `getVercelAITitleModel`; env `TITLE_LLM` (default: `openai:gpt-5-nano`) |

We use **both** Vercel AI SDK and LangChain:
- **Vercel AI** for client hooks (`useChat`) and title generation (`getVercelAITitleModel`)
- **LangChain** for all chat agents (Direct, RAG, Clarification): `formula-direct-chat.ts`, `formula-rag-graph.ts` / `formula-clarification-graph.ts` (both call `formula-unified-agent-graph.ts` — planning **coordinator** LLM without tools, **tool-coordinator** LLM with tools including embedded RAG retrieval, deterministic validate/evaluate gate, then polish stream); LangSmith tracing for all. Env: `COORDINATOR_LLM`, `TOOL_COORDINATOR_LLM`, `AGENTIC_RAG_LLM` (inner plan/check), `CLARIFICATION_CHAT_LLM` (polish).

## Common Deprecations

| Deprecated | Replacement |
|------------|-------------|
| `ai/react` | `@ai-sdk/react` |
| `experimental_providerMetadata` | `providerOptions` / `providerMetadata` |
| `experimental_toolCallStreaming` | `toolCallStreaming` |

## References

- [Vercel AI SDK](https://ai-sdk.dev/docs)
- [AI SDK React](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [LangChain.js](https://js.langchain.com/)
- [LangGraph](https://langchain-ai.github.io/langgraph/)
