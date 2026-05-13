import type { FunctionSource } from "./source";
import type {
  FormulaFunctionArity,
  FormulaFunctionDefinition,
  FormulaFunctionImplementation,
  FormulaFunctionRuntimeContext,
} from "./types";

type FormulaFunctionDoc = Omit<FormulaFunctionDefinition, "arity" | "impl" | "origin">;

type RuntimeDescriptor = {
  arity: FormulaFunctionArity;
  impl?: FormulaFunctionImplementation;
};

const FUNCTION_DOCS: FormulaFunctionDoc[] = [
  {
    name: "arg",
    category: "Konvertierung",
    signature: "arg(iIndex)",
    description:
      "Zugriff auf übergebene Argumente. Liefert das Argument an der angegebenen Indexposition.",
    parameters: [
      { name: "iIndex", description: "Ganzzahl mit dem Index des Arguments (nullbasiert)." },
    ],
    returnValue: "Der Wert des Arguments.",
    example: "arg(0)",
  },
  {
    name: "argCount",
    category: "Konvertierung",
    signature: "n argCount()",
    description: "Liefert die Anzahl der übergebenen Argumente.",
    parameters: [],
    returnValue: "Die Anzahl der Argumente.",
    example: "argCount()",
  },
  {
    name: "parseDate",
    category: "Konvertierung",
    signature: "d parseDate(sDatumsString, sFormat)",
    description: "Wandelt einen String in ein Datum um.",
    parameters: [
      { name: "sDatumsString", description: "Der String, der das Datum enthält." },
      {
        name: "sFormat",
        description:
          "(Optional) Format z.B. YYYYMMDD, DDMMYYYY. Fehlt er, werden OS-Einstellungen verwendet.",
      },
    ],
    returnValue: "Das entsprechende Datum.",
    example: 'parseDate("19761230", "YYYYMMDD") Ergebnis: 30.12.1976',
  },
  {
    name: "toInt",
    category: "Konvertierung",
    signature: "n toInt(xWert)",
    description: "Wandelt einen Wert beliebigen Datentyps in eine Ganzzahl um.",
    parameters: [{ name: "xWert", description: "Ein Wert beliebigen Datentyps." }],
    returnValue: "Die entsprechende Ganzzahl.",
    example: 'toInt("42")',
  },
  {
    name: "toDate",
    category: "Konvertierung",
    signature: "d toDate(xWert)",
    description: "Wandelt einen Wert beliebigen Datentyps in ein Datum um.",
    parameters: [{ name: "xWert", description: "Ein Wert beliebigen Datentyps." }],
    returnValue: "Das entsprechende Datum.",
    example: 'toDate(field("Datum"))',
  },
  {
    name: "char",
    category: "Konvertierung",
    signature: "c char(nWert)",
    description: "Umwandlung einer Nummer in ein einzelnes Unicode-Zeichen.",
    parameters: [{ name: "nWert", description: "Die Unicode-Nummer des Zeichens." }],
    returnValue: "Das entsprechende Zeichen.",
    example: 'char(65) Ergebnis: "A"',
  },
  {
    name: "parseTime",
    category: "Konvertierung",
    signature: "t parseTime(sUhrzeitString, sFormat)",
    description: "Wandelt einen String in eine Uhrzeit um.",
    parameters: [
      { name: "sUhrzeitString", description: "Der String, der die Uhrzeit enthält." },
      {
        name: "sFormat",
        description: "(Optional) Format z.B. HHmmss, HH:mm:ss. Default: HHmmss.",
      },
    ],
    returnValue: "Die entsprechende Uhrzeit (als Date mit heutigem Datum).",
    example: 'parseTime("011512", "HHmmss") Ergebnis: 01:15:12',
  },
  {
    name: "array",
    category: "Daten",
    signature: "array(xWert1, ..., xWertN)",
    description: "Verpackt die angegebenen Parameter in ein Array.",
    parameters: [{ name: "xWert1 bis xWertN", description: "Die Elemente für das Array." }],
    returnValue: "Die in einem Array verpackten Elemente.",
    example: "array(1, 2, 3)",
  },
  {
    name: "arrayLength",
    category: "Daten",
    signature: "n arrayLength(oArray)",
    description: "Ermittelt die Größe eines Arrays.",
    parameters: [{ name: "oArray", description: "Das Ausgangsarray." }],
    returnValue: "Die Größe des angegebenen Arrays.",
    example: "arrayLength(array(1,2,3)) Ergebnis: 3",
  },
  {
    name: "element",
    category: "Daten",
    signature: "element(oArray, iIndex)",
    description: "Entnimmt einem Array ein Element.",
    parameters: [
      { name: "oArray", description: "Das Ausgangsarray." },
      { name: "iIndex", description: "Der nullbasierte Index." },
    ],
    returnValue: "Das vom Index adressierte Element.",
    example: "element(array(10,20,30), 1) Ergebnis: 20",
  },
  {
    name: "isEmpty",
    category: "Daten",
    signature: "b isEmpty(xWert)",
    description: "Prüft, ob ein Wert leer ist.",
    parameters: [{ name: "xWert", description: "Ein Wert beliebigen Datentyps." }],
    returnValue: "Ja: der Wert ist leer; Nein: der Wert ist nicht leer.",
    example: 'isEmpty(field("Name"))',
  },
  {
    name: "containsData",
    category: "Daten",
    signature: "b containsData(xWert)",
    description: "Prüft, ob ein Wert Daten enthält (Gegenteil von isEmpty).",
    parameters: [{ name: "xWert", description: "Ein Wert beliebigen Datentyps." }],
    returnValue: "Ja: der Wert enthält Daten; Nein: der Wert enthält keine Daten.",
    example: 'containsData(field("Betrag"))',
  },
  {
    name: "iif",
    category: "Daten",
    signature: "iif(bAuswahl, xOperand1, xOperand2, xOperand3?)",
    description:
      "(immediate IF) Bool'scher Wert plus zwei oder drei Operanden. Liefert je nach Bedingung den ersten, zweiten oder dritten Operanden.",
    parameters: [
      { name: "bAuswahl", description: "Boolean-Wert für die Auswahl." },
      { name: "xOperand1", description: "Erster Operand." },
      { name: "xOperand2", description: "Zweiter Operand (gleicher Typ wie erster)." },
      {
        name: "xOperand3",
        description:
          "(Optional) Dritter Operand, falls bAuswahl null und drei Operanden angegeben.",
      },
    ],
    returnValue: "Der ausgewählte Operand.",
    example: "iif(true, 5, 10) Ergebnis: 5",
  },
  {
    name: "expSel",
    category: "Daten",
    signature: "expSel(iAuswahl, xOperand1, ..., xOperandN)",
    description:
      "(Expression selection) Auswahl von mehreren Ausdrücken per Index. Liefert den Operanden an der Indexposition.",
    parameters: [
      { name: "iAuswahl", description: "Ganzzahl für die Auswahl (0-basiert)." },
      {
        name: "xOperand1 bis xOperandN",
        description: "Die Operanden; der Index bestimmt, welcher geliefert wird.",
      },
    ],
    returnValue: "Der Operand an der Indexposition.",
    example: "expSel(1, 100, 200, 300, 400) Ergebnis: 200",
  },
  {
    name: "addDays",
    category: "Datum & Uhrzeit",
    signature: "d addDays(dDatum, iTage)",
    description: "Addiert eine Anzahl von Tagen zu einem gegebenen Datum.",
    parameters: [
      { name: "dDatum", description: "Ein Date oder Timestamp." },
      {
        name: "iTage",
        description: "Anzahl der zu addierenden bzw. subtrahierenden Tage.",
      },
    ],
    returnValue: "Das entsprechende Datum.",
    example: "addDays(date(), 7) Ergebnis: Datum in einer Woche",
  },
  {
    name: "addMonths",
    category: "Datum & Uhrzeit",
    signature: "d addMonths(dDatum, iMonate)",
    description: "Addiert eine Anzahl von Monaten zu einem gegebenen Datum.",
    parameters: [
      { name: "dDatum", description: "Ein Date oder Timestamp." },
      {
        name: "iMonate",
        description: "Anzahl der zu addierenden bzw. subtrahierenden Monate.",
      },
    ],
    returnValue: "Das entsprechende Datum.",
    example: "addMonths(date(), 3)",
  },
  {
    name: "addYears",
    category: "Datum & Uhrzeit",
    signature: "d addYears(dDatum, iJahre)",
    description: "Addiert eine Anzahl von Jahren zu einem gegebenen Datum.",
    parameters: [
      { name: "dDatum", description: "Ein Date oder Timestamp." },
      {
        name: "iJahre",
        description: "Anzahl der zu addierenden bzw. subtrahierenden Jahre.",
      },
    ],
    returnValue: "Das entsprechende Datum.",
    example: "addYears(date(), 1)",
  },
  {
    name: "firstDateOfPeriod",
    category: "Datum & Uhrzeit",
    signature: "d firstDateOfPeriod(dDatum, sPeriode)",
    description: "Ermittelt das Anfangsdatum einer bestimmten Periode.",
    parameters: [
      { name: "dDatum", description: "Ein Date, Time oder Timestamp." },
      {
        name: "sPeriode",
        description: "DAY, WEEK, WEEK_MONTH, MONTH, QUARTER oder YEAR.",
      },
    ],
    returnValue: "Das Anfangsdatum der Periode.",
    example: 'firstDateOfPeriod(date(), "MONTH")',
  },
  {
    name: "lastDateOfPeriod",
    category: "Datum & Uhrzeit",
    signature: "d lastDateOfPeriod(dDatum, sPeriode)",
    description: "Ermittelt das Enddatum einer bestimmten Periode.",
    parameters: [
      { name: "dDatum", description: "Ein Date, Time oder Timestamp." },
      {
        name: "sPeriode",
        description: "DAY, WEEK, WEEK_MONTH, MONTH, QUARTER oder YEAR.",
      },
    ],
    returnValue: "Das Enddatum der Periode.",
    example: 'lastDateOfPeriod(date(), "MONTH")',
  },
  {
    name: "date",
    category: "Datum & Uhrzeit",
    signature: "d date()",
    description: "Liefert das aktuelle Datum.",
    parameters: [],
    returnValue: "Das aktuelle Datum.",
    example: "date()",
  },
  {
    name: "dateTime",
    category: "Datum & Uhrzeit",
    signature: "d dateTime()",
    description: "Liefert das aktuelle Datum und die aktuelle Uhrzeit.",
    parameters: [],
    returnValue: "Aktuelles Datum und Uhrzeit.",
    example: "dateTime()",
  },
  {
    name: "formatDate",
    category: "Datum & Uhrzeit",
    signature: "s formatDate(pDatum, aMuster, sSprache?)",
    description:
      "Formatiert ein Datum mit/ohne Uhrzeit und wandelt es in einen String um (z.B. dd.MM.yyyy oder S, M, L, F).",
    parameters: [
      { name: "pDatum", description: "Das zu formatierende Datum." },
      {
        name: "aMuster",
        description:
          "String oder Einzelzeichen für das Format (z.B. dd.MM.yyyy oder S=Short, M=Medium, L=Long, F=Full).",
      },
      { name: "sSprache", description: "(Optional) Gewünschte Sprache." },
    ],
    returnValue: "Der formatierte Datum-String.",
    example: 'formatDate(date(), "dd.MM.yyyy")',
  },
  {
    name: "getPartOfDate",
    category: "Datum & Uhrzeit",
    signature: "n getPartOfDate(dDatum, sDatumsbestandteil)",
    description:
      "Extrahiert aus einem Datum einen Datumsbestandteil als numerischen Wert.",
    parameters: [
      { name: "dDatum", description: "Ein Date, Time oder Timestamp." },
      {
        name: "sDatumsbestandteil",
        description:
          "YEAR, MONTH, DATE, DAY_OF_WEEK, HOUR, MINUTE, SECOND, WEEK_OF_YEAR, etc.",
      },
    ],
    returnValue: "Der entsprechende Datumsbestandteil als Zahl.",
    example: 'getPartOfDate(date(), "YEAR")',
  },
  {
    name: "getNameOfMonth",
    category: "Datum & Uhrzeit",
    signature: "s getNameOfMonth(iWert, bShortForm?, sSprache?)",
    description:
      "Konvertiert einen numerischen Wert (1–12) oder ein Datum in einen Monatsnamen.",
    parameters: [
      {
        name: "iWert",
        description: "1=Jänner … 12=Dezember, oder ein Date/Timestamp.",
      },
      {
        name: "bShortForm",
        description: "(Optional) true für Kurzform (JAN), false für Normalform (Januar).",
      },
      { name: "sSprache", description: "(Optional) Gewünschte Sprache." },
    ],
    returnValue: "Ein String mit dem Monatsnamen.",
    example: 'getNameOfMonth(date(), false, "de")',
  },
  {
    name: "field",
    category: "Felder & Manipulatoren",
    signature: "field(sFeldName, oManipulator?)",
    description:
      "Feldlesezugriff. Liest den Wert eines Feldes (beim Test: Mock-Werte aus Daten).",
    parameters: [
      { name: "sFeldName", description: "Der Name des Feldes (interner Name)." },
      { name: "oManipulator", description: "(Optional) Beim Test ignoriert." },
    ],
    returnValue: "Der Feldwert.",
    example: 'field("Betrag") oder field("LiefDat")',
  },
  {
    name: "abs",
    category: "Numerisch",
    signature: "n abs(nZahl)",
    description: "Ermittelt den Absolutwert einer Zahl (ohne Vorzeichen).",
    parameters: [{ name: "nZahl", description: "Ein numerischer Wert." }],
    returnValue: "Der Absolutwert.",
    example: "abs(-1.56) Ergebnis: 1.56",
  },
  {
    name: "avg",
    category: "Numerisch",
    signature: "n avg(nWert1, ..., nWertN)",
    description: "Berechnet den Durchschnitt der angegebenen Parameter.",
    parameters: [
      {
        name: "nWert1 bis nWertN",
        description: "Numerische Werte oder Namen von Variablenarrays/Stacks.",
      },
    ],
    returnValue: "Der berechnete Durchschnitt.",
    example: "avg(1, 2, 3) Ergebnis: 2",
  },
  {
    name: "count",
    category: "Numerisch",
    signature: "n count(nWert1, ..., nWertN)",
    description: "Ermittelt die Anzahl der Parameter.",
    parameters: [
      {
        name: "nWert1 bis nWertN",
        description: "Die zu zählenden Werte (oder Array-/Stack-Namen).",
      },
    ],
    returnValue: "Die Anzahl der Parameter.",
    example: "count(1, 2, 3) Ergebnis: 3",
  },
  {
    name: "max",
    category: "Numerisch",
    signature: "n max(nWert1, ..., nWertN)",
    description: "Ermittelt den Höchstwert aus den angegebenen Werten.",
    parameters: [
      {
        name: "nWert1 bis nWertN",
        description: "Die zu vergleichenden Werte (oder Array-/Stack-Namen).",
      },
    ],
    returnValue: "Der ermittelte Höchstwert.",
    example: "max(1, 2, 3) Ergebnis: 3",
  },
  {
    name: "min",
    category: "Numerisch",
    signature: "n min(nWert1, ..., nWertN)",
    description: "Ermittelt den Mindestwert aus den angegebenen Werten.",
    parameters: [
      {
        name: "nWert1 bis nWertN",
        description: "Die zu vergleichenden Werte (oder Array-/Stack-Namen).",
      },
    ],
    returnValue: "Der ermittelte Mindestwert.",
    example: "min(1, 2, 3) Ergebnis: 1",
  },
  {
    name: "sum",
    category: "Numerisch",
    signature: "n sum(nWert1, ..., nWertN)",
    description: "Ermittelt die Summe aller angegebenen Parameter.",
    parameters: [
      {
        name: "nWert1 bis nWertN",
        description: "Die zu summierenden Werte (oder Array-/Stack-Namen).",
      },
    ],
    returnValue: "Die berechnete Summe.",
    example: "sum(1, 2, 3) Ergebnis: 6",
  },
  {
    name: "round",
    category: "Numerisch",
    signature: "n round(nZahl, iStellen?)",
    description:
      "Rundet Zahlen. Auch negative Stellen erlaubt (z.B. -1 für Zehner).",
    parameters: [
      { name: "nZahl", description: "Ein numerischer Wert." },
      {
        name: "iStellen",
        description: "(Optional) Anzahl Stellen, auf die gerundet werden soll.",
      },
    ],
    returnValue: "Die gerundete Zahl.",
    example: "round(1.56) Ergebnis: 2; round(1234, -1) Ergebnis: 1230",
  },
  {
    name: "intPart",
    category: "Numerisch",
    signature: "n intPart(nZahl)",
    description:
      "Ermittelt den Ganzzahlanteil einer Zahl (ohne Nachkommastellen).",
    parameters: [{ name: "nZahl", description: "Ein numerischer Wert." }],
    returnValue: "Der Ganzzahlanteil.",
    example: "intPart(1.56) Ergebnis: 1",
  },
  {
    name: "fracPart",
    category: "Numerisch",
    signature: "n fracPart(nZahl)",
    description:
      "Ermittelt den Nachkommaanteil einer Zahl (ohne Ganzzahlanteil).",
    parameters: [{ name: "nZahl", description: "Ein numerischer Wert." }],
    returnValue: "Der Nachkommaanteil.",
    example: "fracPart(1.56) Ergebnis: 0.56",
  },
  {
    name: "randomInt",
    category: "Numerisch",
    signature: "n randomInt(iLimit1, iLimit2?)",
    description:
      "Liefert eine zufällige Ganzzahl im angegebenen Wertebereich.",
    parameters: [
      { name: "iLimit1", description: "Erstes Limit der Zufallszahl." },
      { name: "iLimit2", description: "(Optional) Zweites Limit; Standard 1." },
    ],
    returnValue:
      "Zufällige Zahl zwischen niedrigerem und höherem Wert der beiden Limits.",
    example: "randomInt(1, 100)",
  },
  {
    name: "zeroNumStr",
    category: "Numerisch",
    signature: "s zeroNumStr(iWert, iLaenge)",
    description:
      "Wandelt eine Ganzzahl in einen String mit führenden Nullen um. Vorzeichen wird ignoriert.",
    parameters: [
      { name: "iWert", description: "Der ganzzahlige Wert." },
      {
        name: "iLaenge",
        description: "Ganzzahl für die Länge des Strings. Bei zu großer Zahl werden Ziffern links abgeschnitten.",
      },
    ],
    returnValue: "Ein mit Nullen aufgefüllter String.",
    example: 'zeroNumStr(42, 5) Ergebnis: "00042"',
  },
  {
    name: "println",
    category: "Ausgabe & Formatierung",
    signature: "println(sMeldung, oWert)",
    description:
      "Gibt die angegebene Meldung und den Wert auf den Standard-Output aus. Liefert die Stringdarstellung des Wertes zurück.",
    parameters: [
      { name: "sMeldung", description: "Ein String mit der Meldung." },
      { name: "oWert", description: "Der auszugebende Wert." },
    ],
    returnValue: "Die Stringdarstellung des Wertes.",
    example: 'println("Ergebnis:", field("Betrag"))',
  },
  {
    name: "str",
    category: "Text",
    signature: "s str(oWert)",
    description:
      "Wandelt einen Wert beliebigen Datentyps in einen nicht lokalisierten String um (internes Format).",
    parameters: [{ name: "oWert", description: "Ein Wert beliebigen Datentyps." }],
    returnValue: 'Der nicht lokalisierte String, z.B. Datum als "20010816".',
    example: 'str(date()) Ergebnis: "20010816"',
  },
  {
    name: "strLen",
    category: "Text",
    signature: "n strLen(sString)",
    description: "Ermittelt die Länge eines Strings.",
    parameters: [{ name: "sString", description: "Ein String." }],
    returnValue: "Die Länge des Strings. Bei null wird 0 geliefert.",
    example: 'strLen("Hallo") Ergebnis: 5',
  },
  {
    name: "subStr",
    category: "Text",
    signature: "s subStr(sString, iStartPos, iEndPos?)",
    description:
      "Ermittelt einen Teilstring. Start- und Endposition (Endpos exklusiv). Nicht tolerant gegenüber falschen Positionen.",
    parameters: [
      { name: "sString", description: "Der Quellstring." },
      { name: "iStartPos", description: "Startposition des Teilstrings." },
      { name: "iEndPos", description: "(Optional) Endposition (exklusiv)." },
    ],
    returnValue: "Der Teilstring.",
    example: 'subStr("Hallo Welt", 0, 5) Ergebnis: "Hallo"',
  },
  {
    name: "leftStr",
    category: "Text",
    signature: "s leftStr(sString, iAnzahl)",
    description: "Ermittelt einen Teilstring am Anfang des übergebenen Strings.",
    parameters: [
      { name: "sString", description: "Der Quellstring." },
      { name: "iAnzahl", description: "Anzahl der Zeichen vom Anfang." },
    ],
    returnValue: "Der Teilstring vom Anfang.",
    example: 'leftStr("Hallo", 2) Ergebnis: "Ha"',
  },
  {
    name: "strIndexOf",
    category: "Text",
    signature: "n strIndexOf(sString, sSuchString, iStartIndex?)",
    description:
      "Liefert den Index (0-basiert) des ersten Vorkommens des Teilstrings. -1 falls nicht gefunden.",
    parameters: [
      { name: "sString", description: "Der zu durchsuchende String." },
      { name: "sSuchString", description: "Der zu suchende Teilstring." },
      { name: "iStartIndex", description: "(Optional) Startindex der Suche." },
    ],
    returnValue: "Der Index oder -1.",
    example: 'strIndexOf("Hallo Welt", "ll") Ergebnis: 2',
  },
  {
    name: "midStr",
    category: "Text",
    signature: "s midStr(sString, iStartPos, iEndPos?)",
    description:
      "Ermittelt einen Teilstring wie subStr, aber bei Folgeparametern toleranter.",
    parameters: [
      { name: "sString", description: "Der String." },
      { name: "iStartPos", description: "Startposition." },
      { name: "iEndPos", description: "(Optional) Endposition (exklusiv)." },
    ],
    returnValue: "Der Teilstring.",
    example: 'midStr("Hallo", 1, 4)',
  },
  {
    name: "rightStr",
    category: "Text",
    signature: "s rightStr(sString, iAnzahl)",
    description:
      "Ermittelt einen Teilstring am Ende des übergebenen Strings.",
    parameters: [
      {
        name: "sString",
        description: "Der Quellstring (null liefert VOID).",
      },
      { name: "iAnzahl", description: "Anzahl der Zeichen vom Ende." },
    ],
    returnValue: "Der Teilstring vom Ende.",
    example: 'rightStr("Hallo", 2) Ergebnis: "lo"',
  },
  {
    name: "strTrim",
    category: "Text",
    signature: "s strTrim(sString)",
    description:
      "Entfernt Whitespace (Leerzeichen) an beiden Enden des Strings.",
    parameters: [{ name: "sString", description: "Ein String." }],
    returnValue: "Der bereinigte String. Bei null wird null geliefert.",
    example: 'strTrim("  Text  ") Ergebnis: "Text"',
  },
  {
    name: "strUpper",
    category: "Text",
    signature: "s strUpper(sString)",
    description:
      "Konvertiert alle Zeichen im String in Großbuchstaben.",
    parameters: [{ name: "sString", description: "Ein String." }],
    returnValue: "Der String in Großbuchstaben.",
    example: 'strUpper("hallo") Ergebnis: "HALLO"',
  },
  {
    name: "strLower",
    category: "Text",
    signature: "s strLower(sString)",
    description:
      "Konvertiert alle Zeichen im String in Kleinbuchstaben.",
    parameters: [{ name: "sString", description: "Ein String." }],
    returnValue: "Der String in Kleinbuchstaben.",
    example: 'strLower("HALLO") Ergebnis: "hallo"',
  },
  {
    name: "dupStr",
    category: "Text",
    signature: "s dupStr(sText, iAnzahl)",
    description: "Dupliziert einen String (Wiederholung).",
    parameters: [
      { name: "sText", description: "Der zu wiederholende String." },
      { name: "iAnzahl", description: "Anzahl der Wiederholungen." },
    ],
    returnValue: "Der duplizierte String.",
    example: 'dupStr("*", 9) Ergebnis: "*********"',
  },
  {
    name: "strReplace",
    category: "Text",
    signature: "s strReplace(sString, sTeilstring, sErsatz, ...)",
    description:
      "Ersetzt alle Vorkommnisse eines Teilstrings durch einen Ersatzstring.",
    parameters: [
      { name: "sString", description: "Der zu durchsuchende String." },
      { name: "sTeilstring", description: "Der zu ersetzende Teilstring." },
      { name: "sErsatz", description: "Der Ersatzstring." },
      {
        name: "bGroßKleinIgnorieren",
        description: "(Optional) Groß-/Kleinschreibung ignorieren.",
      },
    ],
    returnValue: "Der bearbeitete String.",
    example: 'strReplace("a-b-a", "a", "x") Ergebnis: "x-b-x"',
  },
  {
    name: "strChain",
    category: "Text",
    signature: "s strChain(xFuellZeichen, xWert1, ..., xWertN)",
    description:
      "Verkettet Werte beliebigen Datentyps zu einem String mit Füllzeichen dazwischen.",
    parameters: [
      {
        name: "xFuellZeichen",
        description:
          "Stringdarstellung dient als Füllzeichen zwischen den Werten.",
      },
      { name: "xWert1 bis xWertN", description: "Beliebige Werte zur Verkettung." },
    ],
    returnValue: "Der verkettete String.",
    example: 'strChain("<->", 1, 2, 3, 4) Ergebnis: "1<->2<->3<->4"',
  },
  {
    name: "strFill",
    category: "Text",
    signature: "s strFill(sString, iLaenge, aAusrichtung?, aFuellZeichen?)",
    description:
      "Bringt einen String auf die gewünschte Länge – abschneiden oder mit Füllzeichen ergänzen.",
    parameters: [
      { name: "sString", description: "Ein String." },
      { name: "iLaenge", description: "Ganzzahl mit der gewünschten Länge." },
      {
        name: "aAusrichtung",
        description: "(Optional) L=Links, C=Center, R=Rechts. Default: L.",
      },
      {
        name: "aFuellZeichen",
        description: "(Optional) Füllzeichen (Einzelzeichen). Default: Leerzeichen.",
      },
    ],
    returnValue: "Der bearbeitete String.",
    example: 'strFill("Hi", 5, "L", "0") Ergebnis: "Hi000"',
  },
  // —— Konvertierung (zusätzlich) ——
  {
    name: "toStr",
    category: "Konvertierung",
    signature: "s toStr(xWert)",
    description:
      "Alias für str. Wandelt einen Wert beliebigen Datentyps in einen String um (lokalisiert).",
    parameters: [{ name: "xWert", description: "Ein Wert beliebigen Datentyps." }],
    returnValue: "Der String.",
    example: 'toStr(field("Betrag"))',
  },
  {
    name: "parseBigDecimal",
    category: "Konvertierung",
    signature: "n parseBigDecimal(sWert)",
    description:
      "Wandelt einen String in eine Dezimalzahl um. Unterstützt deutsches Format (Komma als Dezimaltrennzeichen).",
    parameters: [{ name: "sWert", description: "String mit Zahl (z.B. \"0,00\" oder \"1.234,56\")." }],
    returnValue: "Die entsprechende Dezimalzahl.",
    example: 'parseBigDecimal("0,00")',
  },
  // —— Ausgabe & Formatierung ——
  {
    name: "color",
    category: "Ausgabe & Formatierung",
    signature: "o color(nR, nG, nB)",
    description: "Erzeugt eine Farbe aus RGB-Werten (0–255).",
    parameters: [
      { name: "nR", description: "Rot (0–255)." },
      { name: "nG", description: "Grün (0–255)." },
      { name: "nB", description: "Blau (0–255)." },
    ],
    returnValue: "Ein Farbobjekt (für newDataHandler etc.).",
    example: "color(0, 240, 0)",
  },
  {
    name: "fileExists",
    category: "Ausgabe & Formatierung",
    signature: "b fileExists(sPfad)",
    description: "Prüft, ob eine Datei oder ein Verzeichnis am angegebenen Pfad existiert.",
    parameters: [{ name: "sPfad", description: "Pfad zur Datei oder zum Verzeichnis." }],
    returnValue: "Ja: existiert; Nein: existiert nicht.",
    example: 'fileExists(field("ElDokument"))',
  },
  {
    name: "lngSel",
    category: "Text",
    signature: "s lngSel(sSprache1, xWert1, sSprache2, xWert2, ...)",
    description:
      "Sprachauswahl. Liefert den Wert zur passenden Sprache (Paare: Sprache, Wert). Nutzt context.language oder erste Sprache.",
    parameters: [
      { name: "sSprache1, xWert1, ...", description: "Paare aus Sprachcode (z.B. de, it) und Wert." },
    ],
    returnValue: "Der Wert zur gewählten Sprache.",
    example: 'lngSel("de", "Herr", "it", "Signor")',
  },
  // —— Sammlungen ——
  {
    name: "collSum",
    category: "Sammlungen",
    signature: "n collSum(sCollName, sFeldName, oFilter?)",
    description:
      "Summiert die Werte eines Feldes über alle Datensätze einer Sammlung (optional gefiltert).",
    parameters: [
      { name: "sCollName", description: "Name der Sammlung." },
      { name: "sFeldName", description: "Name des zu summierenden Feldes." },
      { name: "oFilter", description: "(Optional) Filter (filter/filterComp/filterOp)." },
    ],
    returnValue: "Die Summe.",
    example: 'collSum("Positionen", "Betrag", filter())',
  },
  {
    name: "collCount",
    category: "Sammlungen",
    signature: "n collCount(sCollName, oFilter?, oRefMan?)",
    description: "Zählt die Datensätze einer Sammlung (optional gefiltert, optional mit refMan-Kontext).",
    parameters: [
      { name: "sCollName", description: "Name der Sammlung." },
      { name: "oFilter", description: "(Optional) Filter." },
      { name: "oRefMan", description: "(Optional) refMan(\"Kunde\") etc. für Kontext." },
    ],
    returnValue: "Die Anzahl.",
    example: 'collCount("Positionen", filter())',
  },
  {
    name: "collConcat",
    category: "Sammlungen",
    signature: "s collConcat(sCollName, sFeldName, sSep, oOrder?, oFilter?)",
    description:
      "Verkettet die Feldwerte einer Sammlung mit optionalem Filter und Sortierung.",
    parameters: [
      { name: "sCollName", description: "Name der Sammlung." },
      { name: "sFeldName", description: "Name des zu verkettenden Feldes." },
      { name: "sSep", description: "Trennzeichen zwischen den Werten." },
      { name: "oOrder", description: "(Optional) Sortierung (order/orderField)." },
      { name: "oFilter", description: "(Optional) Filter." },
    ],
    returnValue: "Der verkettete String.",
    example: 'collConcat("Positionen", "Bez", ", ", null, filter())',
  },
  {
    name: "collConcatDistinct",
    category: "Sammlungen",
    signature: "s collConcatDistinct(sCollName, sFeldName, sSep, oOrder?, oFilter?)",
    description:
      "Wie collConcat, aber nur eindeutige Werte (ohne Duplikate).",
    parameters: [
      { name: "sCollName", description: "Name der Sammlung." },
      { name: "sFeldName", description: "Name des Feldes." },
      { name: "sSep", description: "Trennzeichen." },
      { name: "oOrder", description: "(Optional) Sortierung." },
      { name: "oFilter", description: "(Optional) Filter." },
    ],
    returnValue: "Der verkettete String ohne Duplikate.",
    example: 'collConcatDistinct("Positionen", "Artikelart", "|")',
  },
  {
    name: "getCollEntry",
    category: "Sammlungen",
    signature: "x getCollEntry(sCollName, oFilter?, oOrder?)",
    description:
      "Liefert den ersten Datensatz einer Sammlung (optional gefiltert und sortiert).",
    parameters: [
      { name: "sCollName", description: "Name der Sammlung." },
      { name: "oFilter", description: "(Optional) Filter." },
      { name: "oOrder", description: "(Optional) Sortierung." },
    ],
    returnValue: "Der erste Datensatz oder null.",
    example: 'getCollEntry("Positionen", null, null)',
  },
  {
    name: "filter",
    category: "Sammlungen",
    signature: "o filter(oFilterComp?, ...)",
    description:
      "Erzeugt einen Filter für collSum, collCount, collConcat, getCollEntry. Ohne Argumente: alle Datensätze.",
    parameters: [
      { name: "oFilterComp", description: "(Optional) filterComp oder filterOp." },
    ],
    returnValue: "Filterobjekt.",
    example: 'filter(filterComp("Betrag", "=", 100))',
  },
  {
    name: "filterComp",
    category: "Sammlungen",
    signature: "o filterComp(sFeld, sOp, xWert)",
    description:
      "Vergleichsbedingung: Feld sOp Wert. Unterstützt: =, !=, <, <=, >, >=, IN, EMPTY, STARTS_WITH, ENDS_WITH, !ENDS_WITH.",
    parameters: [
      { name: "sFeld", description: "Feldname (z.B. \"Betrag\" oder \"Artikel.Code\")." },
      { name: "sOp", description: "Operator (=, !=, <, <=, >, >=, IN, EMPTY, STARTS_WITH, ENDS_WITH, !ENDS_WITH)." },
      { name: "xWert", description: "Vergleichswert." },
    ],
    returnValue: "Filterbedingungsobjekt.",
    example: 'filterComp("Betrag", "=", 100)',
  },
  {
    name: "filterOp",
    category: "Sammlungen",
    signature: "o filterOp(sOp, oFilter1, oFilter2, ...)",
    description:
      "Verknüpft mehrere Filterbedingungen (AND, OR).",
    parameters: [
      { name: "sOp", description: "AND oder OR." },
      { name: "oFilter1, oFilter2, ...", description: "Filterbedingungen (filterComp oder filterOp)." },
    ],
    returnValue: "Verknüpftes Filterobjekt.",
    example: 'filterOp("AND", filterComp("Betrag", ">", 0), filterComp("Menge", "=", 1))',
  },
  // —— Text (Validierung) ——
  {
    name: "strMatches",
    category: "Text",
    signature: "b strMatches(sString, sPattern)",
    description:
      "Prüft, ob ein String einem regulären Ausdruck entspricht. Für Validierungen (z.B. Platzhalter <<...>>).",
    parameters: [
      { name: "sString", description: "Der zu prüfende String." },
      { name: "sPattern", description: "Regex-Pattern (z.B. \".*<<(.*?)>>.*\")." },
    ],
    returnValue: "Ja: String passt zum Pattern; Nein: sonst.",
    example: 'strMatches(field("Bez"), ".*<<(.*?)>>.*")',
  },
  {
    name: "memoToStr",
    category: "Text",
    signature: "s memoToStr(xMemo)",
    description:
      "Wandelt einen Memo-Wert in einen String um (für strMatches etc.).",
    parameters: [{ name: "xMemo", description: "Memo oder beliebiger Wert." }],
    returnValue: "Der String.",
    example: 'memoToStr(field("Beschreibung"))',
  },
  // —— Manipulatoren ——
  {
    name: "refMan",
    category: "Manipulatoren",
    signature: "o refMan(sRefName)",
    description:
      "Liefert einen Referenz-Manipulator (z.B. für collCount mit Kontext).",
    parameters: [{ name: "sRefName", description: "Name der Referenz (z.B. \"Kunde\")." }],
    returnValue: "Referenz-Objekt.",
    example: 'refMan("Kunde")',
  },
  {
    name: "sessionMan",
    category: "Manipulatoren",
    signature: "o sessionMan()",
    description:
      "Liefert den Session-Manipulator. Für field(\"X\", sessionMan()) – Felder aus der Session.",
    parameters: [],
    returnValue: "Session-Objekt.",
    example: 'field("UserEmployee.Code", sessionMan())',
  },
  {
    name: "memUserMan",
    category: "Manipulatoren",
    signature: "o memUserMan()",
    description:
      "Liefert den MemUser-Manipulator. Für field(\"X\", memUserMan()) – Felder des angemeldeten Benutzers.",
    parameters: [],
    returnValue: "MemUser-Objekt.",
    example: 'field("ID", memUserMan())',
  },
  {
    name: "isNewObject",
    category: "Daten",
    signature: "b isNewObject()",
    description:
      "Prüft, ob der aktuelle Datensatz neu ist (noch nicht gespeichert).",
    parameters: [],
    returnValue: "Ja: neu; Nein: bereits gespeichert.",
    example: "isNewObject()",
  },
];

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function matchesFilter(item: Record<string, unknown>, f: unknown): boolean {
  if (f == null) return true;
  const o = f as { _type?: string; field?: string; op?: string; value?: unknown; conds?: unknown[] };
  if (o._type === "all") return true;
  if (o._type === "comp") {
    const fieldVal = getNestedValue(item, o.field ?? "");
    const op = (o.op ?? "=").toUpperCase();
    const val = o.value;
    switch (op) {
      case "=":
        return looseEq(fieldVal, val);
      case "!=":
        return !looseEq(fieldVal, val);
      case "<":
        return compareVal(fieldVal, val) < 0;
      case "<=":
        return compareVal(fieldVal, val) <= 0;
      case ">":
        return compareVal(fieldVal, val) > 0;
      case ">=":
        return compareVal(fieldVal, val) >= 0;
      case "EMPTY":
        return fieldVal == null || (typeof fieldVal === "string" && fieldVal.trim() === "");
      case "IN":
        return Array.isArray(val) && val.some((v) => looseEq(fieldVal, v));
      case "STARTS_WITH":
        return String(fieldVal ?? "").startsWith(String(val ?? ""));
      case "ENDS_WITH":
        return String(fieldVal ?? "").endsWith(String(val ?? ""));
      case "!ENDS_WITH":
        return !String(fieldVal ?? "").endsWith(String(val ?? ""));
      default:
        return looseEq(fieldVal, val);
    }
  }
  if (o._type === "op") {
    const conds = (o.conds ?? []) as unknown[];
    const op = (o.op ?? "AND").toUpperCase();
    if (op === "AND") return conds.every((c) => matchesFilter(item, c));
    if (op === "OR") return conds.some((c) => matchesFilter(item, c));
  }
  return true;
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" && typeof b === "number") return a === b;
  return String(a) === String(b);
}

