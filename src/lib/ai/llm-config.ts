/**
 * Project-wide LLM and embedding configuration via env.
 * Format: provider:model[:reasoning|temperature] – third part is either reasoning (none|low|medium|high) or temperature (0–2).
 * API keys are per-provider (OPENAI_API_KEY, ANTHROPIC_API_KEY).
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { OpenAIEmbeddings } from "@langchain/openai";

// ---------------------------------------------------------------------------
// Env keys and defaults
// ---------------------------------------------------------------------------

const ENV_KEYS = {
  /** Direct chat (Vercel AI SDK streaming). */
  SIMPLE_CHAT_LLM: "SIMPLE_CHAT_LLM",
  /** Future: agentic chat (e.g. tools). */
  AGENTIC_CHAT_LLM: "AGENTIC_CHAT_LLM",
  /** RAG graph (LangGraph plan/check/answer). */
  AGENTIC_RAG_LLM: "AGENTIC_RAG_LLM",
  /** Formula agent (tools + Clarification). */
  FORMULA_AGENT_LLM: "FORMULA_AGENT_LLM",
  /** Clarification agent chat (streaming final answer). */
  CLARIFICATION_CHAT_LLM: "CLARIFICATION_CHAT_LLM",
  /** Graph agent: planning coordinator (structured output; no tools). */
  COORDINATOR_LLM: "COORDINATOR_LLM",
  /** Graph agent: tool coordinator (binds tools including RAG retrieval tool). */
  TOOL_COORDINATOR_LLM: "TOOL_COORDINATOR_LLM",
  /** Graph agent: field resolver (structured output; full catalog in prompt). */
  FIELD_AGENT_LLM: "FIELD_AGENT_LLM",
  /** Embeddings (e.g. formula docs RAG). */
  EMBEDDINGS: "EMBEDDINGS",
  /** Conversation title generation (cheapest model). */
  TITLE_LLM: "TITLE_LLM",
} as const;

const DEFAULTS = {
  [ENV_KEYS.SIMPLE_CHAT_LLM]: "anthropic:claude-haiku-4-5:low",
  [ENV_KEYS.AGENTIC_CHAT_LLM]: "anthropic:claude-haiku-4-5:low",
  /** Plan/check use `withStructuredOutput`; Anthropic extended thinking conflicts — keep :none unless you use OpenAI here. */
  [ENV_KEYS.AGENTIC_RAG_LLM]: "anthropic:claude-haiku-4-5:none",
  [ENV_KEYS.FORMULA_AGENT_LLM]: "anthropic:claude-haiku-4-5:low",
  [ENV_KEYS.CLARIFICATION_CHAT_LLM]: "anthropic:claude-haiku-4-5:low",
  /** Structured coordinator decisions; keep :none on Anthropic (extended thinking conflicts). */
  [ENV_KEYS.COORDINATOR_LLM]: "anthropic:claude-haiku-4-5:none",
  [ENV_KEYS.TOOL_COORDINATOR_LLM]: "anthropic:claude-haiku-4-5:low",
  [ENV_KEYS.FIELD_AGENT_LLM]: "anthropic:claude-haiku-4-5:none",
  [ENV_KEYS.EMBEDDINGS]: "openai:text-embedding-3-small",
  [ENV_KEYS.TITLE_LLM]: "anthropic:claude-haiku-4-5:low",
} as const;

const API_KEY_KEYS = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
} as const;

// ---------------------------------------------------------------------------
// Types & use-case constants (use these at call sites instead of literals)
// ---------------------------------------------------------------------------

export const LLMUseCases = {
  /** Direct chat (Vercel AI SDK streaming). */
  SIMPLE_CHAT: "simple_chat",
  /** Future: agentic chat with tools. */
  AGENTIC_CHAT: "agentic_chat",
  /** RAG graph (LangGraph plan/check/answer). */
  AGENTIC_RAG: "agentic_rag",
  /** Formula agent (tools + Clarification). */
  FORMULA_AGENT: "formula_agent",
  /** Clarification agent chat (streaming final answer). */
  CLARIFICATION_CHAT: "clarification_chat",
  /** Graph agent: planning coordinator (structured output; no tools). */
  COORDINATOR: "coordinator",
  /** Graph agent: tool coordinator (binds tools). */
  TOOL_COORDINATOR: "tool_coordinator",
  /** Graph agent: field resolver (structured output). */
  FIELD_AGENT: "field_agent",
} as const;

