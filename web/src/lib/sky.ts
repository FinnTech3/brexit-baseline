// The shape of the artwork, kept out of the drawing so the tests can hold it
// to the pipeline's numbers.

import { type BaselineFile, type Choice, type Engine, type Result, series } from "./baseline";

/** Every third month, and always the last one, so a thread ends on its answer. */
export const STEP = 3;

/** The low and high edges of the sky, held fixed so it does not rescale when the trade changes. */
export const FLOOR = -0.52;
export const CEILING = 0.72;

export interface Thread {
  r: Result;
  /** Where on the shared grid of months this thread begins. */
  at: number;
  /** What happened over what this baseline expects, minus one, at each of those months. */
  vals: number[];
}

export interface Sky {
  /** The months every thread is sampled at, as indices into the monthly series. */
  grid: number[];
  times: number[];
  threads: Thread[];
}

/**
 * Every baseline for one trade as a path of gaps: the twelve months to each
 * month, as traded, over what that baseline expects for the same twelve. A
 * thread begins at the first month whose whole year lies inside its fitted
 * years, and its last point is the headline figure the page prints, because
 * the twelve months being judged are the twelve the last point covers.
 */
export function build(d: BaselineFile, engine: Engine, c: Choice): Sky {
  const grid: number[] = [];
  for (let i = d.months - 1; i >= 11; i -= STEP) grid.push(i);
  grid.reverse();
  const traded = engine.rolling(series(d, c.flow, c.record).eu);
  const threads = d.results
    .filter((r) => r.flow === c.flow && r.record === c.record)
    .map((r) => {
      const want = engine.rolling(engine.expected({ ...c, family: r.family, cutoff: r.cutoff, start: r.start }));
      const at = grid.findIndex((i) => engine.years[i - 11]! >= r.start);
      return { r, at, vals: grid.slice(at).map((i) => traded[i - 11]! / want[i - 11]! - 1) };
    });
  return { grid, times: grid.map((i) => engine.times[i]!), threads };
}
