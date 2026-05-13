/**
 * Unit tests for eval grader prompt builder.
 */
import { describe, it, expect } from "vitest";
import {
  EVAL_CORRECTNESS_SYSTEM,
  buildEvalCorrectnessUserMessage,
} from "./eval-grader";

describe("EVAL_CORRECTNESS_SYSTEM", () => {
  it("contains grading criteria", () => {
    expect(EVAL_CORRECTNESS_SYSTEM).toContain("Korrektheit");
    expect(EVAL_CORRECTNESS_SYSTEM).toContain("True");
    expect(EVAL_CORRECTNESS_SYSTEM).toContain("False");
  });
});

describe("buildEvalCorrectnessUserMessage", () => {
  it("includes question, ground truth, and student answer", () => {
    const msg = buildEvalCorrectnessUserMessage({
      question: "Was macht addDays?",
      groundTruth: "addDays addiert Tage.",
      studentAnswer: "addDays(dDatum, iTage) addiert Tage.",
    });
    expect(msg).toContain("NUTZERANFRAGE: Was macht addDays?");
    expect(msg).toContain("ERWARTETE ANTWORT: addDays addiert Tage.");
    expect(msg).toContain(
      "STUDENTEN-ANTWORT: addDays(dDatum, iTage) addiert Tage."
    );
  });

  it("includes formula when provided", () => {
    const msg = buildEvalCorrectnessUserMessage({
      question: "Korrigiere die Formel",
      formula: "addDays(1, 2)",
      groundTruth: "addDays(date(), 7)",
      studentAnswer: "addDays(date(), 7)",
    });
    expect(msg).toContain("FORMEL (Kontext): addDays(1, 2)");
  });

  it("omits formula section when not provided", () => {
    const msg = buildEvalCorrectnessUserMessage({
      question: "Erkläre addDays",
      groundTruth: "addDays addiert Tage.",
      studentAnswer: "addDays addiert Tage zu einem Datum.",
    });
    expect(msg).not.toContain("FORMEL (Kontext)");
  });

  it("joins sections with double newline", () => {
    const msg = buildEvalCorrectnessUserMessage({
      question: "Q",
      groundTruth: "GT",
      studentAnswer: "SA",
    });
    expect(msg).toBe(
      "NUTZERANFRAGE: Q\n\nERWARTETE ANTWORT: GT\n\nSTUDENTEN-ANTWORT: SA"
    );
  });
});
