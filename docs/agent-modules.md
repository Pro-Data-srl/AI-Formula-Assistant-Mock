# Agent modules (graph, free, common)

Maps `src/lib/ai` (and related prompts) to **graph** agent, **free** agent, or **common** (shared by several modes).

## Graph agent (`FORMULA_SOURCE=graph`, legacy `rag`)

| File | Role |
|------|------|
| `formula-graph-agent.ts` | Public API: `runGraphFormulaAgent`, re-exported types. |
| `formula-graph-stategraph.ts` | LangGraph `StateGraph`: nodes (`coordinate_plan`, `capabilities`, `finalize_review`, `polish`), conditional edges, `compile()`. |
| `prompting/graph-planning-coordinator.ts` | System prompt `GRAPH_PLANNING_COORDINATOR_SYSTEM` for the planning coordinator. |
| `tool-coordinator-phase.ts` | Tool coordinator loop + LangGraph `ToolNode` for tool execution. |

### Graph planning coordinator: answer text vs formula (structured output)

The planning coordinator already returns **JSON-shaped structured output** (`withStructuredOutput` + Zod in `formula-graph-stategraph.ts`): branch **`finalize`** carries **`draft_markdown`** (full draft for the polish model) and optional **`formula_candidate`** (exact formula string for deterministic validate/evaluate). If **`formula_candidate`** is missing, the pipeline falls back to **`extractFormulaFromMarkdown`** (first fenced code block) — convenient but brittle compared to an explicit field.

**Options (discussion):**

1. **Stay close to current schema** — Prompt and eval pressure so **`formula_candidate`** is filled whenever a concrete formula exists; keep fence parsing only as safety net (lowest churn).
2. **Split finalize fields further** — e.g. `explanation_markdown` + `formula_literal` (+ optional `has_formula: boolean`) so the model never mixes “human prose” and “machine formula” in one blob; polish consumes only `explanation_markdown` for wording, review uses `formula_literal` only (clearer contract, requires prompt + schema migration).
3. **Second structured extraction call** — After finalize, a tiny Haiku-style pass outputs `{ formula, confidence }` from `draft_markdown` (extra latency/cost; redundant if (1) or (2) work).
4. **Tool-only formula** — Force “propose formula” through `validateFormula` / editor flow only (heavy UX change; not ideal for chat-first prototype).

Recommendation for this repo: **(1) now**; consider **(2)** if product wants strict separation for API consumers or analytics.

## Free agent (`FORMULA_SOURCE=free`, legacy `clarification`)

| File | Role |
|------|------|
| `formula-free-agent.ts` | LangChain `createAgent` ReAct loop + polish. |

## Common (direct + graph + free, or shared infrastructure)

| File | Role |
|------|------|
| `formula-direct-chat.ts` | **Direct** mode chat. |
| `llm-config.ts` | Provider wiring and `LLMUseCases` (includes graph- and free-specific cases). |
| `langchain-message-content.ts` | Text extraction from LangChain message chunks. |
| `langchain-tool-status-callback.ts` | Maps tool events to status phases (used by graph tool phase). |
| `rag-retrieval-only.ts` | Embedded RAG loop for the `retrieveFormulaContext` tool (graph tool coordinator; optional patterns elsewhere). |
| `tools/index.ts` | Shared LangChain tools (`validateFormula`, `evaluateFormula`, `askClarification`, …). |
| `prompting/tool-coordinator.ts` | Tool-coordinator system prompts. |
| `prompting/clarification-answer.ts` | Polish / answer-shaping prompt (graph polish node + other modes). |
| `prompting/rag-plan.ts`, `prompting/rag-check.ts` | RAG plan/check prompts (used inside `rag-retrieval-only`). |
| `assistant-status.ts` | Client-facing status typing if shared with UI. |
| `formula-context.ts`, `clarification-response.ts` | Supporting types/helpers as used by routes/UI. |

Eval / scripts:

| File | Role |
|------|------|
| `scripts/agent-targets.ts` | Shared input/output shape to run **direct**, **graph**, or **free** for evaluation. |
