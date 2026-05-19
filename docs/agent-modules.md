# Agent modules (graph, free, common)

Maps `src/lib/ai` (and related prompts) to **graph** agent, **free** agent, or **common** (shared by several modes).

## Graph agent (`FORMULA_SOURCE=graph`, legacy `rag`)

| File | Role |
|------|------|
| `formula-graph-agent.ts` | Public API: `runGraphFormulaAgent`, re-exported types. |
| `formula-graph-stategraph.ts` | LangGraph `StateGraph`: `coordinate_plan` → `gather_capabilities` (parallel) → `finalize_review` → `polish`. |
| `graph-capabilities.ts` | Dispatches coordinator `requests[]` in parallel (RAG, fields, validate, evaluate, clarify). |
| `field-agent.ts` | Field resolver LLM (full catalog in prompt; structured output). |
| `prompting/graph-planning-coordinator.ts` | Planning coordinator system prompt (`gather` / `finalize`). |
| `prompting/field-agent.ts` | Field agent system prompt. |
| `rag-retrieval-only.ts` | Function RAG loop for `function_rag` capability. |

### Planning coordinator

Structured output (`gather` | `finalize`):

- **`gather`**: `requests[]` with `request_type` + parameters; optional `draft_markdown` / `formula_candidate` in parallel.
- **`finalize`**: `draft_markdown` + optional `formula_candidate` → deterministic review → polish stream.

Capabilities (no monolithic tool-coordinator ReAct loop):

| `request_type` | Runner |
|----------------|--------|
| `function_rag` | `runRagRetrievalOnly` |
| `resolve_fields` | `runFieldResolveAgent` |
| `validate` / `evaluate` | `formula-executor` (deterministic) |
| `clarify` | HITL (coordinator only; exclusive) |

Legacy: `tool-coordinator-phase.ts` remains for reference but is **not** used by the graph agent.

## Free agent (`FORMULA_SOURCE=free`, legacy `clarification`)

| File | Role |
|------|------|
| `formula-free-agent.ts` | LangChain `createAgent` ReAct loop + polish. |

## Common (direct + graph + free, or shared infrastructure)

| File | Role |
|------|------|
| `formula-direct-chat.ts` | **Direct** mode chat. |
| `llm-config.ts` | Provider wiring and `LLMUseCases`. |
| `langchain-message-content.ts` | Text extraction from LangChain message chunks. |
| `tools/index.ts` | Shared LangChain tools (free agent). |
| `prompting/clarification-answer.ts` | Polish / answer-shaping prompt (graph polish node + other modes). |
| `prompting/rag-plan.ts`, `prompting/rag-check.ts` | RAG plan/check prompts. |
| `assistant-status.ts` | Client-facing status typing. |
| `formula-context.ts` | Context builders (direct mode). |

Eval / scripts:

| File | Role |
|------|------|
| `scripts/agent-targets.ts` | Shared input/output shape to run **direct**, **graph**, or **free** for evaluation. |
