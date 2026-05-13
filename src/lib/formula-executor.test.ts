/**
 * Unit tests for formula executor, validation, and mock functions.
 * Covers evaluateFormula, validateFormula, and formulas from the eval dataset.
 */
import { describe, it, expect } from "vitest";
import {
  evaluateFormula,
  validateFormula,
  type EvaluateOptions,
} from "./formula-executor";
import {
  getMockFieldValues,
  getMockCollections,
  getMockSessionValues,
  getMockMemUserValues,
} from "@/data/fields";
import { FUNCTION_NAMES_SET } from "./formula-functions/registry";
import { MOCK_FIELDS } from "@/data/fields";

const KNOWN_FIELD_NAMES = new Set([
  ...MOCK_FIELDS.map((f) => f.internalName),
  "UserEmployee.Code",
  "Employee.Code",
  "Usage",
  "ID",
]);

function evalOpts(overrides?: Partial<EvaluateOptions>): EvaluateOptions {
  return {
    fieldValues: getMockFieldValues(),
    collections: getMockCollections(),
    sessionValues: getMockSessionValues(),
    memUserValues: getMockMemUserValues(),
    ...overrides,
  };
}

describe("evaluateFormula", () => {
  describe("basic functions", () => {
    it("addDays(date(), 7)", () => {
      const r = evaluateFormula('addDays(date(), 7)', evalOpts());
      expect(r.success).toBe(true);
      expect(typeof (r as { success: true; value: unknown }).value).toBe("string");
    });

    it("round(field(\"Betrag\"), 2)", () => {
      const r = evaluateFormula('round(field("Betrag"), 2)', evalOpts());
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(209.9);
    });

    it("iif(field(\"Betrag\") < 0, abs(field(\"Betrag\")), 0)", () => {
      const r = evaluateFormula(
        'iif(field("Betrag") < 0, abs(field("Betrag")), 0)',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(0);
    });
  });

  describe("toStr, parseBigDecimal, color", () => {
    it("toStr(field(\"Betrag\"))", () => {
      const r = evaluateFormula('toStr(field("Betrag"))', evalOpts());
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe("209.9");
    });

    it("parseBigDecimal(\"0,00\")", () => {
      const r = evaluateFormula('parseBigDecimal("0,00")', evalOpts());
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(0);
    });

    it("color(0, 240, 0)", () => {
      const r = evaluateFormula("color(0, 240, 0)", evalOpts());
      expect(r.success).toBe(true);
      const v = (r as { success: true; value: unknown }).value as { r: number; g: number; b: number };
      expect(v.r).toBe(0);
      expect(v.g).toBe(240);
      expect(v.b).toBe(0);
    });
  });

  describe("lngSel", () => {
    it("lngSel with default language (de)", () => {
      const r = evaluateFormula(
        'lngSel("de", "Herr", "it", "Signor")',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe("Herr");
    });

    it("lngSel with language override", () => {
      const r = evaluateFormula(
        'lngSel("de", "Herr", "it", "Signor")',
        evalOpts({ language: "it" })
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe("Signor");
    });
  });

  describe("collections (collSum, collCount, collConcat)", () => {
    it("collSum(\"Positionen\", \"Betrag\", filter())", () => {
      const r = evaluateFormula(
        'collSum("Positionen", "Betrag", filter())',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(359.9);
    });

    it("collSum with filterComp", () => {
      const r = evaluateFormula(
        'collSum("Positionen", "Betrag", filter(filterComp("Artikelart", "=", "Handel")))',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(309.9);
    });

    it("collCount(\"Positionen\", filter())", () => {
      const r = evaluateFormula('collCount("Positionen", filter())', evalOpts());
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(3);
    });

    it("collConcat(\"Positionen\", \"Bez\", \", \", null, filter())", () => {
      const r = evaluateFormula(
        'collConcat("Positionen", "Bez", ", ", null, filter())',
        evalOpts()
      );
      expect(r.success).toBe(true);
      const v = (r as { success: true; value: unknown }).value as string;
      expect(v).toContain("Artikel A");
      expect(v).toContain("Artikel B");
    });

    it("collConcatDistinct(\"Positionen\", \"Artikelart\", \"|\")", () => {
      const r = evaluateFormula(
        'collConcatDistinct("Positionen", "Artikelart", "|", null, filter())',
        evalOpts()
      );
      expect(r.success).toBe(true);
      const v = (r as { success: true; value: unknown }).value as string;
      expect(v.split("|").sort()).toEqual(["Dienst", "Handel"]);
    });

    it("getCollEntry(\"Positionen\", null, null)", () => {
      const r = evaluateFormula(
        'getCollEntry("Positionen", null, null)',
        evalOpts()
      );
      expect(r.success).toBe(true);
      const v = (r as { success: true; value: unknown }).value as Record<string, unknown>;
      expect(v).toBeTruthy();
      expect(v.Betrag).toBe(100);
    });
  });

  describe("Dienstleistungszeiten collection", () => {
    it("collSum Dienstleistungszeiten Dauer (verrechnet only)", () => {
      const r = evaluateFormula(
        'collSum("Dienstleistungszeiten", "Dauer", filter(filterComp("Verrech", "=", true)))',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(5400000);
    });

    it("collCount FF_BeschrUngueltig", () => {
      const r = evaluateFormula(
        'collCount("Dienstleistungszeiten", filter(filterComp("FF_BeschrUngueltig", "=", true)))',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(1);
    });
  });

  describe("manipulators (sessionMan, memUserMan)", () => {
    it("field(\"UserEmployee.Code\", sessionMan())", () => {
      const r = evaluateFormula(
        'field("UserEmployee.Code", sessionMan())',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe("EMP-001");
    });

    it("field(\"ID\", memUserMan())", () => {
      const r = evaluateFormula('field("ID", memUserMan())', evalOpts());
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(42);
    });

    it("refMan(\"Kunde\")", () => {
      const r = evaluateFormula('refMan("Kunde")', evalOpts());
      expect(r.success).toBe(true);
      const v = (r as { success: true; value: unknown }).value as { _type: string; ref: string };
      expect(v._type).toBe("ref");
      expect(v.ref).toBe("Kunde");
    });
  });

  describe("isNewObject", () => {
    it("isNewObject() returns false by default", () => {
      const r = evaluateFormula("isNewObject()", evalOpts());
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(false);
    });

    it("isNewObject() returns true when isNewObject: true", () => {
      const r = evaluateFormula("isNewObject()", evalOpts({ isNewObject: true }));
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(true);
    });
  });

  describe("strMatches, memoToStr", () => {
    it("strMatches with placeholder pattern", () => {
      const r = evaluateFormula(
        'strMatches(field("Bez"), ".*<<(.*?)>>.*")',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(false);
    });

    it("strMatches matches when pattern fits", () => {
      const r = evaluateFormula(
        'strMatches("Text <<placeholder>> mehr", ".*<<(.*?)>>.*")',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(true);
    });

    it("memoToStr", () => {
      const r = evaluateFormula('memoToStr(field("Betrag"))', evalOpts());
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe("209.9");
    });
  });

  describe("validation formulas (boolean)", () => {
    it("field(\"Verrech\") && isEmpty(field(\"Kunde\"))", () => {
      const r = evaluateFormula(
        'field("Verrech") && isEmpty(field("Kunde"))',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect(typeof (r as { success: true; value: unknown }).value).toBe("boolean");
    });

    it("containsData(field(\"Dauer\")) && strLen(field(\"Bem\")) < 20", () => {
      const r = evaluateFormula(
        'containsData(field("Dauer")) && strLen(field("Bem")) < 20',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(true);
    });

    it("round((field(\"LeistBis\") - field(\"LeistVon\")) / 86400000)", () => {
      const r = evaluateFormula(
        'round((field("LeistBis") - field("LeistVon")) / 86400000)',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe(30);
    });

    it("expSel(field(\"Typ\") - 1, \"Aktiv\", \"Passiv\", \"Sonstige\")", () => {
      const r = evaluateFormula(
        'expSel(field("Typ") - 1, "Aktiv", "Passiv", "Sonstige")',
        evalOpts()
      );
      expect(r.success).toBe(true);
      expect((r as { success: true; value: unknown }).value).toBe("Aktiv");
    });
  });

  describe("errors", () => {
    it("unknown function fails", () => {
      const r = evaluateFormula("unknownFn(1)", evalOpts());
      expect(r.success).toBe(false);
      expect((r as { success: false; error: string }).error).toContain("Unbekannte");
    });

    it("unknown field fails", () => {
      const r = evaluateFormula('field("NichtVorhanden")', evalOpts());
      expect(r.success).toBe(false);
      expect((r as { success: false; error: string }).error).toContain("nicht gefunden");
    });

    it("unknown collection fails", () => {
      const r = evaluateFormula(
        'collSum("NichtVorhanden", "Betrag", filter())',
        evalOpts()
      );
      expect(r.success).toBe(false);
      expect((r as { success: false; error: string }).error).toContain("nicht gefunden");
    });
  });
});

describe("validateFormula", () => {
  it("valid formula returns null", () => {
    const r = validateFormula('addDays(date(), 7)', {
      knownFunctionNames: FUNCTION_NAMES_SET,
      knownFieldInternalNames: KNOWN_FIELD_NAMES,
    });
    expect(r).toBeNull();
  });

  it("unknown function returns error", () => {
    const r = validateFormula("unknownFn(1)", {
      knownFunctionNames: FUNCTION_NAMES_SET,
      knownFieldInternalNames: KNOWN_FIELD_NAMES,
    });
    expect(r).not.toBeNull();
    expect(r?.message).toContain("Unbekannte");
  });

  it("unknown field returns error", () => {
    const r = validateFormula('field("NichtVorhanden")', {
      knownFunctionNames: FUNCTION_NAMES_SET,
      knownFieldInternalNames: KNOWN_FIELD_NAMES,
    });
    expect(r).not.toBeNull();
    expect(r?.message).toContain("Unbekanntes Feld");
  });

  it("wrong arity returns error", () => {
    const r = validateFormula('filterComp("A", "B")', {
      knownFunctionNames: FUNCTION_NAMES_SET,
      knownFieldInternalNames: KNOWN_FIELD_NAMES,
    });
    expect(r).not.toBeNull();
    expect(r?.message).toContain("Argument");
  });

  it("validates complex formula with collections", () => {
    const r = validateFormula(
      'collSum("Positionen", "Betrag", filter(filterComp("Offen", "=", true)))',
      {
        knownFunctionNames: FUNCTION_NAMES_SET,
        knownFieldInternalNames: KNOWN_FIELD_NAMES,
      }
    );
    expect(r).toBeNull();
  });

  it("validates formula with sessionMan", () => {
    const r = validateFormula(
      'field("UserEmployee.Code", sessionMan())',
      {
        knownFunctionNames: FUNCTION_NAMES_SET,
        knownFieldInternalNames: KNOWN_FIELD_NAMES,
      }
    );
    expect(r).toBeNull();
  });
});

describe("dataset formulas (smoke)", () => {
  const formulas = [
    'addDays(date(), 7)',
    'firstDateOfPeriod(date(), "MONTH")',
    'iif(field("Betrag") < 0, abs(field("Betrag")), 0)',
    'round(field("Betrag"), 2)',
    'iif(isEmpty(field("Kunde")), field("Betrag") * -1, field("Betrag"))',
    'getPartOfDate(field("LiefDat"), "DAY_OF_MONTH")',
    'round(field("Betrag") * (1 + field("Handelskosten") / 100), 2)',
    'strChain(" - ", field("Artikelart"), field("ArtNr"), field("Bez"))',
    'collSum("Positionen", "Betrag", filter())',
    'collSum("Positionen", "Betrag", filter(filterComp("Artikelart", "=", "Handel")))',
    'collCount("Positionen", filter())',
    'round(field("Dauer") / 3600000, 2)',
    'iif(field("Verrech"), field("Betrag"), 0)',
    '(round(field("Grundlage") / field("Einstandsbetrag") * 100, 2)) - 100',
    'field("Verrech") && isEmpty(field("Kunde"))',
    'containsData(field("Dauer")) && strLen(field("Bem")) < 20',
    'collCount("Dienstleistungszeiten", filter(filterComp("FF_BeschrUngueltig", "=", true))) > 0',
    'field("UserEmployee.Code", sessionMan())',
    'isEmpty(field("Kunde")) && field("Status") > 2',
  ];

  formulas.forEach((formula) => {
    it(`evaluates: ${formula.substring(0, 60)}...`, () => {
      const r = evaluateFormula(formula, evalOpts());
      expect(r.success).toBe(true);
    });
  });
});
