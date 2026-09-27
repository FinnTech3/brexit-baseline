// The same recipes as pipeline/src/baseline/study.py, for the one the reader
// picks. The tests hold every result here to the pipeline's.

export type Flow = "Exports" | "Imports";
export type Family = "own trend" | "with non-EU" | "with non-EU and drift";
export type Record = "UK" | "EU";

export const FAMILIES: Family[] = ["own trend", "with non-EU", "with non-EU and drift"];
export const CUTOFFS = [2015, 2019] as const;
export const FIRST_START = 2001;
export const MIN_YEARS = 5;

export interface Result {
  flow: Flow;
  record: Record;
  family: Family;
  cutoff: number;
  start: number;
  estimate: number;
  test: number;
  slope: number;
}

export interface BaselineFile {
  first: string;
  months: number;
  evaluation: number;
  pass: number;
  test_years: number;
  series: {
    exports_eu: number[];
    exports_other: number[];
    imports_eu: number[];
    imports_eu_eu_record: number[];
    imports_other: number[];
  };
  records: { first: string; uk: number[]; eu: number[]; before: number };
  checks: { totals: [number, number]; calendar: [number, number]; twin: [number, number] };
  results: Result[];
}

export interface Choice {
  flow: Flow;
  family: Family;
  cutoff: number;
  start: number;
  record: Record;
}

export const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** The year and month (1 to 12) of the i-th month after `first`, "1997 JAN" style. */
export function monthAt(first: string, i: number): { year: number; month: number } {
  const [y, m] = first.split(" ");
  const k = Number(y) * 12 + MONTH_NAMES.indexOf(m!) + i;
  return { year: Math.floor(k / 12), month: (k % 12) + 1 };
}

/** A month as a point in time, in years: the same sum as the pipeline's t(). */
export function when(year: number, month: number): number {
  return year + (month - 0.5) / 12;
}

export function lastStart(family: Family, cutoff: number): number {
  return family === "with non-EU" ? cutoff : cutoff - MIN_YEARS + 1;
}

export function series(d: BaselineFile, flow: Flow, record: Record): { eu: number[]; other: number[] } {
  if (flow === "Exports") return { eu: d.series.exports_eu, other: d.series.exports_other };
  return { eu: record === "EU" ? d.series.imports_eu_eu_record : d.series.imports_eu, other: d.series.imports_other };
}

interface Fit {
  a: number;
  b: number;
}

function ols(xs: number[], ys: number[]): Fit {
  let sx = 0;
  let sy = 0;
  for (const x of xs) sx += x;
  for (const y of ys) sy += y;
  const mx = sx / xs.length;
  const my = sy / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const b = num / den;
  return { a: my - b * mx, b };
}

export class Engine {
  readonly years: number[];
  readonly times: number[];

  constructor(readonly d: BaselineFile) {
    this.years = [];
    this.times = [];
    for (let i = 0; i < d.months; i++) {
      const { year, month } = monthAt(d.first, i);
      this.years.push(year);
      this.times.push(when(year, month));
    }
  }

  /** The line through the logs over the years first to last. */
  fit(c: Choice, first: number, last: number): Fit {
    const { eu, other } = series(this.d, c.flow, c.record);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < this.d.months; i++) {
      const y = this.years[i]!;
      if (y < first || y > last) continue;
      const control = c.family === "own trend" ? 1 : other[i]!;
      xs.push(this.times[i]!);
      ys.push(Math.log(eu[i]! / control));
    }
    if (c.family === "with non-EU") {
      let s = 0;
      for (const y of ys) s += y;
      return { a: s / ys.length, b: 0 };
    }
    return ols(xs, ys);
  }

  /** What the recipe, fitted to the years first to last, expects for every month. */
  expected(c: Choice, first = c.start, last = c.cutoff): number[] {
    const { a, b } = this.fit(c, first, last);
    const { other } = series(this.d, c.flow, c.record);
    return this.times.map((t, i) => (c.family === "own trend" ? 1 : other[i]!) * Math.exp(a + b * t));
  }

  private gap(c: Choice, first: number, last: number, judged: number[]): number {
    const { eu } = series(this.d, c.flow, c.record);
    const exp = this.expected(c, first, last);
    let got = 0;
    let want = 0;
    for (const i of judged) {
      got += eu[i]!;
      want += exp[i]!;
    }
    return got / want - 1;
  }

  evaluation(): number[] {
    const n = this.d.months;
    return Array.from({ length: this.d.evaluation }, (_, k) => n - this.d.evaluation + k);
  }

  /** Actual over expected in the latest twelve months, minus one. */
  estimate(c: Choice): number {
    return this.gap(c, c.start, c.cutoff, this.evaluation());
  }

  /** The same recipe four years earlier, judged on the four years after its cut-off. */
  test(c: Choice): number {
    const cut = c.cutoff - this.d.test_years;
    const judged = this.years.flatMap((y, i) => (y > cut && y <= c.cutoff ? [i] : []));
    return this.gap(c, c.start - this.d.test_years, cut, judged);
  }

  /** The yearly change the recipe carries forward: -0.02 is 2% a year down. */
  slope(c: Choice): number {
    return Math.exp(this.fit(c, c.start, c.cutoff).b) - 1;
  }

  /** The twelve months to each month, from the twelfth on; index k is month k + 11. */
  rolling(values: number[]): number[] {
    const out: number[] = [];
    let s = 0;
    for (let i = 0; i < values.length; i++) {
      s += values[i]!;
      if (i >= 12) s -= values[i - 12]!;
      if (i >= 11) out.push(s);
    }
    return out;
  }
}

export function passes(d: BaselineFile, test: number): boolean {
  return Math.abs(test) <= d.pass;
}

export const DEFAULT: Choice = { flow: "Exports", family: "with non-EU", cutoff: 2019, start: 2017, record: "UK" };

const FAMILY_KEYS: [Family, string][] = [
  ["own trend", "trend"],
  ["with non-EU", "non-eu"],
  ["with non-EU and drift", "drift"],
];

/** Keep a choice valid: the start year inside its range, and the EU's record for imports only. */
export function settle(c: Choice): Choice {
  const hi = lastStart(c.family, c.cutoff);
  const start = Math.min(Math.max(c.start, FIRST_START), hi);
  return { ...c, start, record: c.flow === "Imports" ? c.record : "UK" };
}

export function readChoice(search: string): Choice {
  const q = new URLSearchParams(search);
  const flow: Flow = q.get("flow") === "imports" ? "Imports" : q.get("flow") === "exports" ? "Exports" : DEFAULT.flow;
  const family = FAMILY_KEYS.find(([, k]) => k === q.get("recipe"))?.[0] ?? DEFAULT.family;
  const cut = Number(q.get("from"));
  const cutoff = (CUTOFFS as readonly number[]).includes(cut) ? cut : DEFAULT.cutoff;
  const start = Number(q.get("start")) || DEFAULT.start;
  const record: Record = q.get("record") === "eu" ? "EU" : "UK";
  return settle({ flow, family, cutoff, start, record });
}

export function writeChoice(c: Choice): string {
  const q = new URLSearchParams({
    flow: c.flow.toLowerCase(),
    recipe: FAMILY_KEYS.find(([f]) => f === c.family)![1],
    from: String(c.cutoff),
    start: String(c.start),
  });
  if (c.flow === "Imports" && c.record === "EU") q.set("record", "eu");
  return `?${q}`;
}
