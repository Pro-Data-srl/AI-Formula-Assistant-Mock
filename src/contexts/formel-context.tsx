"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

type FormelContextValue = {
  formula: string;
  setFormula: (formula: string | ((prev: string) => string)) => void;
};

const FormelContext = createContext<FormelContextValue | null>(null);

export function FormelProvider({ children }: { children: ReactNode }) {
  const [formula, setFormulaState] = useState("");

  const setFormula = useCallback(
    (value: string | ((prev: string) => string)) => {
      setFormulaState((prev) =>
        typeof value === "function" ? value(prev) : value
      );
    },
    []
  );

  return (
    <FormelContext.Provider value={{ formula, setFormula }}>
      {children}
    </FormelContext.Provider>
  );
}

export function useFormel() {
  const ctx = useContext(FormelContext);
  if (!ctx) throw new Error("useFormel must be used within FormelProvider");
  return ctx;
}
