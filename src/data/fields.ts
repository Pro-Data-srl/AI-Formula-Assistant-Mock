export const MANIPULATORS = [
  { id: "current", label: "aktueller Manipulator (Artikel)" },
  { id: "root", label: "Wurzelmanipulator (Artikel)" },
  { id: "start", label: "Startmanipulator (Artikel)" },
  { id: "app", label: "Applikationsmanipulator (Anwendung (M))" },
  { id: "session", label: "Sessionsmanipulator (Session)" },
  { id: "user", label: "Benutzermanipulator (Benutzer (M))" },
  { id: "company", label: "Firmenmanipulator (Betrieb (M))" },
] as const;

export interface DataField {
  name: string;
  internalName: string;
  forReading: boolean;
  required: boolean;
  autoValue: boolean;
  assistant: boolean;
  handler: string;
  dataType: string;
  constraints?: string;
  /** Dummy value for formula test execution (e.g. field("internalName")). */
  dummyValue?: string | number | Date | boolean | null;
}

export const MOCK_FIELDS: DataField[] = [
  // —— Kennung & Typ ——
  {
    name: "Artikelart",
    internalName: "Artikelart",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Text / s",
    dummyValue: "Handel",
  },
  {
    name: "Artikelnummer",
    internalName: "ArtNr",
    forReading: true,
    required: true,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Text / s",
    dummyValue: "ART-10042",
  },
  {
    name: "Bezeichnung",
    internalName: "Bez",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Text / s",
    dummyValue: "Beispielartikel Standard",
  },
  {
    name: "Beschreibung",
    internalName: "Bem",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Text / s",
    dummyValue: "Kurze Beschr",
  },
  {
    name: "Artikel-Attributgruppe",
    internalName: "ArtAttrGrp",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Text / s",
    dummyValue: "Standard",
  },
  {
    name: "Artikel-Qualitätsvorgabe",
    internalName: "ArtQual",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Text / s",
    dummyValue: "Norm",
  },
  // —— Mengen & Preise ——
  {
    name: "Menge",
    internalName: "Menge",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Dezimalzahl / f",
    constraints: "NZFLOAT,12",
    dummyValue: 10.5,
  },
  {
    name: "Einzelpreis",
    internalName: "EPreis",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Dezimalzahl / f",
    constraints: "NZFLOAT,12",
    dummyValue: 19.99,
  },
  {
    name: "Betrag",
    internalName: "Betrag",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Dezimalzahl / f",
    constraints: "NZFLOAT,12",
    dummyValue: 209.9,
  },
  {
    name: "% Handelskosten",
    internalName: "Handelskosten",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Dezimalzahl / f",
    constraints: "NZFLOAT,12",
    dummyValue: 5.5,
  },
  {
    name: "Anfangsbestand",
    internalName: "Anf",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Dezimalzahl / f",
    constraints: "NZFLOAT,12",
    dummyValue: 100,
  },
  {
    name: "Anzahl Hauptartikel",
    internalName: "AnzHaupt",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Ganzzahl / i",
    dummyValue: 3,
  },
  // —— Status & Verrechnung ——
  {
    name: "Verrechnet",
    internalName: "Verrech",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Ja/Nein",
    dummyValue: true,
  },
  {
    name: "Offen",
    internalName: "Offen",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Ja/Nein",
    dummyValue: false,
  },
  {
    name: "Dauer (ms)",
    internalName: "Dauer",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Ganzzahl (64 Bit)",
    dummyValue: 3600000,
  },
  {
    name: "Bearbeitungsdauer",
    internalName: "Bearbeitungsdauer",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Dezimalzahl / f",
    dummyValue: 2,
  },
  // —— Leistung & Kalkulation ——
  {
    name: "Leistung von",
    internalName: "LeistVon",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Datum / d",
    constraints: "DATE,8",
    dummyValue: "2025-03-01",
  },
  {
    name: "Leistung bis",
    internalName: "LeistBis",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Datum / d",
    constraints: "DATE,8",
    dummyValue: "2025-03-31",
  },
  {
    name: "Grundlage",
    internalName: "Grundlage",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Dezimalzahl / f",
    dummyValue: 250,
  },
  {
    name: "Einstandsbetrag",
    internalName: "Einstandsbetrag",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Dezimalzahl / f",
    dummyValue: 200,
  },
  {
    name: "Typ",
    internalName: "Typ",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Ganzzahl / i",
    dummyValue: 1,
  },
  {
    name: "Status",
    internalName: "Status",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Ganzzahl / i",
    dummyValue: 3,
  },
  // —— Datum & Status ——
  {
    name: "Datum",
    internalName: "Datum",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Datum / d",
    constraints: "DATE,8",
    dummyValue: "2025-03-15",
  },
  {
    name: "Lieferdatum",
    internalName: "LiefDat",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Datum / d",
    constraints: "DATE,8",
    dummyValue: "2025-03-22",
  },
  {
    name: "Erstellungsdatum",
    internalName: "ErstellDat",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Datum / d",
    constraints: "DATE,8",
    dummyValue: "2024-01-10",
  },
  // —— Referenzen (für field("Kunde.Name") etc.) ——
  {
    name: "Kunde",
    internalName: "Kunde",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Referenz",
    dummyValue: "[Referenz]",
  },
  {
    name: "Kunde.Name",
    internalName: "Kunde.Name",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Text / s",
    dummyValue: "Musterkunde GmbH",
  },
  {
    name: "Positionen",
    internalName: "Positionen",
    forReading: true,
    required: false,
    autoValue: false,
    assistant: false,
    handler: "Text",
    dataType: "Sammlung",
    dummyValue: null,
  },
];

