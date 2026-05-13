#!/usr/bin/env npx tsx
/**
 * Single agent execution for manual testing.
 * Edit the config below and run: npm run eval:single
 */
import { config } from "dotenv";
config();

import { AgentModes } from "@/lib/ai/llm-config";
import { runAgentAsTarget } from "./agent-targets";

// ---------------------------------------------------------------------------
// Config – edit these values for manual testing
// ---------------------------------------------------------------------------
const AGENT = AgentModes.CLARIFICATION;
const QUERY = "Erkläre addDays";
const FORMULA = "";

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Agent: ${AGENT}`);
  console.log(`Query: ${QUERY}`);
  if (FORMULA) console.log(`Formula: ${FORMULA}`);
  console.log("---");

  const result = await runAgentAsTarget(AGENT, {
    messages: [{ role: "user", content: QUERY }],
    formula: FORMULA || undefined,
  });

  console.log(result.answer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
