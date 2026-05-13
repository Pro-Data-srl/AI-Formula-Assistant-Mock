/**
 * Pratt parser for formula expressions.
 * Produces an AST that the executor can evaluate.
 */

import type { Token, TokenType } from "./formula-tokenizer";
import { tokenize } from "./formula-tokenizer";

// —— AST node types (loc = source range for error highlighting) ——

export type Loc = { start: number; end: number };

export type AstNode =
  | { kind: "literal"; value: string | number | boolean | null; loc?: Loc }
  | { kind: "call"; name: string; args: AstNode[]; loc?: Loc }
  | { kind: "binary"; op: BinaryOp; left: AstNode; right: AstNode }
  | { kind: "unary"; op: UnaryOp; arg: AstNode }
  | { kind: "subscript"; base: AstNode; index: AstNode };

export type BinaryOp =
  | "||"
  | "&&"
  | "=="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "+"
  | "-"
  | "*"
  | "/"
  | "%";

export type UnaryOp = "!" | "+" | "-";

// Precedence: higher = tighter binding. * / % > + - > comparisons > == != > && > ||
const BINARY_PRECEDENCE: Record<string, number> = {
  "||": 0,
  "&&": 1,
  "==": 2,
  "!=": 2,
  "<": 3,
  ">": 3,
  "<=": 3,
  ">=": 3,
  "+": 4,
  "-": 4,
  "*": 5,
  "/": 5,
  "%": 5,
};

export function parse(source: string): AstNode {
  const tokens = tokenize(source);
  const p = new Parser(tokens);
  const node = p.parseExpression(0);
  p.expect("eof");
  return node;
}

class Parser {
  private i = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.i] ?? this.tokens[this.tokens.length - 1];
  }

  private at(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    const t = this.peek();
    if (t.type !== "eof") this.i++;
    return t;
  }

  expect(type: TokenType): Token {
    const t = this.advance();
    if (t.type !== type)
      throw new Error(`Erwartet ${type}, erhalten ${t.type} an Position ${t.start}`);
    return t;
  }

  parseExpression(minPrec: number): AstNode {
    let left = this.parsePrefix();
    for (;;) {
      const op = this.getBinaryOp();
      if (op === null || BINARY_PRECEDENCE[op] < minPrec) break;
      this.advance();
      const right = this.parseExpression(BINARY_PRECEDENCE[op] + 1);
      left = { kind: "binary", op: op as BinaryOp, left, right };
    }
    return left;
  }

  private getBinaryOp(): string | null {
    const t = this.peek();
    switch (t.type) {
      case "oror":
        return "||";
      case "andand":
        return "&&";
      case "eqeq":
        return "==";
      case "bangeq":
        return "!=";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "lteq":
        return "<=";
      case "gteq":
        return ">=";
      case "plus":
        return "+";
      case "minus":
        return "-";
      case "star":
        return "*";
      case "slash":
        return "/";
      case "percent":
        return "%";
      default:
        return null;
    }
  }

  private parsePrefix(): AstNode {
    // Subscript: primary [ expr ]
    let node = this.parsePrimary();
    while (this.at("lbracket")) {
      this.advance(); // [
      const index = this.parseExpression(0);
      this.expect("rbracket");
      node = { kind: "subscript", base: node, index };
    }
    return node;
  }

  private parsePrimary(): AstNode {
    // Unary + - !
    if (this.at("plus")) {
      this.advance();
      return { kind: "unary", op: "+", arg: this.parsePrefix() };
    }
    if (this.at("minus")) {
      this.advance();
      return { kind: "unary", op: "-", arg: this.parsePrefix() };
    }
    if (this.at("bang")) {
      this.advance();
      return { kind: "unary", op: "!", arg: this.parsePrefix() };
    }

    // Literals
    if (this.at("number")) {
      const t = this.advance();
      return { kind: "literal", value: t.value as number, loc: { start: t.start, end: t.end } };
    }
    if (this.at("string")) {
      const t = this.advance();
      return { kind: "literal", value: t.value as string, loc: { start: t.start, end: t.end } };
    }
    if (this.at("true")) {
      const t = this.advance();
      return { kind: "literal", value: true, loc: { start: t.start, end: t.end } };
    }
    if (this.at("false")) {
      const t = this.advance();
      return { kind: "literal", value: false, loc: { start: t.start, end: t.end } };
    }
    if (this.at("null")) {
      const t = this.advance();
      return { kind: "literal", value: null, loc: { start: t.start, end: t.end } };
    }

    // Parenthesized expression
    if (this.at("lparen")) {
      this.advance();
      const expr = this.parseExpression(0);
      this.expect("rparen");
      return expr;
    }

    // Call: identifier ( ... )
    if (this.at("identifier")) {
      const t = this.advance();
      const name = t.value as string;
      if (!this.at("lparen"))
        throw new Error(`Erwartet "(" nach Bezeichner "${name}" an Position ${t.start}`);
      this.advance(); // (
      const args: AstNode[] = [];
      while (!this.at("rparen")) {
        args.push(this.parseExpression(0));
        if (!this.at("rparen")) this.expect("comma");
      }
      const rparen = this.expect("rparen");
      return { kind: "call", name, args, loc: { start: t.start, end: rparen.end } };
    }

    const t = this.peek();
    throw new Error(`Unerwartetes Token ${t.type} an Position ${t.start}`);
  }
}
