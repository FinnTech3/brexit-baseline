import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type BaselineFile,
  type Choice,
  DEFAULT,
  Engine,
  lastStart,
  monthAt,
  passes,
  readChoice,
  settle,
  writeChoice,
} from "./baseline";

const d = JSON.parse(readFileSync("public/data/baseline.json", "utf8")) as BaselineFile;
const engine = new Engine(d);

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
