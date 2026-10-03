export interface TestDef {
  name: string;
  short: string;
  unit: string;
  /** Default reference range, used until a person has entered their own lab's range. */
  low: number;
  high: number;
  /** Decimal places to show. */
  dp: number;
  desc: string;
}

// Adding a new kind of test only needs an entry here.
export const TESTS = {
  rbc: {name:"Red blood cell count", short:"Red cells", unit:"×10¹²/L", low:3.80, high:4.85, dp:2,
       desc:"Red blood cells carry oxygen from the lungs to the rest of the body. This counts how many are in a litre of blood."},
  hb: {name:"Haemoglobin", short:"Haemoglobin", unit:"g/L", low:112, high:148, dp:0,
       desc:"Haemoglobin is the protein inside red blood cells that carries the oxygen. This measures how much is in a litre of blood."},
  alp: {name:"Alkaline phosphatase", short:"ALP", unit:"IU/L", low:30, high:130, dp:0,
       desc:"Alkaline phosphatase (ALP) is an enzyme found mostly in the liver and bones. It is measured in international units per litre."},
  ast: {name:"Aspartate aminotransferase", short:"AST", unit:"IU/L", low:0, high:35, dp:0,
       desc:"Aspartate aminotransferase (AST) is an enzyme found mainly in the liver, heart and muscles. It is measured in international units per litre."},
  alt: {name:"Alanine aminotransferase", short:"ALT", unit:"IU/L", low:0, high:35, dp:0,
       desc:"Alanine aminotransferase (ALT) is an enzyme found mostly in the liver. It is measured in international units per litre."},
  ggt: {name:"Gamma-glutamyl transferase", short:"GGT", unit:"IU/L", low:7, high:32, dp:0,
       desc:"Gamma-glutamyl transferase (GGT) is an enzyme found mainly in the liver. It is measured in international units per litre."},
} satisfies Record<string, TestDef>;

export type TestKey = keyof typeof TESTS;
export const TEST_KEYS = Object.keys(TESTS) as TestKey[];
export const isTestKey = (k: string): k is TestKey => k in TESTS;
