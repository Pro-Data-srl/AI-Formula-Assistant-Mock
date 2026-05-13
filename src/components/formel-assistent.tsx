"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormulaInput } from "@/components/formula-input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FORMULA_FUNCTIONS,
  FUNCTION_CATEGORIES,
  FUNCTION_NAMES,
} from "@/lib/formula-functions/registry";
import { evaluateFormula, validateFormula } from "@/lib/formula-executor";
import { formatFormula } from "@/lib/formula-formatter";
import { HelpCircle, AlignHorizontalJustifyCenter } from "lucide-react";
import {
  MOCK_FIELDS,
  getMockFieldValues,
  getMockCollections,
  getMockSessionValues,
  getMockMemUserValues,
  type DataField,
} from "@/data/fields";
import { cn } from "@/lib/utils";
import { useFormel } from "@/contexts/formel-context";

/** Operators and symbols shown in Help. Must match formula-tokenizer / formula-parser. */
const HELP_OPERATORS = {
  binary: [
    { op: "+", desc: "Addition" },
    { op: "-", desc: "Subtraktion" },
    { op: "*", desc: "Multiplikation" },
    { op: "/", desc: "Division" },
    { op: "%", desc: "Modulo" },
    { op: "==", desc: "Gleich" },
    { op: "!=", desc: "Ungleich" },
    { op: "<", desc: "Kleiner" },
    { op: ">", desc: "Größer" },
    { op: "<=", desc: "Kleiner oder gleich" },
    { op: ">=", desc: "Größer oder gleich" },
    { op: "&&", desc: "Logisches Und" },
    { op: "||", desc: "Logisches Oder" },
  ],
  unary: [
    { op: "+", desc: "Unäres Plus" },
    { op: "-", desc: "Unäres Minus" },
    { op: "!", desc: "Logisches Nicht" },
  ],
  other: [
    { op: "()", desc: "Funktionsaufruf, Gruppierung" },
    { op: "[]", desc: "Index / Subscript" },
    { op: ",", desc: "Argumenttrenner" },
  ],
};

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function Formelassistent({
  initialFormula = "",
  onConfirm,
}: {
  initialFormula?: string;
  onConfirm?: (formula: string) => void;
}) {
  const { formula, setFormula } = useFormel();
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (initialFormula && !hasInitialized.current) {
      setFormula(initialFormula);
      hasInitialized.current = true;
    }
  }, [initialFormula, setFormula]);
  const [activeTab, setActiveTab] = useState<"funktionen" | "daten">("funktionen");
  const [category, setCategory] = useState<string>("---");
  const [functionSearch, setFunctionSearch] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const [selectedFunction, setSelectedFunction] = useState<string | null>(() => {
    if (!initialFormula.trim()) return "abs";
    const match = initialFormula.match(/\b(\w+)\s*\(/);
    if (match) {
      const name = match[1];
      if (FORMULA_FUNCTIONS.some((f) => f.name === name)) return name;
    }
    return "abs";
  });
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [alternativform, setAlternativform] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    value?: unknown;
    error?: string;
  } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [formulaErrorKind, setFormulaErrorKind] = useState<
    "runtime" | "validation" | null
  >(null);
  const [formulaErrorRange, setFormulaErrorRange] = useState<
    { start: number; end: number } | null
  >(null);
  const [validationActive, setValidationActive] = useState(false);

  const formulaInputRef = useRef<HTMLTextAreaElement>(null);
  const nextSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const knownFunctionNames = useMemo(
    () => new Set(FUNCTION_NAMES),
    []
  );
  const knownFieldInternalNames = useMemo(
    () => new Set(MOCK_FIELDS.map((f) => f.internalName)),
    []
  );

  const filteredFunctions = useMemo(() => {
    let list = FUNCTION_NAMES;
    if (category && category !== "---") {
      const inCategory = FORMULA_FUNCTIONS.filter((f) => f.category === category).map(
        (f) => f.name
      );
      list = list.filter((n) => inCategory.includes(n));
    }
    if (functionSearch.trim()) {
      const q = functionSearch.toLowerCase();
      list = list.filter((n) => n.toLowerCase().includes(q));
    }
    return list;
  }, [category, functionSearch]);

  const filteredFields = useMemo(() => {
    if (!fieldSearch.trim()) return MOCK_FIELDS;
    const q = fieldSearch.toLowerCase();
    return MOCK_FIELDS.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.internalName.toLowerCase().includes(q)
    );
  }, [fieldSearch]);

  const selectedFuncDetails = useMemo(
    () => FORMULA_FUNCTIONS.find((f) => f.name === selectedFunction),
    [selectedFunction]
  );

  const selectedFieldDetails = useMemo(
    () =>
      selectedField
        ? MOCK_FIELDS.find(
            (f) =>
              f.name === selectedField ||
              f.internalName === selectedField ||
              `field("${f.internalName}")` === selectedField
          )
        : null,
    [selectedField]
  );

  const handleInsertFunction = (name: string) => {
    const fn = FORMULA_FUNCTIONS.find((f) => f.name === name);
    const insert = fn ? `${name}()` : name;
    const input = formulaInputRef.current;
    const start = input?.selectionStart ?? formula.length;
    const end = input?.selectionEnd ?? formula.length;
    const newValue = formula.slice(0, start) + insert + formula.slice(end);
    setFormula(newValue);
    setSelectedFunction(name);
    nextSelectionRef.current = { start: start + insert.length, end: start + insert.length };
  };

  const handleInsertField = (field: DataField) => {
    const expr = `field("${field.internalName}")`;
    const input = formulaInputRef.current;
    const start = input?.selectionStart ?? formula.length;
    const end = input?.selectionEnd ?? formula.length;
    const newValue = formula.slice(0, start) + expr + formula.slice(end);
    setFormula(newValue);
    nextSelectionRef.current = { start: start + expr.length, end: start + expr.length };
  };

  useEffect(() => {
    if (nextSelectionRef.current && formulaInputRef.current) {
      const { start, end } = nextSelectionRef.current;
      formulaInputRef.current.focus();
      formulaInputRef.current.setSelectionRange(start, end);
      nextSelectionRef.current = null;
    }
  }, [formula]);

  const handleTest = () => {
    const result = evaluateFormula(formula, {
      fieldValues: getMockFieldValues(),
      collections: getMockCollections(),
      sessionValues: getMockSessionValues(),
      memUserValues: getMockMemUserValues(),
    });
    setTestResult(
      result.success
        ? { success: true, value: result.value }
        : { success: false, error: result.error }
    );
    if (!result.success) {
      setFormulaError(result.error);
      setFormulaErrorKind("runtime");
      if (result.start != null && result.end != null) {
        const leadingLen = formula.match(/^\s*/)?.[0].length ?? 0;
        setFormulaErrorRange({
          start: leadingLen + result.start,
          end: leadingLen + result.end,
        });
      } else {
        setFormulaErrorRange(null);
      }
    } else {
      setFormulaError(null);
      setFormulaErrorKind(null);
      setFormulaErrorRange(null);
    }
  };

  useEffect(() => {
    setTestResult(null);
    setFormulaError(null);
    setFormulaErrorKind(null);
    setFormulaErrorRange(null);
    setValidationActive(false);
  }, [formula]);

  const handleFormulaBlur = () => {
    setValidationActive(true);
    const result = validateFormula(formula, {
      knownFunctionNames,
      knownFieldInternalNames,
    });
    if (result) {
      const hasRange = result.start != null && result.end != null;
      setFormulaError(
        hasRange
          ? `${result.message} (Zeichen ${result.start! + 1}–${result.end!})`
          : result.message
      );
      setFormulaErrorKind("validation");
      if (hasRange) {
        const leadingLen = formula.match(/^\s*/)?.[0].length ?? 0;
        setFormulaErrorRange({
          start: leadingLen + result.start!,
          end: leadingLen + result.end!,
        });
      } else {
        setFormulaErrorRange(null);
      }
    } else {
      setFormulaError(null);
      setFormulaErrorKind(null);
      setFormulaErrorRange(null);
    }
  };

  return (
    <Card className="flex min-h-0 max-h-full w-full max-w-4xl flex-1 flex-col font-sans">
      <CardHeader className="shrink-0 border-b pb-3">
        <CardTitle className="text-center text-lg">Formelassistent</CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-4">
        {/* Top formula input */}
        <div className="shrink-0 rounded-lg border bg-muted/30 px-3 py-2">
          <FormulaInput
            ref={formulaInputRef}
            value={formula}
            onChange={setFormula}
            onBlur={handleFormulaBlur}
            knownFunctionNames={knownFunctionNames}
            validationActive={validationActive}
            placeholder="Formel eingeben..."
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "funktionen" | "daten")}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
        >
          <TabsList variant="line" className="w-fit shrink-0">
            <TabsTrigger value="funktionen">Funktionen</TabsTrigger>
            <TabsTrigger value="daten">Daten</TabsTrigger>
          </TabsList>

          <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.8fr] gap-4 overflow-hidden">
            {/* Left panel */}
            <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
              {activeTab === "funktionen" ? (
                <>
                  <Select value={category} onValueChange={(v) => setCategory(v ?? "---")}>
                    <SelectTrigger className="w-full shrink-0">
                      <SelectValue placeholder="---" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="---">---</SelectItem>
                      {FUNCTION_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative shrink-0">
                    <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Suchen"
                      value={functionSearch}
                      onChange={(e) => setFunctionSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                    <div className="p-1">
                      {filteredFunctions.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setSelectedFunction(name)}
                          onDoubleClick={() => handleInsertFunction(name)}
                          className={cn(
                            "w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                            selectedFunction === name && "bg-primary/10 text-primary"
                          )}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative shrink-0">
                    <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Suchen"
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                    <div className="p-1">
                      {filteredFields.map((field) => (
                        <button
                          key={field.internalName}
                          type="button"
                          onClick={() => setSelectedField(field.name)}
                          onDoubleClick={() => handleInsertField(field)}
                          className={cn(
                            "w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent",
                            selectedField === field.name &&
                              "bg-primary/10 text-primary"
                          )}
                        >
                          {field.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-sm">
                    <Checkbox
                      checked={alternativform}
                      onCheckedChange={(v) => setAlternativform(!!v)}
                    />
                    Alternativform
                  </label>
                </>
              )}
            </div>

            {/* Right panel */}
            <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
              <div className="flex shrink-0 items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleTest}>
                  Test
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFormula(formatFormula(formula))}
                  title="Formel formatieren (Zeilenumbrüche, Einrückung)"
                >
                  <AlignHorizontalJustifyCenter className="mr-1.5 size-4" />
                  Formatieren
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setHelpOpen(true)}
                  aria-label="Hilfe: verfügbare Operatoren"
                >
                  <HelpCircle className="size-4" />
                  <span className="sr-only">Hilfe</span>
                </Button>
              </div>
              <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                <DialogContent showCloseButton className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Verfügbare Operatoren</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="mb-1.5 font-medium">Binäre Operatoren</p>
                      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                        {HELP_OPERATORS.binary.map(({ op, desc }) => (
                          <li key={op} className="font-mono">
                            <span className="text-foreground">{op}</span> — {desc}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1.5 font-medium">Unäre Operatoren</p>
                      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                        {HELP_OPERATORS.unary.map(({ op, desc }) => (
                          <li key={op} className="font-mono">
                            <span className="text-foreground">{op}</span> — {desc}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1.5 font-medium">Sonstige</p>
                      <ul className="space-y-1 text-muted-foreground">
                        {HELP_OPERATORS.other.map(({ op, desc }) => (
                          <li key={op} className="font-mono">
                            <span className="text-foreground">{op}</span> — {desc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              {(testResult !== null || formulaError) && (
                <div
                  className={cn(
                    "shrink-0 rounded-md border px-3 py-2 text-sm font-mono",
                    testResult !== null && testResult.success
                      ? "border-green-500/50 bg-green-500/10 text-green-800 dark:text-green-200"
                      : "border-destructive/50 bg-destructive/10 text-destructive"
                  )}
                >
                  {testResult !== null && testResult.success ? (
                    <p>
                      <span className="font-medium">Ergebnis: </span>
                      {typeof testResult.value === "object" && testResult.value !== null
                        ? JSON.stringify(testResult.value)
                        : String(testResult.value)}
                    </p>
                  ) : (
                    <p>
                      <span className="font-medium">
                        {testResult !== null
                          ? "Ausnahme: "
                          : formulaErrorKind === "runtime"
                            ? "Ausnahme: "
                            : "Validierung: "}
                      </span>
                      {testResult?.error ?? formulaError}
                    </p>
                  )}
                </div>
              )}
              {/* Details panel – uses remaining space */}
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm font-sans">
                {activeTab === "funktionen" && selectedFuncDetails ? (
                  <div className="space-y-2 font-sans">
                    <p className="font-medium">
                      {selectedFuncDetails.signature}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedFuncDetails.description}
                    </p>
                    <div>
                      <p className="font-medium">Parameter:</p>
                      <ul className="list-disc pl-4 text-muted-foreground">
                        {selectedFuncDetails.parameters.map((p) => (
                          <li key={p.name}>
                            {p.name}: {p.description}
                          </li>
                        ))}
                        {selectedFuncDetails.parameters.length === 0 && (
                          <li>Keine Parameter.</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">Rückgabewert:</p>
                      <p className="text-muted-foreground">
                        {selectedFuncDetails.returnValue}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Beispiel:</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedFuncDetails.example}
                      </p>
                    </div>
                  </div>
                ) : activeTab === "daten" && selectedFieldDetails ? (
                  <div className="space-y-1 font-sans text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Name:</span>{" "}
                      {selectedFieldDetails.name}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Interner Name:
                      </span>{" "}
                      {selectedFieldDetails.internalName}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Für Lesen:
                      </span>{" "}
                      {selectedFieldDetails.forReading ? "Ja" : "Nein"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Erforderlich:
                      </span>{" "}
                      {selectedFieldDetails.required ? "Ja" : "Nein"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Automat. Wertvergabe:
                      </span>{" "}
                      {selectedFieldDetails.autoValue ? "Ja" : "Nein"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Assistent:
                      </span>{" "}
                      {selectedFieldDetails.assistant ? "Ja" : "Nein"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Handler:</span>{" "}
                      {selectedFieldDetails.handler}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Datentyp:
                      </span>{" "}
                      {selectedFieldDetails.dataType}
                    </p>
                    {selectedFieldDetails.constraints && (
                      <p>
                        <span className="font-medium text-foreground">
                          Constraints:
                        </span>{" "}
                        {selectedFieldDetails.constraints}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Wählen Sie eine Funktion oder ein Feld aus, um Details
                    anzuzeigen.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