function compareVal(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  const na = num(a);
  const nb = num(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function getFilteredCollection(
  collName: unknown,
  filterObj: unknown,
  context: FormulaFunctionRuntimeContext
): Record<string, unknown>[] {
  const name = String(collName ?? "").trim();
  if (!name) {
    throw new Error("collSum/collCount/collConcat/getCollEntry: Sammlungsname darf nicht leer sein.");
  }
  const colls = context.collections ?? {};
  const items = colls[name];
  if (!Array.isArray(items)) {
    throw new Error(`Sammlung "${name}" nicht gefunden (nicht in Testdaten).`);
  }
  const filtered = items.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && matchesFilter(item as Record<string, unknown>, filterObj)
  );
  return filtered;
}

const FUNCTION_RUNTIME: Record<string, RuntimeDescriptor> = {
  field: {
    arity: { min: 1, max: 2 },
    impl(values, context) {
      const name = values[0];
      const key = typeof name === "string" ? name.trim() : String(name ?? "");
      if (!key) {
        throw new Error('field: Feldname darf nicht leer sein.');
      }
      const manip = values[1] as { _type?: string } | undefined;
      const valuesMap =
        manip?._type === "session"
          ? context.sessionValues
          : manip?._type === "memUser"
            ? context.memUserValues
            : context.fieldValues;
      const map = valuesMap ?? context.fieldValues;
      if (!(key in map)) {
        const src = manip?._type === "session" ? "Session" : manip?._type === "memUser" ? "MemUser" : "Testdaten";
        throw new Error(`field: Feld "${key}" nicht gefunden (${src}).`);
      }
      return map[key];
    },
  },
  arg: {
    arity: { min: 1, max: 1 },
    impl(values, context) {
      const i = num(values[0]);
      const len = context.testArgs.length;
      if (!Number.isInteger(i) || i < 0 || i >= len) {
        const range = len === 0 ? "keine Argumente übergeben" : `0 bis ${len - 1}`;
        throw new Error(`arg: Index ${i} außerhalb des gültigen Bereichs (${range}).`);
      }
      return context.testArgs[i];
    },
  },
  argCount: {
    arity: { min: 0, max: 0 },
    impl(_, context) {
      return context.testArgs.length;
    },
  },
  parseDate: {
    arity: { min: 1, max: 2 },
    impl(values) {
      const str = String(values[0] ?? "");
      const format = (values[1] as string) ?? "YYYYMMDD";
      const y = format.includes("Y")
        ? str.slice(format.indexOf("Y"), format.lastIndexOf("Y") + 1)
        : "";
      const m = format.includes("M")
        ? str.slice(format.indexOf("M"), format.lastIndexOf("M") + 1)
        : "01";
      const d = format.includes("D")
        ? str.slice(format.indexOf("D"), format.lastIndexOf("D") + 1)
        : "01";
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      if (Number.isNaN(date.getTime())) {
        throw new Error(
          `parseDate: Ungültiges Datum – "${str}" passt nicht zum Format "${format}". ` +
            `Erwartet z.B. "YYYYMMDD" → "19761230".`
        );
      }
      return date;
    },
  },
  toInt: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const v = values[0];
      if (typeof v === "number" && !Number.isNaN(v)) return Math.trunc(v);
      return parseInt(String(v ?? ""), 10) || 0;
    },
  },
  toDate: {
    arity: { min: 1, max: 1 },
    impl(values) {
      return toDateOrThrow(values[0]);
    },
  },
  char: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const n = num(values[0]);
      const code = Math.floor(n);
      if (code < 0 || code > 0x10ffff) {
        throw new Error(`char: Ungültige Unicode-Nummer ${code} (0–1114111).`);
      }
      return String.fromCodePoint(code);
    },
  },
  parseTime: {
    arity: { min: 1, max: 2 },
    impl(values) {
      const str = String(values[0] ?? "");
      const format = (values[1] as string) ?? "HHmmss";
      const fmt = format.toUpperCase();
      const h = fmt.includes("H")
        ? str.slice(fmt.indexOf("H"), fmt.lastIndexOf("H") + 1)
        : "00";
      const m = fmt.includes("M")
        ? str.slice(fmt.indexOf("M"), fmt.lastIndexOf("M") + 1)
        : "00";
      const s = fmt.includes("S")
        ? str.slice(fmt.indexOf("S"), fmt.lastIndexOf("S") + 1)
        : "00";
      const hour = parseInt(h, 10);
      const min = parseInt(m, 10);
      const sec = parseInt(s, 10);
      if (Number.isNaN(hour) || Number.isNaN(min) || Number.isNaN(sec)) {
        throw new Error(
          `parseTime: Ungültige Uhrzeit – "${str}" passt nicht zum Format "${format}". ` +
            `Erwartet z.B. "HHmmss" → "011512".`
        );
      }
      const d = new Date();
      d.setHours(hour, min, sec, 0);
      return d;
    },
  },
  array: {
    arity: { min: 0 },
    impl(values) {
      return [...values];
    },
  },
  arrayLength: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const a = values[0];
      return Array.isArray(a) ? a.length : 0;
    },
  },
  element: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const a = values[0];
      const i = num(values[1]);
      if (!Array.isArray(a)) {
        throw new Error(`element: Erstes Argument muss ein Array sein, erhalten: ${typeof a}.`);
      }
      if (!Number.isInteger(i) || i < 0 || i >= a.length) {
        throw new Error(
          `element: Index ${i} außerhalb des gültigen Bereichs (0 bis ${a.length - 1}).`
        );
      }
      return a[i];
    },
  },
  isEmpty: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const v = values[0];
      if (v == null) return true;
      if (typeof v === "string") return v.trim() === "";
      if (Array.isArray(v)) return v.length === 0;
      return false;
    },
  },
  containsData: {
    arity: { min: 1, max: 1 },
    impl(values, context) {
      return !FUNCTION_RUNTIME.isEmpty.impl?.(values, context);
    },
  },
  expSel: {
    arity: { min: 2 },
    impl(values) {
      const idx = num(values[0]);
      const operands = values.slice(1);
      if (!Number.isInteger(idx) || idx < 0 || idx >= operands.length) {
        throw new Error(
          `expSel: Index ${idx} außerhalb des gültigen Bereichs (0 bis ${operands.length - 1}).`
        );
      }
      return operands[idx];
    },
  },
  iif: {
    arity: { min: 3, max: 3 },
    impl(values) {
      const cond = values[0];
      const yes = values[1];
      const no = values[2];
      if (
        cond === true ||
        (cond !== false && cond !== null && cond !== undefined && cond !== "")
      ) {
        return yes;
      }
      return no !== undefined ? no : null;
    },
  },
  addDays: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const d = toDateOrThrow(values[0]);
      const n = num(values[1]);
      const out = new Date(d);
      out.setDate(out.getDate() + n);
      return out;
    },
  },
  addMonths: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const d = toDateOrThrow(values[0]);
      const n = num(values[1]);
      const out = new Date(d);
      out.setMonth(out.getMonth() + n);
      return out;
    },
  },
  addYears: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const d = toDateOrThrow(values[0]);
      const n = num(values[1]);
      const out = new Date(d);
      out.setFullYear(out.getFullYear() + n);
      return out;
    },
  },
  firstDateOfPeriod: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const d = toDateOrThrow(values[0]);
      const period = String(values[1] ?? "").toUpperCase();
      const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      switch (period) {
        case "DAY":
          break;
        case "WEEK": {
          const day = out.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          out.setDate(out.getDate() + diff);
          break;
        }
        case "WEEK_MONTH": {
          out.setDate(1);
          const first = new Date(out.getFullYear(), out.getMonth(), 1);
          const day = first.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          out.setDate(1 + diff);
          break;
        }
        case "MONTH":
          out.setDate(1);
          break;
        case "QUARTER": {
          const q = Math.floor(out.getMonth() / 3) * 3;
          out.setMonth(q, 1);
          break;
        }
        case "YEAR":
          out.setMonth(0, 1);
          break;
        default:
          throw new Error(
            `firstDateOfPeriod: Unbekannte Periode "${period}". ` +
              `Erlaubt: DAY, WEEK, WEEK_MONTH, MONTH, QUARTER, YEAR.`
          );
      }
      return out;
    },
  },
  lastDateOfPeriod: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const d = toDateOrThrow(values[0]);
      const period = String(values[1] ?? "").toUpperCase();
      const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      switch (period) {
        case "DAY":
          break;
        case "WEEK": {
          const day = out.getDay();
          const diff = day === 0 ? 0 : 7 - day;
          out.setDate(out.getDate() + diff);
          break;
        }
        case "WEEK_MONTH": {
          const last = new Date(out.getFullYear(), out.getMonth() + 1, 0);
          const day = last.getDay();
          out.setTime(last.getTime());
          out.setDate(last.getDate() - day);
          break;
        }
        case "MONTH":
          out.setMonth(out.getMonth() + 1, 0);
          break;
        case "QUARTER": {
          const q = Math.floor(out.getMonth() / 3) * 3 + 3;
          out.setMonth(q, 0);
          break;
        }
        case "YEAR":
          out.setMonth(12, 0);
          break;
        default:
          throw new Error(
            `lastDateOfPeriod: Unbekannte Periode "${period}". ` +
              `Erlaubt: DAY, WEEK, WEEK_MONTH, MONTH, QUARTER, YEAR.`
          );
      }
      return out;
    },
  },
  date: {
    arity: { min: 0, max: 0 },
    impl() {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },
  },
  dateTime: {
    arity: { min: 0, max: 0 },
    impl() {
      return new Date();
    },
  },
  formatDate: {
    arity: { min: 2, max: 3 },
    impl(values) {
      const d = toDateOrThrow(values[0]);
      const pattern = String(values[1] ?? "dd.MM.yyyy");
      const dd = String(d.getDate()).padStart(2, "0");
      const MM = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return pattern
        .replace("dd", dd)
        .replace("MM", MM)
        .replace("yyyy", String(yyyy))
        .replace("d", String(d.getDate()))
        .replace("M", String(d.getMonth() + 1));
    },
  },
  getPartOfDate: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const d = toDateOrThrow(values[0]);
      const part = String(values[1] ?? "").toUpperCase();
      const map: Record<string, number> = {
        YEAR: d.getFullYear(),
        MONTH: d.getMonth() + 1,
        DATE: d.getDate(),
        DAY_OF_MONTH: d.getDate(),
        DAY_OF_WEEK: d.getDay() === 0 ? 7 : d.getDay(),
        HOUR: d.getHours(),
        MINUTE: d.getMinutes(),
        SECOND: d.getSeconds(),
      };
      if (!(part in map)) {
        throw new Error(
          `getPartOfDate: Unbekannte Datumskomponente "${part}". ` +
            `Erlaubt: YEAR, MONTH, DATE, DAY_OF_MONTH, DAY_OF_WEEK, HOUR, MINUTE, SECOND.`
        );
      }
      return map[part];
    },
  },
  getNameOfMonth: {
    arity: { min: 1, max: 3 },
    impl(values) {
      const v = values[0];
      let month = typeof v === "number" ? v : toDateOrThrow(v).getMonth();
      if (v instanceof Date) month = v.getMonth();
      const short = values[1] === true;
      const names = short
        ? ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
        : [
            "Januar",
            "Februar",
            "März",
            "April",
            "Mai",
            "Juni",
            "Juli",
            "August",
            "September",
            "Oktober",
            "November",
            "Dezember",
          ];
      return names[month] ?? "";
    },
  },
  abs: {
    arity: { min: 1, max: 1 },
    impl(values) {
      return Math.abs(num(values[0]));
    },
  },
  avg: {
    arity: { min: 1 },
    impl(values) {
      const nums = values.map((v) => num(v)).filter((n) => !Number.isNaN(n));
      if (nums.length === 0) return Number.NaN;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    },
  },
  count: {
    arity: { min: 1 },
    impl(values) {
      return values.length;
    },
  },
  max: {
    arity: { min: 1 },
    impl(values) {
      if (values.length === 0) return Number.NaN;
      const nums = values.map((v) => num(v));
      return Math.max(...nums);
    },
  },
  min: {
    arity: { min: 1 },
    impl(values) {
      if (values.length === 0) return Number.NaN;
      const nums = values.map((v) => num(v));
      return Math.min(...nums);
    },
  },
  sum: {
    arity: { min: 1 },
    impl(values) {
      return values.reduce((a: number, v) => a + num(v), 0);
    },
  },
  round: {
    arity: { min: 1, max: 2 },
    impl(values) {
      const n = num(values[0]);
      const places = values[1] !== undefined ? num(values[1]) : 0;
      if (places === 0) return Math.round(n);
      const fac = 10 ** places;
      return Math.round(n * fac) / fac;
    },
  },
  intPart: {
    arity: { min: 1, max: 1 },
    impl(values) {
      return Math.trunc(num(values[0]));
    },
  },
  fracPart: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const n = num(values[0]);
      return n - Math.trunc(n);
    },
  },
  zeroNumStr: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const v = Math.floor(Math.abs(num(values[0])));
      const len = Math.max(0, Math.floor(num(values[1])));
      const s = String(v);
      if (s.length >= len) return s.slice(-len);
      return s.padStart(len, "0");
    },
  },
  randomInt: {
    arity: { min: 1, max: 2 },
    impl(values) {
      const lo = num(values[0]);
      const hi = values[1] !== undefined ? num(values[1]) : 1;
      const a = Math.min(lo, hi);
      const b = Math.max(lo, hi);
      return Math.floor(a + Math.random() * (b - a + 1));
    },
  },
  println: {
    arity: { min: 1, max: 2 },
    impl(values) {
      const msg = String(values[0] ?? "");
      const val = values[1];
      return msg + (val !== undefined ? " " + String(val) : "");
    },
  },
  str: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const v = values[0];
      if (v instanceof Date) {
        return (
          v.getFullYear() +
          String(v.getMonth() + 1).padStart(2, "0") +
          String(v.getDate()).padStart(2, "0")
        );
      }
      return String(v ?? "");
    },
  },
  strLen: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const s = values[0];
      return s == null ? 0 : String(s).length;
    },
  },
  subStr: {
    arity: { min: 2, max: 3 },
    impl(values) {
      const s = String(values[0] ?? "");
      const start = num(values[1]);
      const end = values[2] !== undefined ? num(values[2]) : s.length;
      return s.slice(start, end);
    },
  },
  leftStr: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const s = String(values[0] ?? "");
      const n = num(values[1]);
      if (n <= 0) return "";
      return s.slice(0, n);
    },
  },
  strIndexOf: {
    arity: { min: 2, max: 3 },
    impl(values) {
      const s = String(values[0] ?? "");
      const sub = String(values[1] ?? "");
      const start = values[2] !== undefined ? num(values[2]) : 0;
      const idx = s.indexOf(sub, Math.floor(start));
      return idx < 0 ? -1 : idx;
    },
  },
  midStr: {
    arity: { min: 2, max: 3 },
    impl(values) {
      const s = String(values[0] ?? "");
      const start = num(values[1]);
      const end = values[2] !== undefined ? num(values[2]) : s.length;
      return s.slice(start, end);
    },
  },
  rightStr: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const s = String(values[0] ?? "");
      const n = num(values[1]);
      if (n <= 0) return "";
      return s.slice(-n);
    },
  },
  strTrim: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const s = values[0];
      return s == null ? null : String(s).trim();
    },
  },
  strUpper: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const s = values[0];
      return s == null ? null : String(s).toUpperCase();
    },
  },
  strLower: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const s = values[0];
      return s == null ? null : String(s).toLowerCase();
    },
  },
  dupStr: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const s = String(values[0] ?? "");
      const n = Math.max(0, num(values[1]));
      return s.repeat(n);
    },
  },
  strReplace: {
    arity: { min: 3, max: 4 },
    impl(values) {
      const s = String(values[0] ?? "");
      const search = String(values[1] ?? "");
      const repl = String(values[2] ?? "");
      const ignoreCase = values[3] === true;
      if (ignoreCase) {
        const re = new RegExp(escapeRe(search), "gi");
        return s.replace(re, repl);
      }
      return s.split(search).join(repl);
    },
  },
  strChain: {
    arity: { min: 2 },
    impl(values) {
      if (values.length === 0) return "";
      const sep = String(values[0] ?? "");
      return values
        .slice(1)
        .map((v) => String(v ?? ""))
        .join(sep);
    },
  },
  strFill: {
    arity: { min: 2, max: 4 },
    impl(values) {
      let s = String(values[0] ?? "");
      const len = Math.max(0, Math.floor(num(values[1])));
      const align = String(values[2] ?? "L").toUpperCase().slice(0, 1);
      const fill = String(values[3] ?? " ").slice(0, 1) || " ";
      if (s.length >= len) return s.slice(0, len);
      const pad = len - s.length;
      if (align === "R") return fill.repeat(pad) + s;
      if (align === "C") {
        const left = Math.floor(pad / 2);
        return fill.repeat(left) + s + fill.repeat(pad - left);
      }
      return s + fill.repeat(pad);
    },
  },
  toStr: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const v = values[0];
      if (v == null) return "";
      if (typeof v === "string") return v;
      if (typeof v === "number") return String(v);
      if (v instanceof Date) {
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, "0");
        const d = String(v.getDate()).padStart(2, "0");
        return `${y}${m}${d}`;
      }
      return String(v);
    },
  },
  parseBigDecimal: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const s = String(values[0] ?? "").trim();
      if (!s) return 0;
      const normalized = s.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(normalized);
      if (Number.isNaN(n)) {
        throw new Error(`parseBigDecimal: Ungültige Zahl – "${s}".`);
      }
      return n;
    },
  },
  color: {
    arity: { min: 3, max: 3 },
    impl(values) {
      const r = Math.max(0, Math.min(255, Math.floor(num(values[0]))));
      const g = Math.max(0, Math.min(255, Math.floor(num(values[1]))));
      const b = Math.max(0, Math.min(255, Math.floor(num(values[2]))));
      return { r, g, b, _type: "color" };
    },
  },
  fileExists: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const path = String(values[0] ?? "").trim();
      if (!path) return false;
      return false;
    },
  },
  lngSel: {
    arity: { min: 2 },
    impl(values, context) {
      const lang = (context.language ?? "de").toLowerCase();
      for (let i = 0; i + 1 < values.length; i += 2) {
        if (String(values[i] ?? "").toLowerCase() === lang) {
          return values[i + 1];
        }
      }
      return values.length >= 2 ? values[1] : "";
    },
  },
  collSum: {
    arity: { min: 2, max: 3 },
    impl(values, context) {
      const items = getFilteredCollection(values[0], values[2], context);
      const fieldName = String(values[1] ?? "").trim();
      let sum = 0;
      for (const item of items) {
        const v = getNestedValue(item, fieldName);
        sum += num(v);
      }
      return sum;
    },
  },
  collCount: {
    arity: { min: 1, max: 3 },
    impl(values, context) {
      const items = getFilteredCollection(values[0], values[1], context);
      return items.length;
    },
  },
  collConcat: {
    arity: { min: 3, max: 5 },
    impl(values, context) {
      const items = getFilteredCollection(values[0], values[4], context);
      const fieldName = String(values[1] ?? "").trim();
      const sep = String(values[2] ?? "");
      return items.map((item) => String(getNestedValue(item, fieldName) ?? "")).join(sep);
    },
  },
  collConcatDistinct: {
    arity: { min: 3, max: 5 },
    impl(values, context) {
      const items = getFilteredCollection(values[0], values[4], context);
      const fieldName = String(values[1] ?? "").trim();
      const sep = String(values[2] ?? "");
      const seen = new Set<string>();
      const parts: string[] = [];
      for (const item of items) {
        const v = String(getNestedValue(item, fieldName) ?? "");
        if (v && !seen.has(v)) {
          seen.add(v);
          parts.push(v);
        }
      }
      return parts.join(sep);
    },
  },
  getCollEntry: {
    arity: { min: 1, max: 3 },
    impl(values, context) {
      const items = getFilteredCollection(values[0], values[1], context);
      const first = items[0];
      if (!first) return null;
      return first;
    },
  },
  filter: {
    arity: { min: 0 },
    impl(values) {
      if (values.length === 0) return { _type: "all" };
      if (values.length === 1) return values[0];
      return { _type: "op", op: "AND", conds: values };
    },
  },
  filterComp: {
    arity: { min: 3, max: 3 },
    impl(values) {
      return {
        _type: "comp",
        field: String(values[0] ?? "").trim(),
        op: String(values[1] ?? "=").toUpperCase(),
        value: values[2],
      };
    },
  },
  filterOp: {
    arity: { min: 2 },
    impl(values) {
      const op = String(values[0] ?? "AND").toUpperCase();
      const conds = values.slice(1);
      return { _type: "op", op, conds };
    },
  },
  strMatches: {
    arity: { min: 2, max: 2 },
    impl(values) {
      const s = String(values[0] ?? "");
      const pattern = String(values[1] ?? "");
      try {
        return new RegExp(pattern).test(s);
      } catch {
        throw new Error(`strMatches: Ungültiges Regex-Pattern – "${pattern}".`);
      }
    },
  },
  memoToStr: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const v = values[0];
      return v == null ? "" : String(v);
    },
  },
  refMan: {
    arity: { min: 1, max: 1 },
    impl(values) {
      const ref = String(values[0] ?? "").trim();
      return { _type: "ref", ref };
    },
  },
  sessionMan: {
    arity: { min: 0, max: 0 },
    impl(_values, _context) {
      return { _type: "session" };
    },
  },
  memUserMan: {
    arity: { min: 0, max: 0 },
    impl(_values, _context) {
      return { _type: "memUser" };
    },
  },
  isNewObject: {
    arity: { min: 0, max: 0 },
    impl(_values, context) {
      return context.isNewObject === true;
    },
  },
};

