# Formelassistent – Roadmap

Formula editor with AI assistance for a subset of an internal formula
language.

## Vision

Build a modern web-based **Formelassistent** (Formula Assistant) that
helps users write and validate formulas, enhanced by an AI assistant for
suggestions, completion, and error correction. This repository is a
**prototype / playground** for the web UI, the formula engine subset,
and the AI agent design.

---

## Phase 1: Foundation (Current)

### 1.1 Project Setup ✅
- [x] Next.js 16 with App Router
- [x] TypeScript
- [x] Tailwind CSS v4
- [x] shadcn/ui components

### 1.2 Formelassistent UI
- [x] Card-based layout (modal/dialog wrapper optional)
- [x] **Funktionen** tab: function list, category filter, search
- [x] **Daten** tab: field list, Alternativform checkbox
- [x] Formula input area (single-line)
- [x] Right panel: function/field details (signature, params, examples)
- [x] Test button, Help button (shows available operators)

### 1.3 Static Data & Mock Content ✅
- [x] Define formula subset (functions + categories)
- [x] Mock field/manipulator data for Daten tab
- [x] Sample function documentation (e.g. `abs`, `addDays`, …)

---

## Phase 2: Formula Engine

### 2.1 Parser & AST
- [x] Define grammar for the formula subset (tokenizer + Pratt parser)
- [x] Parser (custom: `formula-tokenizer.ts`, `formula-parser.ts`)
- [x] AST representation
- [x] Syntax highlighting in editor (tokenizer-based `FormulaInput`, no
      extra dependency)
- [x] Function-aware highlighting in editor (known calls highlighted,
      unknown calls highlighted after validation)

### 2.2 Validation
- [x] Syntax validation
- [x] Unknown function/field detection (`validateFormula` + AST walk)
- [x] Function arity validation
- [x] Inline error display (on blur, below formula input)
- [ ] Type checking (params, return types) — optional later

### 2.3 Test Execution ✅
- [x] Sandboxed formula evaluation (`formula-executor.ts`)
- [x] Test button → run formula with sample inputs
      (`getMockFieldValues`)
- [x] Result display

---

## Phase 3: AI Assistant

### 3.1 Infrastructure
- [x] Docker Compose: Postgres (chat history + pgvector for RAG)
- [x] Drizzle schema (conversations, messages)
- [x] **pgvector**: table `formula_docs` (embeddings), migration, seed
      script `npm run db:seed-formula-docs`
- [x] **FORMULA_SOURCE**: env `direct` | `graph` (legacy `rag`) | `free` (legacy `clarification`) — switch agent pipelines

### 3.2 Integration
- [x] LLM API integration (OpenAI primary; provider-agnostic design,
      Anthropic supported)
- [x] API key via env vars (e.g. `OPENAI_API_KEY`)
- [x] Prompt design for formula assistance
- [x] Assistant panel UI (`AssistantChat`)

### 3.3 Features (priority)
1. - [x] **Explain formula** — explain the current or selected formula
2. - [x] **Correction suggestions** — explain errors and propose fixes
        (incl. `FormulaDiff` per code block + "apply formula")
3. - [x] **Generate formula** — natural language → formula (via chat)
4. - [ ] **Auto-completion** — context-aware suggestions (optional)

### 3.4 Context & Tools (agentic)
- [x] **Context**: current formula, fields, available functions (in
      prompt)
- [x] **RAG over function descriptions**: agentic plan → retrieve (pgvector) → check (embedded in graph mode via tools; inner loop is TypeScript; outer graph is `StateGraph` in `formula-graph-stategraph.ts`)
- [x] **Context**: chat history (in-session) — passed to LLM/RAG
- [ ] **Agent memory layers** — typical layers still missing:
  - [ ] Short-term/working: in-session messages ✅, but no
        checkpointing / state persistence
  - [ ] Episodic: load past conversations (conversations/messages
        schema unused at the agent level)
  - [ ] Semantic / long-term: user preferences, learned facts,
        summarized insights
  - [ ] Summarization: compress long history for token limits
