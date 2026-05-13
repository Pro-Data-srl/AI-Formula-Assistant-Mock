import { describe, it, expect } from "vitest";
import { langchainMessageContentToText } from "./langchain-message-content";

describe("langchainMessageContentToText", () => {
  it("passes through strings", () => {
    expect(langchainMessageContentToText("hello")).toBe("hello");
  });

  it("concatenates text blocks and ignores thinking-style blocks", () => {
    expect(
      langchainMessageContentToText([
        { type: "thinking", thinking: "secret" },
        { type: "text", text: "Hi" },
        { type: "text_delta", text: "!" },
      ])
    ).toBe("Hi!");
  });

  it("returns empty for non-array non-string", () => {
    expect(langchainMessageContentToText({ type: "text", text: "x" })).toBe("");
  });
});
