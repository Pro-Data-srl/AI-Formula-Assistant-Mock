/**
 * Formula executor: tokenize → parse → evaluate AST.
 * Supports expressions with operators and function calls; field("name") resolves via fieldValues.
 */

import type { AstNode, BinaryOp, UnaryOp } from "./formula-parser";
import { parse } from "./formula-parser";
import {
  getFunctionByName,
  TESTABLE_FUNCTION_NAMES,
} from "./formula-functions/registry";
import type {
  FormulaFunctionArity,
  FormulaFunctionRuntimeContext,
} from "./formula-functions/types";

export type EvalResult =
  | { success: true; value: unknown }
  | { success: false; error: string; start?: number; end?: number };

/** Error with optional source range (for underlining in the formula input). */
export class FormulaError extends Error {
  constructor(
    message: string,
    public readonly start?: number,
    public readonly end?: number
  ) {
    super(message);
    this.name = "FormulaError";
    Object.setPrototypeOf(this, FormulaError.prototype);
  }
}

export type EvaluateOptions = {
  testArgs?: unknown[];
  /** Map of field internalName → value for resolving field("..."). */
  fieldValues?: Record<string, unknown>;
  /** Mock collections for collSum, collCount, collConcat, getCollEntry. */
  collections?: Record<string, Record<string, unknown>[]>;
  /** Current language for lngSel (e.g. "de", "it"). Default: "de". */
  language?: string;
  /** Session values for field("X", sessionMan()). */
  sessionValues?: Record<string, unknown>;
  /** MemUser values for field("X", memUserMan()). */
  memUserValues?: Record<string, unknown>;
  /** True if current record is new (for isNewObject()). Default: false. */
  isNewObject?: boolean;
};

export type ValidateFormulaOptions = {
  /** If provided, report unknown function names not in this set. */
  knownFunctionNames?: Set<string>;
  /** If provided, report field("x") when x is not in this set. */
  knownFieldInternalNames?: Set<string>;
};

export type ValidationResult =
  | null
  | { message: string; start?: number; end?: number };

/**
 * Validate formula without executing. Returns first error with optional source range.
 * Range is set for AST validation errors (unknown function/field, arity); parse errors have position.
 */
export function validateFormula(
  formula: string,
  options?: ValidateFormulaOptions
): ValidationResult {
  const trimmed = formula.trim();
  if (!trimmed) return null;

  try {
    const ast = parse(trimmed);
    const knownFns = options?.knownFunctionNames;
    const knownFields = options?.knownFieldInternalNames;

    if (knownFns || knownFields) {
      const err = firstValidationError(ast, knownFns, knownFields);
      if (err) return err;
    }
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const pos = message.match(/Position (\d+)/)?.[1];
    return pos !== undefined
      ? { message, start: parseInt(pos, 10), end: parseInt(pos, 10) + 1 }
      : { message };
  }
}

function firstValidationError(
  node: AstNode,
  knownFns?: Set<string>,
  knownFields?: Set<string>
): { message: string; start: number; end: number } | null {
  switch (node.kind) {
    case "call": {
      if (knownFns && !knownFns.has(node.name)) {
        return node.loc
          ? { message: `Unbekannte Funktion: ${node.name}`, start: node.loc.start, end: node.loc.end }
          : { message: `Unbekannte Funktion: ${node.name}`, start: 0, end: 0 };
      }
      const arityError = getFunctionArityError(node.name, node.args.length);
      if (arityError)
        return node.loc
          ? { message: arityError, start: node.loc.start, end: node.loc.end }
          : { message: arityError, start: 0, end: 0 };
      if (knownFields && node.name === "field" && node.args.length > 0) {
        const first = node.args[0];
        if (first.kind === "literal" && typeof first.value === "string") {
          if (!knownFields.has(first.value)) {
            const loc = first.loc ?? node.loc;
            return loc
              ? { message: `Unbekanntes Feld: ${first.value}`, start: loc.start, end: loc.end }
              : { message: `Unbekanntes Feld: ${first.value}`, start: 0, end: 0 };
          }
        }
      }
      for (const arg of node.args) {
        const err = firstValidationError(arg, knownFns, knownFields);
        if (err) return err;
      }
      return null;
    }
    case "binary":
      return (
        firstValidationError(node.left, knownFns, knownFields) ??
        firstValidationError(node.right, knownFns, knownFields)
      );
    case "unary":
      return firstValidationError(node.arg, knownFns, knownFields);
    case "subscript":
      return (
        firstValidationError(node.base, knownFns, knownFields) ??
        firstValidationError(node.index, knownFns, knownFields)
      );
    default:
      return null;
  }
}