- [ ] **Tools**:
  - [ ] Validation-errors tool call
  - [ ] Edge test cases / formula-test tool call

### 3.5 UX
- [x] **Agent mode select**: input/select to switch direct vs. graph vs.
      free (instead of env-only); extensible for further
      configurations
- [x] Assistant lives in the existing chat panel
- [x] **`FormulaDiff` component**: prior vs. after, side-by-side,
      character-wise red/green diff
- [x] **Status display** (graph / free): thinking… / planning… / loading
      docs… / evaluating… / answering…
- [ ] Checkpoint system — schema ready, wiring pending (optional)
- [x] **History view**: persisted chat history — schema in place,
      previous conversations selectable and restorable
- [ ] **Persisted status / steps** — store status timeline (thinking,
      planning, …) in conversation/messages model (optional)
- [x] Copy / insert suggested formula ("apply formula" per code block
      in chat)

### 3.6 Free agent ✅

Agent that can **ask the user clarifying questions** when the request is
ambiguous or insufficient. LangChain **`createAgent`** (ReAct) with tools
(`retrieveFormulaContext`, `validateFormula`, `evaluateFormula`,
`askClarification`).

**Goals:**
- When user intent is unclear (e.g. "do that with the date", "fix the
  formula"), the agent asks targeted follow-up questions instead of
  guessing.
- Agentic loop: the model chooses tools (retrieval, validate, evaluate);
  when ready, returns an answer (with optional markdown polish).
- `askClarification` as a tool → human-in-the-loop: question is returned
  to the user; the next message continues with full history.

**Architecture:**
- `formula-free-agent.ts`: LangChain `createAgent` + shared formula tools
  + polish stream (same polish pattern as other modes).

**Tools:**
- **`retrieveFormulaContext`** — documentation retrieval over `formula_docs` (pgvector)
- **`validateFormula`** — syntax, unknown functions/fields, arity
- **`evaluateFormula`** — run with `getMockFieldValues()`
- **`askClarification`** — returns a question to the user
  (human-in-the-loop)

**Integration:**
- Agent mode **Free agent** in the UI; the API route handles
  clarification vs. answer responses.
- Client renders a clarification question as an assistant message; the
  user replies and resubmits.

### 3.7 Graph agent (LangGraph `StateGraph`)

Two-LLM pipeline: planning coordinator → tool coordinator (with embedded RAG tool) → deterministic
validate/evaluate → streamed polish. Outer control flow is implemented as a compiled **`StateGraph`**
in `formula-graph-stategraph.ts` (nodes and conditional edges). The tool coordinator still uses
**`ToolNode`** for batched tool execution.

- [x] LangGraph **`StateGraph`** for outer orchestration (`formula-graph-stategraph.ts`)
- [x] **`ToolNode`** inside `tool-coordinator-phase.ts`

---

## Phase 4: Evaluation & Agentic Extensions

### 4.1 Agent comparison (Direct vs. Graph vs. Free)

LangSmith-based evaluation with eval scripts; compare all three agents
on the same test set.

- [x] **Direct: LangSmith monitoring** — direct chat now uses LangChain
      (`formula-direct-chat.ts`) like graph and free modes; all three
      agents are traced uniformly in LangSmith.
- [x] **Target functions** — shared interface / adapter layer so eval
      scripts can call the three agents (direct, graph, free)
      as target functions (synchronous input/output, no streaming).
- [x] **Single-run script** — manual testing: run a single request
      against an agent (direct/graph/free), output to console
      (`npm run eval:single`).
- [x] **Evaluation dataset** — test set with requests (explain, fix,
      generate; varying difficulty, with reference outputs).
      `scripts/eval/dataset.json` — one example per task × difficulty.
- [x] **Eval scripts** — separate executable scripts (always
      LangSmith): `npm run eval:create-dataset`,
      `npm run eval:run [--agent direct|graph|free|all]` (legacy: `rag` → graph, `clarification` → free).
      Requires `LANGCHAIN_API_KEY`.

### 4.2 Evaluators (priority)

**Step 1: final response evaluators**
- [x] **LLM-as-judge instead of reference match** — replace the current
      `ref_match` evaluator with LLM-as-judge for correctness /
      relevance of the final answer. Reference match remains an
      optional fast check.

**Step 2: RAG-specific evaluators**
- [ ] **Evaluate RAG / RAG-tool agents** — faithfulness (answer vs.
      retrieved context), answer relevance (answer vs. question),
      retrieval relevance (retrieved docs vs. question). Prerequisite:
      **data collection** — target functions must return
      `documents` / `context` and `answer` so evaluators can access
      them.
- [ ] **Extend dataset format** — if needed, structure inputs/outputs
      so RAG evaluators get all required fields.

**Later: trajectory evaluators (Clarification agent)**
- [ ] **Deterministic trajectory evaluation** — expected tool sequence
      vs. actual sequence (e.g. `["retrieveDocs",
      "validateFormula"]`). The Clarification agent has no rigid
      graph; subsequence-match or similar logic.
- [ ] **Optional: LLM-as-judge for trajectory** — qualitative
      assessment whether the agent took a sensible path.

**Later: single-step evaluators**
- [ ] **Correct tool choosing** — evaluate single steps: was the right
      tool chosen for the given context? Useful for debugging and
      targeted improvement.

**Later: routing pattern & evaluator**
- [ ] **Routing pattern** — pick the most suitable model/agent per
      question (e.g. simple → cheaper model, complex → RAG /
      Clarification).
- [ ] **Routing evaluator** — assess whether the routing decision was
      correct (e.g. reference: "should use RAG" vs. actual route).

**Later: pairwise evaluation**
- [ ] **Agent vs. direct pairwise** — pairwise tests: RAG or
      Clarification vs. direct agent. LLM-as-judge decides which
      answer is better (helpfulness, correctness). Useful to measure
      whether specialized agents actually deliver better answers.

### 4.3 Model & agentic-flow evaluation
- [ ] **Model evaluation**: compare models (e.g. `gpt-4o-mini`,
      `gpt-5-nano`, `gpt-5-mini`) on cost, latency, and quality for
      formula tasks (explain, correct, generate).
- [ ] **Agentic-flow evaluation**: evaluate graph vs. direct context
      (`FORMULA_SOURCE=graph` vs. `direct`; legacy `rag` maps to graph) on success rate, retrieval
      relevance, end-to-end quality; tune prompts and retrieval if
      needed.

---

## Phase 5: Polish & Extensions

### 5.1 Extensibility
- [x] Central function registry with provider abstraction (mock source
      first)
- [ ] Configurable function catalog

---

## Tech Stack

| Layer            | Technology                                                    |
| ---------------- | ------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router)                                       |
| UI               | React 19, shadcn/ui                                           |
| Styling          | Tailwind CSS v4                                               |
| Language         | TypeScript                                                    |
| AI chat          | Vercel AI SDK (`ai` core + `@ai-sdk/react` hooks); see        |
|                  | `docs/ai-stack.md`                                            |
| RAG              | LangChain (pgvector, retrievers, embeddings)                  |
| LLM / embeddings | OpenAI (primary); provider-agnostic                           |
| Parsing          | Custom tokenizer + Pratt parser                               |
| Function catalog | Provider-based central registry                               |
| Database         | Postgres + Drizzle (Docker Compose)                           |
| Vector store     | pgvector (in Postgres), table `formula_docs`, retrieval when   |
|                  | `FORMULA_SOURCE=graph` (legacy: `rag`)                        |
| Diff UI          | `diff` npm (character-wise); custom red/green render          |

---

## Notes

- Start with a small, well-defined function subset.
- Prioritize UX parity with the reference Formelassistent.
- AI features should augment, not replace, the manual formula builder.
- **pgvector**: extension active, table `formula_docs`, seed via
  `npm run db:seed-formula-docs`. Graph agent retrieval via `FORMULA_SOURCE=graph` (legacy: `rag`);
  LangSmith optional (`LANGSMITH_TRACING`, `LANGCHAIN_API_KEY`,
  `LANGCHAIN_PROJECT`).
