import { mockFunctionSource } from "./mock-source";
import type { FunctionSource } from "./source";
import type { FormulaFunctionDefinition } from "./types";

export function createFunctionRegistry(sources: FunctionSource[]) {
  const functions: FormulaFunctionDefinition[] = [];
  const byName = new Map<string, FormulaFunctionDefinition>();

  for (const source of sources) {
    for (const definition of source.getFunctions()) {
      const resolved = {
        ...definition,
        origin: definition.origin ?? source.id,
      };
      byName.set(resolved.name, resolved);
    }
  }

  for (const definition of byName.values()) {
    functions.push(definition);
  }

  return {
    sources,
    functions,
    byName,
  };
}

export const FUNCTION_SOURCES: FunctionSource[] = [mockFunctionSource];

export const functionRegistry = createFunctionRegistry(FUNCTION_SOURCES);

export const FORMULA_FUNCTIONS = functionRegistry.functions;

export const FUNCTION_NAMES = FORMULA_FUNCTIONS.map((definition) => definition.name);

export const FUNCTION_NAMES_SET = new Set(FUNCTION_NAMES);

export const FUNCTION_CATEGORIES = Array.from(
  new Set(FORMULA_FUNCTIONS.map((definition) => definition.category))
);

export const EXECUTABLE_FUNCTIONS = FORMULA_FUNCTIONS.filter(
  (definition) => typeof definition.impl === "function"
);

export const TESTABLE_FUNCTION_NAMES = new Set(
  EXECUTABLE_FUNCTIONS.map((definition) => definition.name)
);

export function getFunctionByName(name: string): FormulaFunctionDefinition | undefined {
  return functionRegistry.byName.get(name);
}
