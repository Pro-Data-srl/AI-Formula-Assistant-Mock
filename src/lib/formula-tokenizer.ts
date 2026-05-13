/**
 * Tokenizer for formula expressions.
 * Produces a list of tokens for the Pratt parser.
 */

export type TokenType =
  | "number"
  | "string"
  | "true"
  | "false"
  | "null"
  | "identifier"
  | "lparen"
  | "rparen"
  | "comma"
  | "lbracket"
  | "rbracket"
  | "plus"
  | "minus"
  | "star"
  | "slash"
  | "percent"
  | "bang"
  | "eqeq"
  | "bangeq"
  | "lt"
  | "gt"
  | "lteq"
  | "gteq"
  | "andand"
  | "oror"
  | "eof";

export interface Token {
  type: TokenType;
  value?: string | number;
  start: number;
  end: number;
}

const KEYWORDS: Record<string, TokenType> = {
  true: "true",
  false: "false",
  null: "null",
};

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;

  function skipWhitespace(): void {
    while (i < n && /[\s\u00a0]/.test(source[i])) i++;
  }

  function makeToken(
    type: TokenType,
    value: string | number | undefined,
    startIndex: number,
    endIndex: number
  ): Token {
    return { type, value, start: startIndex, end: endIndex };
  }

  while (i < n) {
    skipWhitespace();
    if (i >= n) break;

    const start = i;
    const c = source[i];

    // String literals "..." or '...'
    if (c === '"' || c === "'") {
      const quote = c;
      const start = i;
      i++;
      let value = "";
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\") {
          i++;
          if (i < n) value += source[i++];
        } else {
          value += source[i++];
        }
      }
      if (i < n) i++;
      tokens.push(makeToken("string", value, start, i));
      continue;
    }

    // Numbers: integer or decimal
    if (/[0-9]/.test(c) || (c === "." && i + 1 < n && /[0-9]/.test(source[i + 1]))) {
      const start = i;
      let numStr = "";
      if (c === ".") {
        numStr = "0.";
        i++;
      }
      while (i < n && /[0-9]/.test(source[i])) numStr += source[i++];
      if (i < n && source[i] === "." && !numStr.includes(".")) {
        numStr += source[i++];
        while (i < n && /[0-9]/.test(source[i])) numStr += source[i++];
      }
      const value = numStr.includes(".") ? parseFloat(numStr) : parseInt(numStr, 10);
      tokens.push(makeToken("number", value, start, i));
      continue;
    }

    // Two-char operators (check before single-char)
    const two = source.slice(i, i + 2);
    if (two === "==") {
      tokens.push(makeToken("eqeq", undefined, i, i + 2));
      i += 2;
      continue;
    }
    if (two === "!=") {
      tokens.push(makeToken("bangeq", undefined, i, i + 2));
      i += 2;
      continue;
    }
    if (two === "<=") {
      tokens.push(makeToken("lteq", undefined, i, i + 2));
      i += 2;
      continue;
    }
    if (two === ">=") {
      tokens.push(makeToken("gteq", undefined, i, i + 2));
      i += 2;
      continue;
    }
    if (two === "&&") {
      tokens.push(makeToken("andand", undefined, i, i + 2));
      i += 2;
      continue;
    }
    if (two === "||") {
      tokens.push(makeToken("oror", undefined, i, i + 2));
      i += 2;
      continue;
    }

    // Single-char tokens
    const single: Record<string, TokenType> = {
      "(": "lparen",
      ")": "rparen",
      ",": "comma",
      "[": "lbracket",
      "]": "rbracket",
      "+": "plus",
      "-": "minus",
      "*": "star",
      "/": "slash",
      "%": "percent",
      "!": "bang",
      "<": "lt",
      ">": "gt",
    };
    if (single[c]) {
      tokens.push(makeToken(single[c], undefined, i, i + 1));
      i++;
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(c)) {
      const start = i;
      let id = "";
      while (i < n && /[a-zA-Z0-9_.]/.test(source[i])) id += source[i++];
      const type = KEYWORDS[id] ?? "identifier";
      tokens.push(makeToken(type, type === "identifier" ? id : undefined, start, i));
      continue;
    }

    throw new Error(`Unerwartetes Zeichen an Position ${i}: "${c}"`);
  }

  tokens.push({ type: "eof", start: i, end: i });
  return tokens;
}