/** Parse and evaluate a formula expression (supports operators and function calls). */
export function evaluateFormula(
  formula: string,
  options?: EvaluateOptions
): EvalResult {
  const trimmed = formula.trim();
  if (!trimmed) {
    return { success: false, error: "Leere Formel." };
  }

  const context: EvalContext = {
    testArgs: options?.testArgs ?? [],
    fieldValues: options?.fieldValues ?? {},
    collections: options?.collections,
    language: options?.language,
    sessionValues: options?.sessionValues,
    memUserValues: options?.memUserValues,
    isNewObject: options?.isNewObject,
  };

  try {
    const ast = parse(trimmed);
    const value = evaluateAst(ast, context);
    return { success: true, value: formatResult(value) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const start =
      e instanceof FormulaError ? e.start : (e as { start?: number }).start;
    const end =
      e instanceof FormulaError ? e.end : (e as { end?: number }).end;
    const pos = message.match(/Position (\d+)/)?.[1];
    const rangeStart =
      start != null && end != null ? start : pos !== undefined ? parseInt(pos, 10) : undefined;
    const rangeEnd =
      start != null && end != null ? end : pos !== undefined ? parseInt(pos, 10) + 1 : undefined;
    const errorMessage =
      rangeStart != null && rangeEnd != null
        ? `${message} (Zeichen ${rangeStart + 1}–${rangeEnd})`
        : message;
    return {
      success: false,
      error: errorMessage,
      ...(rangeStart != null && rangeEnd != null && { start: rangeStart, end: rangeEnd }),
    };
  }
}

type EvalContext = FormulaFunctionRuntimeContext;

function formatResult(v: unknown): unknown {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (Array.isArray(v)) return v.map(formatResult);
  return v;
}

function toFormulaError(e: unknown, loc?: { start: number; end: number }): FormulaError {
  if (e instanceof FormulaError) return e;
  const message = e instanceof Error ? e.message : String(e);
  return new FormulaError(
    message,
    loc?.start,
    loc?.end
  );
}

function evaluateAst(node: AstNode, context: EvalContext): unknown {
  try {
    switch (node.kind) {
      case "literal":
        return node.value;
      case "call": {
        const values = node.args.map((a) => evaluateAst(a, context));
        return callFunction(node.name, values, context, node.loc);
      }
      case "unary": {
        const arg = evaluateAst(node.arg, context);
        return evalUnary(node.op, arg);
      }
      case "binary": {
        const left = evaluateAst(node.left, context);
        const right = evaluateAst(node.right, context);
        return evalBinary(node.op, left, right);
      }
      case "subscript": {
        const base = evaluateAst(node.base, context);
        const index = num(evaluateAst(node.index, context));
        if (Array.isArray(base)) {
          if (!Number.isInteger(index) || index < 0 || index >= base.length) {
            throw new Error(
              `Index ${index} außerhalb des gültigen Bereichs (0 bis ${base.length - 1}).`
            );
          }
          return base[index];
        }
        if (typeof base === "string") {
          if (!Number.isInteger(index) || index < 0 || index >= base.length) {
            throw new Error(
              `Index ${index} außerhalb des gültigen Bereichs (0 bis ${base.length - 1}).`
            );
          }
          return base[index];
        }
        throw new Error(
          `Index-Zugriff nur auf Arrays oder Strings möglich, erhalten: ${typeof base}.`
        );
      }
      default:
        throw new Error("Unbekannter AST-Knoten");
    }
  } catch (e) {
    const loc = "loc" in node && node.loc ? node.loc : undefined;
    throw toFormulaError(e, loc);
  }
}

function evalUnary(op: UnaryOp, arg: unknown): unknown {
  switch (op) {
    case "+":
      return num(arg);
    case "-":
      return -num(arg);
    case "!":
      return !truthy(arg);
    default:
      throw new FormulaError(`Unärer Operator nicht unterstützt: ${op}`);
  }
}

function truthy(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return !Number.isNaN(v) && v !== 0;
  if (typeof v === "string") return v.length > 0;
  return true;
}

function evalBinary(op: BinaryOp, left: unknown, right: unknown): unknown {
  switch (op) {
    case "||":
      return truthy(left) ? left : right;
    case "&&":
      return truthy(left) ? right : left;
    case "==":
      return looseEq(left, right);
    case "!=":
      return !looseEq(left, right);
    case "<":
      return compare(left, right) < 0;
    case ">":
      return compare(left, right) > 0;
    case "<=":
      return compare(left, right) <= 0;
    case ">=":
      return compare(left, right) >= 0;
    case "+":
      return add(left, right);
    case "-":
      return num(left) - num(right);
    case "*":
      return num(left) * num(right);
    case "/": {
      const r = num(right);
      if (r === 0) throw new FormulaError("Division durch null ist nicht erlaubt.");
      return num(left) / r;
    }
    case "%": {
      const r = num(right);
      if (r === 0) throw new FormulaError("Modulo mit null ist nicht erlaubt.");
      return num(left) % r;
    }
    default:
      throw new FormulaError(`Binärer Operator nicht unterstützt: ${op}`);
  }
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" && typeof b === "number") return a === b;
  return String(a) === String(b);
}

function compare(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  const na = num(a);
  const nb = num(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function add(left: unknown, right: unknown): unknown {
  if (typeof left === "string" || typeof right === "string")
    return String(left ?? "") + String(right ?? "");
  return num(left) + num(right);
}

function callFunction(
  name: string,
  values: unknown[],
  context: EvalContext,
  loc?: { start: number; end: number }
): unknown {
  const definition = getFunctionByName(name);
  if (!definition) throw new FormulaError(`Unbekannte oder nicht testbare Funktion: ${name}`, loc?.start, loc?.end);
  const arityError = getFunctionArityError(name, values.length);
  if (arityError) throw new FormulaError(arityError, loc?.start, loc?.end);
  if (!definition.impl) {
    throw new FormulaError(`Funktion ${name} ist in der aktiven Quelle nicht ausführbar.`, loc?.start, loc?.end);
  }
  try {
    return definition.impl(values, context);
  } catch (e) {
    throw toFormulaError(e, loc);
  }
}

function getFunctionArityError(name: string, received: number): string | null {
  const spec = getFunctionByName(name)?.arity;
  if (!spec) return null;

  if (received < spec.min) {
    return formatArityError(name, spec, received);
  }

  if (spec.max !== undefined && received > spec.max) {
    return formatArityError(name, spec, received);
  }

  return null;
}

function formatArityError(
  name: string,
  spec: FormulaFunctionArity,
  received: number
): string {
  if (spec.max === undefined) {
    return `Funktion ${name} erwartet mindestens ${spec.min} ${pluralizeArgument(spec.min)}, erhalten: ${received}.`;
  }

  if (spec.min === spec.max) {
    return `Funktion ${name} erwartet genau ${spec.min} ${pluralizeArgument(spec.min)}, erhalten: ${received}.`;
  }

  return `Funktion ${name} erwartet ${spec.min} bis ${spec.max} ${pluralizeArgument(spec.max)}, erhalten: ${received}.`;
}

function pluralizeArgument(count: number): string {
  return count === 1 ? "Argument" : "Argumente";
}

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (v === true) return 1;
  if (v === false || v === null || v === undefined) return 0;
  if (v instanceof Date) return v.getTime();
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}
