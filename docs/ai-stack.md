# AI Stack: Vercel AI SDK & LangChain

**Last updated: 2026-05-18**

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
| `@langchain/langgraph` | **`ToolNode`** (`@langchain/langgraph/prebuilt`) in the tool coordinator; the graph agent has **no** top-level compiled **`StateGraph`** in app code |
| `langchain` | High-level agents (`createAgent`) for the **free** agent mode |
| `@langchain/community` | LangChain community (e.g. pgvector) |

### `langchain` vs `@langchain/core`

The **`langchain`** package is not redundant with **`@langchain/core`**. Core holds shared primitives (messages, documents, runnables, tracing hooks). High-level **agents** such as **`createAgent`** (used in `formula-free-agent.ts`) are exported from **`langchain`**, not from core. Dropping `langchain` would mean reimplementing that agent loop or wiring an equivalent graph by hand.

**Version alignment:** LangChain.js publishes **`@langchain/*`** and **`langchain`** on independent semver lines that still target the same major (`1.x` today). The **`langchain`** package declares a **peer dependency** on a compatible **`@langchain/core`** range; npm resolves one shared `@langchain/core` for the tree (see `package-lock.json` after `npm install`). Keep all LangChain packages on the **same major** and refresh the lockfile when bumping `langchain` so peers stay satisfied.

### Graph mode vs LangGraph `StateGraph`

| Term | Meaning in this repo |
|------|----------------------|
| **`FORMULA_SOURCE=graph`** (legacy: `rag`) | API name for the **two-LLM** pipeline (planning coordinator → tool coordinator → deterministic gate → polish). |
| **Unified** | One pipeline file (`formula-unified-agent-graph.ts`) that **unifies** those steps and shared status phases — not “unified LangGraph runtime”. |
| **LangGraph today** | **`ToolNode`** in `tool-coordinator-phase.ts` only; **no** `.addNode` / `.addEdge` / `.compile()` for the outer agent. |
| **Free agent** | LangChain **`createAgent`** ReAct loop (`formula-free-agent.ts`) — different implementation style from graph mode. |
| **Future (product direction)** | Express graph-mode orchestration as an iterated **`StateGraph`** so control flow is graph-native, not only hand-written loops. Tracked in `docs/roadmap.md` (section 3.7). |

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

// LangChain (embeddings, graph-mode tool batching)
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
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
| Direct chat API (LangChain) | `@langchain/*` | `formula-direct-chat.ts`; same streaming pattern as graph/free |
| **Graph** agent (coordinator + tools + embedded RAG) | `@langchain/*` (+ `ToolNode` from LangGraph) | `formula-unified-agent-graph.ts` (via `formula-graph-agent.ts`); orchestration is TypeScript loops, not `StateGraph` |
| **Free** agent (ReAct `createAgent`) | `langchain` + `@langchain/*` | `formula-free-agent.ts` |
| Embeddings (pgvector) | `@langchain/openai` | `formulaEmbeddings` |
| Provider config (Vercel) | `@ai-sdk/openai` | `getVercelAIChatModel` in llm-config |
| Provider config (LangChain) | `@langchain/openai` | `getLangChainChatModel` in llm-config |
| Title generation (cheapest) | `@ai-sdk/openai` | `getVercelAITitleModel`; env `TITLE_LLM` (default: `openai:gpt-5-nano`) |

We use **both** Vercel AI SDK and LangChain:
- **Vercel AI** for client hooks (`useChat`) and title generation (`getVercelAITitleModel`)
- **LangChain** for **direct** chat, **graph** agent (unified coordinator + tool coordinator + deterministic review + polish), and **free** agent (`createAgent` + tools + polish). Env: `COORDINATOR_LLM`, `TOOL_COORDINATOR_LLM`, `AGENTIC_RAG_LLM` (inner plan/check for embedded retrieval), `FORMULA_AGENT_LLM`, `CLARIFICATION_CHAT_LLM` (polish), `SIMPLE_CHAT_LLM` (direct).

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
