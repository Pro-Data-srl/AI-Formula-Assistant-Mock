/**
 * Unit tests for LLM-as-judge correctness evaluator.
 * Uses injected gradeFn to avoid real LLM calls.
 */
import { describe, it, expect } from "vitest";
import {
  createLlmCorrectnessEvaluator,
  type GradeFn,
} from "./llm-correctness";

describe("createLlmCorrectnessEvaluator", () => {
  it("returns score null when no reference output", async () => {
    const gradeFn: GradeFn = () => Promise.resolve({ reasoning: "x", correct: true });
    const evaluator = createLlmCorrectnessEvaluator(gradeFn);

    const result = await evaluator({
      inputs: { messages: [{ role: "user", content: "Q" }] },
      outputs: { answer: "A" },
      referenceOutputs: {},
    });

    expect(result.key).toBe("llm_correctness");
    expect(result.score).toBeNull();
    expect(result.comment).toBe("no reference");
  });

  it("returns score 1 when gradeFn returns correct: true", async () => {
    const gradeFn: GradeFn = () =>
      Promise.resolve({ reasoning: "Antwort ist korrekt.", correct: true });
    const evaluator = createLlmCorrectnessEvaluator(gradeFn);

    const result = await evaluator({
      inputs: { messages: [{ role: "user", content: "Was macht addDays?" }] },
      outputs: { answer: "addDays addiert Tage." },
      referenceOutputs: { answer: "addDays addiert Tage zu einem Datum." },
    });

    expect(result.key).toBe("llm_correctness");
    expect(result.score).toBe(1);
    expect(result.comment).toContain("korrekt");
  });

  it("returns score 0 when gradeFn returns correct: false", async () => {
    const gradeFn: GradeFn = () =>
      Promise.resolve({ reasoning: "Antwort ist falsch.", correct: false });
    const evaluator = createLlmCorrectnessEvaluator(gradeFn);

    const result = await evaluator({
      inputs: { messages: [{ role: "user", content: "Korrigiere" }] },
      outputs: { answer: "addDays(1, 2)" },
      referenceOutputs: { answer: "addDays(date(), 7)" },
    });

    expect(result.key).toBe("llm_correctness");
    expect(result.score).toBe(0);
    expect(result.comment).toContain("falsch");
  });

  it("passes userMessage to gradeFn with question, formula, ground truth, student answer", async () => {
    let capturedMessage = "";
    const gradeFn: GradeFn = async (msg) => {
      capturedMessage = msg;
      return { reasoning: "ok", correct: true };
    };
    const evaluator = createLlmCorrectnessEvaluator(gradeFn);

    await evaluator({
      inputs: {
        messages: [{ role: "user", content: "Erkläre addDays" }],
        formula: "addDays(1,2)",
      },
      outputs: { answer: "Student sagt X" },
      referenceOutputs: { answer: "addDays addiert Tage" },
    });

    expect(capturedMessage).toContain("NUTZERANFRAGE: Erkläre addDays");
    expect(capturedMessage).toContain("FORMEL (Kontext): addDays(1,2)");
    expect(capturedMessage).toContain("ERWARTETE ANTWORT: addDays addiert Tage");
    expect(capturedMessage).toContain("STUDENTEN-ANTWORT: Student sagt X");
  });

  it("extracts question from last user message", async () => {
    let capturedMessage = "";
    const gradeFn: GradeFn = async (msg) => {
      capturedMessage = msg;
      return { reasoning: "ok", correct: true };
    };
    const evaluator = createLlmCorrectnessEvaluator(gradeFn);

    await evaluator({
      inputs: {
        messages: [
          { role: "user", content: "First" },
          { role: "assistant", content: "Reply" },
          { role: "user", content: "Second question" },
        ],
      },
      outputs: { answer: "A" },
      referenceOutputs: { answer: "B" },
    });

    expect(capturedMessage).toContain("NUTZERANFRAGE: Second question");
  });

  it("truncates comment to 80 chars when reasoning is long", async () => {
    const longReasoning =
      "A".repeat(100) + " - this part should be truncated from comment";
    const gradeFn: GradeFn = () =>
      Promise.resolve({ reasoning: longReasoning, correct: true });
    const evaluator = createLlmCorrectnessEvaluator(gradeFn);

    const result = await evaluator({
      inputs: { messages: [{ role: "user", content: "Q" }] },
      outputs: { answer: "A" },
      referenceOutputs: { answer: "B" },
    });

    expect(result.comment.length).toBe(80);
    expect(result.comment).toBe("A".repeat(80));
  });
});
