export type FormulaFunctionArity = {
  min: number;
  max?: number;
};

export type FormulaFunctionParameter = {
  name: string;
  description: string;
};

export type FormulaFunctionRuntimeContext = {
  testArgs: unknown[];
  fieldValues: Record<string, unknown>;
  /** Mock collections for collSum, collCount, collConcat, getCollEntry. Map: collection name → array of records. */
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

export type FormulaFunctionImplementation = (
  values: unknown[],
  context: FormulaFunctionRuntimeContext
) => unknown;

export interface FormulaFunctionDefinition {
  name: string;
  category: string;
  signature: string;
  description: string;
  parameters: FormulaFunctionParameter[];
  returnValue: string;
  example: string;
  arity: FormulaFunctionArity;
  impl?: FormulaFunctionImplementation;
  origin?: string;
}
