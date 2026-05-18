/**
 * Tokenizer-based formula formatter (no parser).
 * Break args into lines only when: (1) any argument is a function call, or (2) more than 3 parameters.
 * Otherwise keep the whole call on one line. When args are broken across lines, the matching closing ) is on its own line.
 */

import { tokenize } from "./formula-tokenizer";
import type { Token } from "./formula-tokenizer";

const INDENT = "  "; // 2 spaces per level
const MAX_LINE_LENGTH = 80; // optional: break before ||/&& if line would exceed this
const MAX_PARAMS_INLINE = 3; // if params > this, break all args onto new lines

/** Find matching rparen index for lparen at startIndex (by balance). */
function findMatchingRparen(list: Token[], startIndex: number): number {
  let depth = 1;
  for (let k = startIndex + 1; k < list.length; k++) {
    if (list[k].type === "lparen") depth++;
    else if (list[k].type === "rparen") {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

/**
 * For the argument list starting at lparen index, should we put each argument on its own line?
 * Yes if: any argument is a function call (identifier + lparen), OR more than 3 parameters.
 */
function shouldBreakArgs(list: Token[], lparenIndex: number): boolean {
  const end = findMatchingRparen(list, lparenIndex);
  if (end <= lparenIndex + 1) return false; // empty or single token
  let depth = 1;
  let commaCount = 0;
  let hasNestedCall = false;
  for (let k = lparenIndex + 1; k < end; k++) {
    const t = list[k];
    if (t.type === "lparen") depth++;
    else if (t.type === "rparen") depth--;
    if (depth !== 1) continue;
    if (t.type === "comma") commaCount++;
    if (t.type === "identifier" && list[k + 1]?.type === "lparen") hasNestedCall = true;
  }
  return hasNestedCall || commaCount >= MAX_PARAMS_INLINE; // 4+ params
}

/**
 * Format formula:
 * - For each (...) if (nested call OR >3 params): put all args on new lines; else one line.
 * - Closing ): if that call’s args were broken, newline + indent before ).
 * - Before ||/&&: newline only if line too long.
 */
export function formatFormula(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return source;

  let tokens: Token[];
  try {
    tokens = tokenize(trimmed);
  } catch {
    return source;
  }

  const list = tokens.filter((t) => t.type !== "eof");
  if (list.length === 0) return source;

  const breakArgsMap = new Map<number, boolean>(); // lparen index -> shouldBreakArgs
  for (let i = 0; i < list.length; i++) {
    if (list[i].type === "lparen") {
      breakArgsMap.set(i, shouldBreakArgs(list, i));
    }
  }

  let level = 0;
  const lparenStack: number[] = [];
  let out = "";
  let lineLength = 0;
  let afterNewline = true;

  function indent(): string {
    return INDENT.repeat(level);
  }

  function emit(str: string): void {
    out += str;
    if (str.includes("\n")) {
      const last = str.lastIndexOf("\n");
      lineLength = str.length - last - 1;
      afterNewline = lineLength === 0;
    } else {
      lineLength += str.length;
      afterNewline = false;
    }
  }

  function emitNewlineIndent(): void {
    emit("\n");
    emit(indent());
    afterNewline = true;
    lineLength = level * INDENT.length;
  }

  for (let i = 0; i < list.length; i++) {
    const token = list[i];
    const text = trimmed.slice(token.start, token.end);
    const next = list[i + 1];
    const prev = list[i - 1];
    const breakArgs = lparenStack.length > 0 ? breakArgsMap.get(lparenStack[lparenStack.length - 1]) : false;

    switch (token.type) {
      case "lparen":
        emit(text);
        level++;
        lparenStack.push(i);
        if (next && next.type !== "rparen" && breakArgsMap.get(i)) {
          emitNewlineIndent();
        }
        break;
      case "rparen": {
        const openIdx =
          lparenStack.length > 0 ? lparenStack[lparenStack.length - 1] : undefined;
        const breakClose =
          openIdx !== undefined && breakArgsMap.get(openIdx) === true;
        level--;
        if (openIdx !== undefined) lparenStack.pop();
        if (breakClose) {
          emit("\n");
          emit(INDENT.repeat(Math.max(0, level)));
        }
        emit(text);
        break;
      }
      case "comma":
        emit(text);
        if (next && next.type !== "rparen") {
          if (breakArgs) {
            emitNewlineIndent();
          } else {
            emit(" ");
          }
        }
        break;
      case "andand":
      case "oror":
        // Optional: break before ||/&& if current line is long
        if (!afterNewline && lineLength + 2 > MAX_LINE_LENGTH) {
          emitNewlineIndent();
        } else if (!afterNewline && out.length > 0) {
          emit(" ");
        }
        emit(text);
        if (next && next.type !== "rparen" && next.type !== "comma") {
          emit(" ");
        }
        break;
      default:
        if (!afterNewline && out.length > 0) {
          const prev = list[i - 1];
          const needSpace =
            prev &&
            prev.type !== "lparen" &&
            prev.type !== "comma";
          if (needSpace) emit(" ");
        }
        emit(text);
        break;
    }
  }

  return out.trimEnd();
}
