/**
 * LLM-as-judge evaluator for correctness.
 * Grades agent answer against reference answer.
 */
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import {
  EVAL_CORRECTNESS_SYSTEM,
  buildEvalCorrectnessUserMessage,
} from "../prompting";

const CorrectnessGradeSchema = z.object({
  reasoning: z.string().describe("Kurze Begründung der Bewertung"),
  correct: z
    .boolean()
    .describe(
      "True wenn die Studenten-Antwort korrekt ist, sonst False"
    ),
});

export type LlmCorrectnessEvaluatorArgs = {
  inputs?: { messages?: { role: string; content: string }[]; formula?: string };
  outputs?: { answer?: string };
  referenceOutputs?: { answer?: string };
};

export type LlmCorrectnessEvaluatorResult = {
  key: string;
  score: number | null;
  comment: string;
};

export type GradeResult = { reasoning: string; correct: boolean };

/** For tests: inject a function that returns a fixed grade instead of calling the LLM. */
export type GradeFn = (userMessage: string) => Promise<GradeResult>;

function getQuestionFromInputs(inputs: LlmCorrectnessEvaluatorArgs["inputs"]): string {
  const messages = inputs?.messages ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return lastUser?.content ?? "";
}

/**
 * Create the LLM-as-judge correctness evaluator.
 * @param gradeFn Optional: for tests, inject a function that returns a fixed grade.
 */
export function createLlmCorrectnessEvaluator(gradeFn?: GradeFn) {
  return async function llmCorrectnessEvaluator(
    args: LlmCorrectnessEvaluatorArgs
  ): Promise<LlmCorrectnessEvaluatorResult> {
    const inputs = args.inputs ?? {};
    const outputs = args.outputs ?? {};
    const refOutputs = args.referenceOutputs ?? {};
    const studentAnswer = outputs?.answer ?? "";
    const groundTruth = refOutputs?.answer ?? "";

    if (!groundTruth) {
      return { key: "llm_correctness", score: null, comment: "no reference" };
    }

    const question = getQuestionFromInputs(inputs);
    const userMessage = buildEvalCorrectnessUserMessage({
      question,
      formula: inputs.formula,
      groundTruth,
      studentAnswer,
    });

    let parsed: GradeResult;
    if (gradeFn) {
      parsed = await gradeFn(userMessage);
    } else {
      const graderModel = new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0,
      }).withStructuredOutput(CorrectnessGradeSchema, { strict: true });
      const grade = await graderModel.invoke([
        { role: "system", content: EVAL_CORRECTNESS_SYSTEM },
        { role: "user", content: userMessage },
      ]);
      parsed = CorrectnessGradeSchema.parse(grade);
    }

    const score = parsed.correct ? 1 : 0;
    return {
      key: "llm_correctness",
      score,
      comment:
        parsed.reasoning?.slice(0, 80) ??
        (parsed.correct ? "correct" : "incorrect"),
    };
  };
}
