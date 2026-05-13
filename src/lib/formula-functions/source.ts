import type { FormulaFunctionDefinition } from "./types";

export interface FunctionSource {
  id: string;
  getFunctions(): FormulaFunctionDefinition[];
}
