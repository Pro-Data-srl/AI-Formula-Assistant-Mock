# Formelassistent (Prototype)

A web-based **formula editor with an AI assistant** for a domain-specific
formula language. Users can write, validate, test, and explain formulas;
the AI assistant suggests, completes, and corrects them.

This repository is a **research and demonstration prototype** maintained
by **Pro Data GmbH** (<https://www.prodata.it>).

## Status & Scope

> ⚠️ **Prototype — not production-ready.**
>
> This codebase is published for research, evaluation, and
> demonstration. It is **not** hardened for public deployment.

### Known limitations

- **No authentication or authorization** on any HTTP API route
  (`/api/chat`, `/api/conversations`, `/api/conversations/[id]`).
  Anyone who can reach the server can read and overwrite all stored
  conversations.
- **No rate limiting.** `/api/chat` triggers paid LLM provider calls
  (OpenAI / Anthropic) on every request. A publicly reachable instance
  can exhaust your API budget.
- **No multi-user model.** Conversations are global and addressed only
  by UUID.
- The formula language, fields, and function catalog included here are
  a **mock subset** for demonstration purposes.

If you intend to deploy this beyond `localhost`, you must add
authentication, authorization, rate limiting, and request size limits
yourself.

## Features

- Formula editor with tokenizer-based syntax highlighting
- Custom tokenizer + Pratt parser for the formula subset
- Sandboxed in-process formula evaluation (custom AST interpreter — no
  `eval()`)
- Validation: syntax, unknown functions/fields, arity
- AI assistant with three agent modes:
  - **direct** – full function/field catalog in the system prompt
  - **graph** – coordinator + tool layer (embedded RAG retrieval tool, validate/evaluate, **askClarification**), review gate, streamed polish
  - **free** – LangChain `createAgent` ReAct loop with full tool set (`retrieveDocs`, validate, evaluate, **askClarification**) and polish
    follow-up questions
- Conversation history persisted in Postgres (Drizzle ORM)
- Optional LangSmith tracing and an evaluation harness

## Tech Stack

| Layer            | Technology                                                    |
| ---------------- | ------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Turbopack)                            |
| Language         | TypeScript                                                    |
| UI               | React 19, shadcn/ui, Tailwind CSS v4                          |
| AI (chat)        | Vercel AI SDK (`ai` + `@ai-sdk/react`)                        |
| AI (graphs/RAG)  | LangChain.js + LangGraph                                      |
| LLM providers    | OpenAI and Anthropic (provider-agnostic config)               |
| Database         | Postgres 16 + pgvector (via Docker Compose)                   |
| ORM / migrations | Drizzle ORM + `drizzle-kit`                                   |
| Tests            | Vitest                                                        |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for the local Postgres container) — or your own Postgres 16
  instance with the `pgvector` extension

### 1. Install dependencies

```bash
npm install
```

### 2. Start the database

```bash
docker compose up -d
```

### 3. Apply migrations

```bash
npm run db:migrate
```

### 4. Configure environment

Copy `.env.example` to `.env` and fill in at least one provider key:

```bash
cp .env.example .env
```

- `OPENAI_API_KEY` (required for embeddings; default for most agents)
- `ANTHROPIC_API_KEY` (optional, used by default agent configuration)
- `DATABASE_URL` defaults to
  `postgresql://formel:formel@localhost:5433/formel_assistent` (matches
  `docker-compose.yml`)

See `.env.example` and `docs/ai-stack.md` for all options.

### 5. (Optional) Seed RAG documents

Only required if you want to run the `graph` or `free` agent
modes:

```bash
npm run db:seed-formula-docs
```

### 6. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Command                       | Description                                      |
| ----------------------------- | ------------------------------------------------ |
| `npm run dev`                 | Start the development server (Turbopack)         |
| `npm run build`               | Production build                                 |
| `npm run start`               | Run the production build                         |
| `npm test`                    | Run unit tests (Vitest)                          |
| `npm run lint`                | Run ESLint                                       |
| `npm run db:generate`         | Generate a new Drizzle migration                 |
| `npm run db:migrate`          | Apply pending migrations                         |
| `npm run db:studio`           | Open Drizzle Studio                              |
| `npm run db:seed-formula-docs`| Embed and seed the `formula_docs` table for RAG  |
| `npm run eval:single`         | Run a single agent invocation (manual test)      |
| `npm run eval:create-dataset` | Create / sync the LangSmith evaluation dataset   |
| `npm run eval:run`            | Run the evaluation suite (requires LangSmith)    |

> `drizzle-kit push` is intentionally **not** part of the recommended
> workflow. Use `db:migrate` so schema changes are versioned in the
> `drizzle/` folder.

## Project Layout

```
src/
  app/                  Next.js App Router (pages + API routes)
  components/           React UI (editor, chat, shadcn/ui)
  contexts/             React contexts
  data/                 Mock fields and function exports
  db/                   Drizzle schema and client
  lib/
    ai/                 Agents, prompting, LLM config
    formula-functions/  Function registry and mock catalog
    formula-*.ts        Tokenizer, parser, executor
    rag/                Embeddings and retrievers
scripts/
  eval/                 Evaluation harness (LangSmith)
  seed-formula-docs.ts  RAG seed script
drizzle/                SQL migrations
docs/                   Architecture and roadmap notes
```

## Documentation

- [`docs/roadmap.md`](docs/roadmap.md) – product roadmap and high-level
  architecture
- [`docs/database.md`](docs/database.md) – database setup and reset
- [`docs/ai-stack.md`](docs/ai-stack.md) – AI SDK / LangChain notes

## Security

See [`SECURITY.md`](SECURITY.md). Report vulnerabilities to
**info@prodata.it**.

## License

Released under the [PolyForm Noncommercial License 1.0.0](./LICENSE).
You may use, modify, and redistribute this software for **noncommercial
purposes only**. For commercial licensing, contact
**info@prodata.it**.

Required Notice: Copyright (c) Pro Data GmbH (<https://www.prodata.it>)