export type LLMUseCase = (typeof LLMUseCases)[keyof typeof LLMUseCases];

/** Agent mode: direct (catalog in prompt) vs graph (coordinator + tools + RAG) vs free (ReAct agent). */
export const AgentModes = {
  DIRECT: "direct",
  GRAPH: "graph",
  FREE: "free",
} as const;

export type AgentMode = (typeof AgentModes)[keyof typeof AgentModes];
export type EmbeddingUseCase = "default";
export type Provider = "openai" | "anthropic";

/** Reasoning/thinking level: provider-agnostic semantic; mapped to provider options. */
export type ReasoningLevel = "none" | "low" | "medium" | "high";

const REASONING_LEVELS: ReasoningLevel[] = ["none", "low", "medium", "high"];

export type ProviderModel = {
  provider: Provider;
  model: string;
  /** Override from env (e.g. :medium). Default: "medium". */
  reasoning?: ReasoningLevel;
  /** Override from env (e.g. :0.5). Default: 0. */
  temperature?: number;
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const USE_CASE_TO_ENV: Record<LLMUseCase, keyof typeof ENV_KEYS> = {
  simple_chat: ENV_KEYS.SIMPLE_CHAT_LLM,
  agentic_chat: ENV_KEYS.AGENTIC_CHAT_LLM,
  agentic_rag: ENV_KEYS.AGENTIC_RAG_LLM,
  formula_agent: ENV_KEYS.FORMULA_AGENT_LLM,
  clarification_chat: ENV_KEYS.CLARIFICATION_CHAT_LLM,
  coordinator: ENV_KEYS.COORDINATOR_LLM,
  tool_coordinator: ENV_KEYS.TOOL_COORDINATOR_LLM,
  field_agent: ENV_KEYS.FIELD_AGENT_LLM,
};

/** Parse provider:model[:reasoning|temperature]. Third part: either reasoning (none|low|medium|high) or temperature (0–2). */
function parseProviderModel(value: string, defaultVal: string): ProviderModel {
  const raw = value?.trim() || defaultVal;
  const parts = raw.split(":").map((p) => p.trim());
  if (parts.length < 2) {
    return { provider: "openai", model: parts[0] || raw };
  }
  const provider = parts[0].toLowerCase() as Provider;
  if (provider !== "openai" && provider !== "anthropic") {
    return { provider: "openai", model: raw };
  }
  const model = parts[1] || "gpt-4o-mini";
  const result: ProviderModel = { provider, model };

  const part2 = parts[2];
  if (part2 !== undefined && part2 !== "") {
    const asReasoning = part2.toLowerCase() as ReasoningLevel;
    if (REASONING_LEVELS.includes(asReasoning)) {
      result.reasoning = asReasoning;
    } else {
      const t = parseFloat(part2);
      if (!Number.isNaN(t) && t >= 0 && t <= 2) {
        result.temperature = t;
      }
    }
  }

  return result;
}

function getEnv(key: keyof typeof ENV_KEYS): string {
  const k = ENV_KEYS[key];
  return process.env[k]?.trim() ?? DEFAULTS[key];
}

export function getChatModelConfig(useCase: LLMUseCase): ProviderModel {
  const envKey = USE_CASE_TO_ENV[useCase];
  return parseProviderModel(getEnv(envKey), DEFAULTS[envKey]);
}

export function getEmbeddingConfig(): ProviderModel {
  return parseProviderModel(getEnv(ENV_KEYS.EMBEDDINGS), DEFAULTS[ENV_KEYS.EMBEDDINGS]);
}

export function getTitleModelConfig(): ProviderModel {
  return parseProviderModel(getEnv(ENV_KEYS.TITLE_LLM), DEFAULTS[ENV_KEYS.TITLE_LLM]);
}

export function getApiKey(provider: Provider): string | undefined {
  const key = API_KEY_KEYS[provider];
  return process.env[key]?.trim();
}

// ---------------------------------------------------------------------------
// Hyperparameters (in code for now)
// ---------------------------------------------------------------------------

const CHAT_TEMPERATURE = 0;
const DEFAULT_REASONING_LEVEL: ReasoningLevel = "medium";

function getReasoningLevel(config: ProviderModel): ReasoningLevel {
  return config.reasoning ?? DEFAULT_REASONING_LEVEL;
}

function getTemperature(config: ProviderModel): number {
  return config.temperature ?? CHAT_TEMPERATURE;
}

function getReasoningOptionsForOpenAI(level: ReasoningLevel): { reasoning: { effort: ReasoningLevel } } {
  return { reasoning: { effort: level } };
}

function getReasoningOptionsForAnthropic(level: ReasoningLevel):
  | { thinking: { type: "disabled" } }
  | { thinking: { type: "adaptive" } }
  | { thinking: { type: "enabled"; budget_tokens: number } } {
  switch (level) {
    case "none":
      return { thinking: { type: "disabled" } };
    case "low":
      return { thinking: { type: "enabled", budget_tokens: 1024 } };
    case "high":
      return { thinking: { type: "enabled", budget_tokens: 8192 } };
    case "medium":
    default:
      return { thinking: { type: "adaptive" } };
  }
}

// ---------------------------------------------------------------------------
// LangChain factory (chat models)
// ---------------------------------------------------------------------------

export function getLangChainChatModel(useCase: LLMUseCase): BaseChatModel {
  const config = getChatModelConfig(useCase);
  const { provider, model } = config;
  const apiKey = getApiKey(provider);
  const reasoningLevel = getReasoningLevel(config);
  const thinkingActive = reasoningLevel !== "none";
  const temperature = thinkingActive ? undefined : getTemperature(config);
  if (provider === "openai") {
    return new ChatOpenAI({
      model,
      ...(temperature !== undefined && { temperature }),
      ...(apiKey && { apiKey }),
      ...getReasoningOptionsForOpenAI(reasoningLevel),
    });
  }
  if (provider === "anthropic") {
    return new ChatAnthropic({
      model,
      ...(temperature !== undefined && { temperature }),
      ...(apiKey && { apiKey }),
      ...getReasoningOptionsForAnthropic(reasoningLevel),
    });
  }
  return new ChatOpenAI({
    model: "gpt-4o-mini",
    ...(temperature !== undefined && { temperature }),
  });
}

/**
 * Base model for Anthropic `withStructuredOutput` (RAG plan/check). Extended thinking is disabled
 * even if `AGENTIC_RAG_LLM` sets :low/:medium/:high. OpenAI uses the normal chat model for this use case.
 */
export function getLangChainChatModelForStructuredOutput(useCase: LLMUseCase): BaseChatModel {
  const config = getChatModelConfig(useCase);
  if (config.provider === "anthropic") {
    const { model } = config;
    const apiKey = getApiKey("anthropic");
    return new ChatAnthropic({
      model,
      ...(apiKey && { apiKey }),
      thinking: { type: "disabled" },
      temperature: getTemperature(config),
    });
  }
  return getLangChainChatModel(useCase);
}

// ---------------------------------------------------------------------------
// Vercel AI SDK factory (for streamText)
// ---------------------------------------------------------------------------

export function getVercelAIChatModel(useCase: LLMUseCase) {
  const { provider, model } = getChatModelConfig(useCase);
  if (provider === "anthropic") {
    return anthropic(model);
  }
  return openai(model);
}

/** Cheapest model for title generation (e.g. gpt-5-nano). Configurable via TITLE_LLM env. */
export function getVercelAITitleModel() {
  const { provider, model } = getTitleModelConfig();
  if (provider === "anthropic") {
    return anthropic(model);
  }
  return openai(model);
}

// ---------------------------------------------------------------------------
// Embeddings (centralized; OpenAI only for now)
// ---------------------------------------------------------------------------

export function getLangChainEmbeddings(options: {
  dimensions?: number;
  stripNewLines?: boolean;
}): OpenAIEmbeddings {
  const { provider, model } = getEmbeddingConfig();
  const apiKey = provider === "openai" ? getApiKey("openai") : undefined;
  if (provider !== "openai") {
    // Only OpenAI embeddings supported for now; fallback to default
    return new OpenAIEmbeddings({
      model: DEFAULTS[ENV_KEYS.EMBEDDINGS].split(":")[1],
      dimensions: options.dimensions,
      stripNewLines: options.stripNewLines ?? true,
      ...(apiKey && { apiKey }),
    });
  }
  return new OpenAIEmbeddings({
    model,
    dimensions: options.dimensions,
    stripNewLines: options.stripNewLines ?? true,
    ...(apiKey && { apiKey }),
  });
}
