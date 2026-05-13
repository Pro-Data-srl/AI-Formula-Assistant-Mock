#!/usr/bin/env npx tsx
/**
 * Create/update the evaluation dataset in LangSmith.
 * - Reads scripts/eval/dataset.json (source of truth)
 * - Uploads to LangSmith (requires LANGCHAIN_API_KEY)
 *
 * Usage: npm run eval:create-dataset
 */
import { config } from "dotenv";
config();

import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "langsmith";
import type { EvalExample } from "./eval-types";

const DATASET_PATH = join(__dirname, "dataset.json");
const DATASET_NAME = "formelassistent-eval";

async function loadDataset(): Promise<EvalExample[]> {
  const raw = readFileSync(DATASET_PATH, "utf-8");
  return JSON.parse(raw) as EvalExample[];
}

function toLangSmithInputs(ex: EvalExample) {
  return {
    messages: ex.messages,
    formula: ex.formula || undefined,
  };
}

function toLangSmithOutputs(ex: EvalExample) {
  return ex.referenceOutput ? { answer: ex.referenceOutput.answer } : undefined;
}

async function main() {
  if (!process.env.LANGCHAIN_API_KEY) {
    console.error("LANGCHAIN_API_KEY is required. Set it in .env or environment.");
    process.exit(1);
  }

  const client = new Client();
  const examples = await loadDataset();
  console.log(`Loaded ${examples.length} examples from ${DATASET_PATH}`);

  let dataset: Awaited<ReturnType<typeof client.createDataset>> | null = null;
  for await (const d of client.listDatasets({ datasetNameContains: DATASET_NAME })) {
    if (d.name === DATASET_NAME) {
      dataset = d;
      break;
    }
  }

  if (!dataset) {
    dataset = await client.createDataset(DATASET_NAME, {
      description: "Formelassistent evaluation: Erklären, Korrigieren, Generieren",
    });
    console.log(`Created dataset: ${dataset.name} (${dataset.id})`);
  } else {
    console.log(`Using existing dataset: ${dataset.name} (${dataset.id})`);
  }

  const uploads = examples.map((ex) => ({
    inputs: toLangSmithInputs(ex),
    outputs: toLangSmithOutputs(ex),
    metadata: { id: ex.id, task: ex.task, difficulty: ex.difficulty },
    dataset_id: dataset.id,
  }));

  await client.createExamples(uploads);
  console.log(`Uploaded ${uploads.length} examples to LangSmith.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
