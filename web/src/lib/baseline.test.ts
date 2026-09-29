import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type BaselineFile,
  type Choice,
  DEFAULT,
  type Flow,
  type Record as Whose,
  Engine,
  lastStart,
  monthAt,
  passes,
  readChoice,
  settle,
  writeChoice,
} from "./baseline";
import { CEILING, FLOOR, build } from "./sky";

const d = JSON.parse(readFileSync("public/data/baseline.json", "utf8")) as BaselineFile;
const engine = new Engine(d);

/** The three skies: exports on the UK's record, imports on the UK's, imports on the EU's. */
const TRADES: [Flow, Whose][] = [
  ["Exports", "UK"],
  ["Imports", "UK"],
  ["Imports", "EU"],
];

describe("the engine against the pipeline", () => {
  it("reproduces every one of the pipeline's 258 results", () => {
    expect(d.results).toHaveLength(258);
    for (const r of d.results) {
      const c: Choice = { flow: r.flow, family: r.family, cutoff: r.cutoff, start: r.start, record: r.record };
      expect(engine.estimate(c)).toBeCloseTo(r.estimate, 9);
      expect(engine.test(c)).toBeCloseTo(r.test, 9);
      expect(engine.slope(c)).toBeCloseTo(r.slope, 9);
    }
  });

  it("gives the write-up's headline numbers", () => {
    const pct = (c: Partial<Choice>) => Math.round(engine.estimate({ ...DEFAULT, ...c }) * 1000) / 10;
    expect(pct({})).toBe(-7.1);
    expect(pct({ family: "with non-EU and drift", cutoff: 2015, start: 2009 })).toBe(39.0);
    expect(pct({ family: "with non-EU and drift", cutoff: 2015, start: 2006 })).toBe(64.3);
    expect(pct({ flow: "Imports", start: 2019 })).toBe(-11.5);
    expect(pct({ flow: "Imports", start: 2019, record: "EU" })).toBe(-22.5);
  });

  it("counts the same baselines as passing", () => {
    const passing = d.results.filter((r) => r.flow === "Exports" && passes(d, r.test)).map((r) => r.estimate);
    expect(passing).toHaveLength(20);
    expect(passing.filter((e) => e > 0)).toHaveLength(10);
  });
});

describe("months and sums", () => {
  it("counts months from January 1997 to July 2026", () => {
    expect(monthAt(d.first, 0)).toEqual({ year: 1997, month: 1 });
    expect(monthAt(d.first, d.months - 1)).toEqual({ year: 2026, month: 7 });
    expect(engine.evaluation().map((i) => monthAt(d.first, i))[0]).toEqual({ year: 2025, month: 8 });
  });

  it("sums each twelve months", () => {
    const r = engine.rolling([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(r).toEqual([78, 90, 102]);
  });
});

describe("the choice in the address", () => {
  it("round-trips", () => {
    const c: Choice = { flow: "Imports", family: "with non-EU and drift", cutoff: 2015, start: 2006, record: "EU" };
    expect(readChoice(writeChoice(c))).toEqual(c);
    expect(readChoice(writeChoice(DEFAULT))).toEqual(DEFAULT);
  });

  it("falls back to the default on nonsense", () => {
    expect(readChoice("?flow=x&recipe=y&from=2020&start=abc")).toEqual(DEFAULT);
  });

  it("keeps the start year in range and the EU's record to imports", () => {
    expect(settle({ ...DEFAULT, family: "own trend", start: 2019 }).start).toBe(lastStart("own trend", 2019));
    expect(settle({ ...DEFAULT, start: 1990 }).start).toBe(2001);
    expect(settle({ ...DEFAULT, record: "EU" }).record).toBe("UK");
  });
});

describe("the sky against the pipeline", () => {
  it("ends every thread on the figure the page prints", () => {
    let drawn = 0;
    for (const [flow, record] of TRADES) {
      const sky = build(d, engine, { ...DEFAULT, flow, record });
      expect(sky.threads).toHaveLength(86);
      for (const t of sky.threads) {
        // the twelve months a thread's last point covers are the twelve the
        // estimate is taken from, so the two are the same number
        expect(t.vals[t.vals.length - 1]).toBeCloseTo(t.r.estimate, 9);
        drawn++;
      }
    }
    expect(drawn).toBe(d.results.length);
  });

  it("keeps every thread inside the sky's fixed edges", () => {
    for (const [flow, record] of TRADES) {
      for (const t of build(d, engine, { ...DEFAULT, flow, record }).threads) {
        for (const v of t.vals) {
          expect(v).toBeGreaterThan(FLOOR);
          expect(v).toBeLessThan(CEILING);
        }
      }
    }
  });

  it("starts each thread inside the years it was fitted to", () => {
    for (const [flow, record] of TRADES) {
      const sky = build(d, engine, { ...DEFAULT, flow, record });
      for (const t of sky.threads) {
        expect(t.at).toBeGreaterThanOrEqual(0);
        expect(t.vals).toHaveLength(sky.grid.length - t.at);
        // the twelve months its first point covers all fall inside the fit
        expect(engine.years[sky.grid[t.at]! - 11]).toBeGreaterThanOrEqual(t.r.start);
        expect(engine.years[sky.grid[t.at]!]).toBeLessThanOrEqual(t.r.cutoff + 1);
      }
    }
  });
});
