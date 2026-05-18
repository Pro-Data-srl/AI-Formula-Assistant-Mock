#!/usr/bin/env npx tsx
/**
 * Run evaluation on the formula assistant agents via LangSmith.
 * - Uses LangSmith dataset "formelassistent-eval" (create with npm run eval:create-dataset)
 * - Requires LANGCHAIN_API_KEY
 *
 * Usage:
 *   npm run eval:run [-- --agent direct]     # single agent
 *   npm run eval:run [-- --agent all]        # all agents (default)
 *   npm run eval:run [-- --agent direct --agent graph]
 */
import { config } from "dotenv";
config();

import { readFileSync } from "fs";
import { join } from "path";
import { evaluate } from "langsmith/evaluation";
import { Client } from "langsmith";
import { AgentModes, type AgentMode } from "@/lib/ai/llm-config";
import { createLlmCorrectnessEvaluator } from "./lib/evaluators";
import { runAgentAsTarget } from "../agent-targets";
import type { EvalExample } from "./eval-types";

const DATASET_PATH = join(__dirname, "dataset.json");
const DATASET_NAME = "formelassistent-eval";

const llmCorrectnessEvaluator = createLlmCorrectnessEvaluator();

/** Sortable datetime prefix (YYYYMMDD-HHmm) for experiment naming. */
function getRunDatetime(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}-${h}${min}`;
}

function loadDataset(): EvalExample[] {
  const raw = readFileSync(DATASET_PATH, "utf-8");
  return JSON.parse(raw) as EvalExample[];
}

async function runEvaluation(
  examples: EvalExample[],
  agents: AgentMode[],
  runDatetime: string
): Promise<void> {
  const client = new Client();

  for (const agent of agents) {
    const target = (inputs: {
      messages: { role: string; content: string }[];
      formula?: string;
    }) => runAgentAsTarget(agent, inputs);

    const results = await evaluate(target, {
      data: DATASET_NAME,
      evaluators: [llmCorrectnessEvaluator],
      experimentPrefix: `formelassistent-${runDatetime}-${agent}`,
      maxConcurrency: 2,
      client,
    });

    console.log(`\n--- Agent: ${agent} ---`);
    let idx = 0;
    for await (const row of results) {
      const ex = examples[idx++];
      const scores = row.evaluationResults?.results ?? [];
      const llm = scores.find(
        (s: { key?: string }) => s.key === "llm_correctness"
      );
      console.log(
        `[${ex?.id ?? idx}] score=${llm?.score ?? "?"} ${llm?.comment ?? ""}`
      );
    }
  }
}

function parseAgents(): AgentMode[] {
  const args = process.argv.slice(2);
  const agentIdx = args.indexOf("--agent");
  if (agentIdx === -1 || !args[agentIdx + 1]) {
    return [AgentModes.DIRECT, AgentModes.GRAPH, AgentModes.FREE];
  }
  const val = args[agentIdx + 1];
  if (val === "all") {
    return [AgentModes.DIRECT, AgentModes.GRAPH, AgentModes.FREE];
  }
  if (val === "direct" || val === "graph" || val === "free" || val === "rag" || val === "clarification") {
    if (val === "rag") return [AgentModes.GRAPH];
    if (val === "clarification") return [AgentModes.FREE];
    return [val as AgentMode];
  }
  console.error(`Unknown agent: ${val}. Use direct, graph, free, rag, clarification (legacy), or all.`);
  process.exit(1);
}

async function main() {
  if (!process.env.LANGCHAIN_API_KEY) {
    console.error("LANGCHAIN_API_KEY is required. Set it in .env or environment.");
    process.exit(1);
  }

  const runDatetime = getRunDatetime();
  const examples = loadDataset();
  const agents = parseAgents();

  console.log(`Run: ${runDatetime}`);
  console.log(`Dataset: ${examples.length} examples (from ${DATASET_NAME})`);
  console.log(`Agents: ${agents.join(", ")}`);
  console.log(`Experiment names: formelassistent-${runDatetime}-{direct|graph|free}`);

  await runEvaluation(examples, agents, runDatetime);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