function buildMockFunctionDefinitions(): FormulaFunctionDefinition[] {
  const missingRuntime = FUNCTION_DOCS.filter((doc) => !(doc.name in FUNCTION_RUNTIME)).map(
    (doc) => doc.name
  );
  if (missingRuntime.length > 0) {
    throw new Error(
      `Fehlende Runtime-Beschreibung für Funktionen: ${missingRuntime.join(", ")}`
    );
  }

  const unknownRuntimeEntries = Object.keys(FUNCTION_RUNTIME).filter(
    (name) => !FUNCTION_DOCS.some((doc) => doc.name === name)
  );
  if (unknownRuntimeEntries.length > 0) {
    throw new Error(
      `Runtime-Beschreibung ohne Doku-Eintrag: ${unknownRuntimeEntries.join(", ")}`
    );
  }

  return FUNCTION_DOCS.map((doc) => ({
    ...doc,
    ...FUNCTION_RUNTIME[doc.name],
    origin: "mock",
  }));
}

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (v === true) return 1;
  if (v === false || v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

/** Liefert Date oder wirft bei ungültigem Wert. */
function toDateOrThrow(v: unknown): Date {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) {
      throw new Error("toDate: Ungültiges Datum (NaN).");
    }
    return v;
  }
  if (typeof v === "number") {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`toDate: Ungültige Zeitstempel-Zahl – ${v} ergibt kein gültiges Datum.`);
    }
    return d;
  }
  const s = String(v ?? "").trim();
  if (!s) {
    throw new Error("toDate: Leerer String kann nicht in ein Datum umgewandelt werden.");
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`toDate: Ungültiges Datum – "${s}" konnte nicht geparst werden.`);
  }
  return d;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const MOCK_FUNCTION_DEFINITIONS = buildMockFunctionDefinitions();

export const mockFunctionSource: FunctionSource = {
  id: "mock",
  getFunctions() {
    return MOCK_FUNCTION_DEFINITIONS;
  },
};