/**
 * Builds a map of field internalName → dummy value for formula execution.
 * Date strings (YYYY-MM-DD) are converted to Date objects.
 */
export function getMockFieldValues(): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const f of MOCK_FIELDS) {
    if (f.dummyValue === undefined) continue;
    if (typeof f.dummyValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f.dummyValue)) {
      map[f.internalName] = new Date(f.dummyValue + "T00:00:00");
    } else {
      map[f.internalName] = f.dummyValue;
    }
  }
  return map;
}

/**
 * Mock collections for collSum, collCount, collConcat, getCollEntry.
 * Map: collection name → array of records (field internalName → value).
 */
export function getMockCollections(): Record<string, Record<string, unknown>[]> {
  return {
    Positionen: [
      {
        Betrag: 100,
        Menge: 2,
        EPreis: 50,
        Bez: "Artikel A",
        Artikelart: "Handel",
        "Artikel.Code": "ART-A",
        Offen: true,
        Datum: "2025-03-10",
      },
      {
        Betrag: 50,
        Menge: 1,
        EPreis: 50,
        Bez: "Artikel B",
        Artikelart: "Dienst",
        "Artikel.Code": "ART-B",
        Offen: false,
        Datum: "2025-03-15",
      },
      {
        Betrag: 209.9,
        Menge: 10.5,
        EPreis: 19.99,
        Bez: "Beispielartikel Standard",
        Artikelart: "Handel",
        "Artikel.Code": "ART-10042",
        Offen: true,
        Datum: "2025-03-20",
      },
    ],
    Dienstleistungszeiten: [
      { Dauer: 3600000, Verrech: true, Bem: "Beratung Kunde", FF_BeschrUngueltig: false },
      { Dauer: 7200000, Verrech: false, Bem: "Intern", FF_BeschrUngueltig: true },
      { Dauer: 1800000, Verrech: true, Bem: "Implementierung", FF_BeschrUngueltig: false },
    ],
  };
}

/** Mock session values for field("X", sessionMan()). */
export function getMockSessionValues(): Record<string, unknown> {
  return {
    "UserEmployee.Code": "EMP-001",
    "Employee.Code": "EMP-001",
    Usage: 2,
  };
}

/** Mock memUser values for field("X", memUserMan()). */
export function getMockMemUserValues(): Record<string, unknown> {
  return {
    ID: 42,
  };
}
