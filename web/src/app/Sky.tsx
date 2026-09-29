import { type PointerEvent, useMemo, useState } from "react";
import {
  type BaselineFile,
  CUTOFFS,
  type Choice,
  type Engine,
  type Family,
  type Result,
  passes,
} from "../lib/baseline";
import { pct, span } from "../lib/format";
import { CEILING, FLOOR, STEP, type Thread, build } from "../lib/sky";
import { useWidth } from "./hooks";

interface Props {
  d: BaselineFile;
  engine: Engine;
  c: Choice;
  mine: Result;
  onPick: (r: Result) => void;
}

const HUE: Record<Family, string> = {
  "own trend": "f-trend",
  "with non-EU": "f-pace",
  "with non-EU and drift": "f-drift",
};

const SHORT: Record<Family, string> = {
  "own trend": "its own trend",
  "with non-EU": "non-EU trade",
  "with non-EU and drift": "non-EU, with drift",
};

/** A gap as the sky labels it: "+8.4%", "12.1% lower" when there is room for words. */
function signed(v: number): string {
  return `${v < 0 ? "-" : "+"}${pct(v)}`;
}

function tell(r: Result, d: BaselineFile): string {
  return `${SHORT[r.family]}, fitted ${span(r.start, r.cutoff)}: ${signed(r.estimate)}, ${
    passes(d, r.test) ? "passes its test" : "fails its test"
  }`;
}

/**
 * Every baseline for one trade at once. The straight line across the middle is
 * what actually happened; each thread is one baseline, drawn as far from that
 * line as trade is from what it expects. They run together while they are
 * being fitted, leave the line at their cut-off year and spread out after it,
 * so the whole disagreement is one picture. The ones that could forecast four
 * ordinary years burn bright; the rest stay dim. Point at one to take it.
 */
export function SkyChart({ d, engine, c, mine, onPick }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>(360);
  const [hover, setHover] = useState<number | null>(null);
  // Only the trade and whose record it is change the sky; the rest of the
  // choice picks a thread out of one that is already drawn.
  const sky = useMemo(() => build(d, engine, c), [d, engine, c.flow, c.record]);

  const narrow = W < 520;
  const H = Math.round(Math.min(480, Math.max(300, W * 0.74)));
  const L = narrow ? 42 : 48;
  const R = narrow ? 44 : 60;
  const T = 30;
  const B = H - 30;
  const X0 = 2001;
  const X1 = sky.times[sky.times.length - 1]!;
  const x = (t: number) => L + ((t - X0) / (X1 - X0)) * (W - L - R);
  const y = (v: number) => B - ((v - FLOOR) / (CEILING - FLOOR)) * (B - T);
  const last = sky.grid.length - 1;

  const art = useMemo(() => {
    const edge: Record<number, number> = {};
    for (const cut of CUTOFFS) edge[cut] = sky.grid.findIndex((i) => engine.years[i]! > cut);
    const run = (t: Thread, from: number, to: number) => {
      let s = "";
      for (let k = from; k <= to; k++) {
        s += `${k === from ? "M" : "L"}${x(sky.times[k]!).toFixed(1)},${y(t.vals[k - t.at]!).toFixed(1)}`;
      }
      return s;
    };
    const fitted: string[] = [];
    const flown = new Map<string, string[]>();
    for (const t of sky.threads) {
      const e = edge[t.r.cutoff]!;
      if (t.at < e) fitted.push(run(t, t.at, e));
      const key = `${HUE[t.r.family]} ${passes(d, t.r.test) ? "lit" : "dim"}`;
      flown.set(key, [...(flown.get(key) ?? []), run(t, Math.max(t.at, e), last)]);
    }
    return {
      edge,
      run,
      fitted: fitted.join(""),
      flown: [...flown].map(([k, v]) => [k, v.join("")] as const),
    };
  }, [sky, W, H]);

  const yours = sky.threads.find((t) => t.r === mine)!;
  const shown = (hover === null ? undefined : sky.threads[hover]) ?? yours;
  const lit = sky.threads.filter((t) => passes(d, t.r.test));
  const ends = lit.map((t) => t.r.estimate);

  /** The thread nearest the pointer, or none when it is out in open sky. */
  function locate(e: PointerEvent<SVGSVGElement>, reach: number): number | null {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const py = ((e.clientY - box.top) / box.height) * H;
    const t = X0 + ((px - L) / (W - L - R)) * (X1 - X0);
    const k = Math.min(last, Math.max(0, Math.round((t - sky.times[0]!) / (STEP / 12))));
    let best: number | null = null;
    let near = reach;
    sky.threads.forEach((th, i) => {
      if (k < th.at) return;
      const dy = Math.abs(y(th.vals[k - th.at]!) - py);
      if (dy < near) {
        near = dy;
        best = i;
      }
    });
    return best;
  }

  return (
    <div ref={ref} className="sky-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="sky"
        role="img"
        aria-labelledby="sky-desc"
        onPointerMove={(e) => setHover(locate(e, 22))}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          const i = locate(e, 40);
          if (i !== null) onPick(sky.threads[i]!.r);
        }}
      >
        <desc id="sky-desc">
          {`All ${sky.threads.length} baselines for ${c.flow.toLowerCase()} ${c.flow === "Exports" ? "to" : "from"} the EU at once. Each is a thread showing how far trade ran from what that baseline expects, month by month, against a straight line for what happened. They hold to the line through the years they are fitted to, leave it at 2015 or 2019 and spread out after it. ` +
            `${lit.length} of them could forecast four ordinary years and are drawn bright; they end between ${signed(Math.min(...ends))} and ${signed(Math.max(...ends))}. The ${sky.threads.length - lit.length} that could not are dim. Yours is the white one, ending at ${signed(mine.estimate)}.`}
        </desc>

        <rect className="plate" x="0" y="0" width={W} height={H} rx="4" />

        {/* the twelve months the answer is taken from */}
        <rect
          className="judged"
          x={x(engine.times[d.months - d.evaluation]!)}
          y={T}
          width={x(X1) - x(engine.times[d.months - d.evaluation]!)}
          height={B - T}
        />

        {[-0.4, -0.2, 0.2, 0.4, 0.6].map((v) => (
          <g key={v}>
            <line className="sky-rule" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="c-tick" x={L - 5} y={y(v) + 4} textAnchor="end">
              {signed(v).replace(".0", "")}
            </text>
          </g>
        ))}

        {/* where each baseline stops being fitted and starts forecasting */}
        {CUTOFFS.map((cut, i) => (
          <g key={cut}>
            <line className="sky-cut" x1={x(cut + 1)} x2={x(cut + 1)} y1={T} y2={B} />
            <text
              className="c-tick"
              x={x(cut + 1) + (i === 0 ? -4 : 4)}
              y={T + 11}
              textAnchor={i === 0 ? "end" : "start"}
            >
              {narrow ? cut : i === 0 ? `fitted to ${cut}` : `or to ${cut}`}
            </text>
          </g>
        ))}

        <g className="glow">
          {art.flown
            .filter(([k]) => k.endsWith("lit"))
            .map(([k, path]) => (
              <path key={k} className={k} d={path} />
            ))}
        </g>
        <path className="fitted" d={art.fitted} />
        {art.flown
          .filter(([k]) => k.endsWith("dim"))
          .map(([k, path]) => (
            <path key={k} className={`flown ${k}`} d={path} />
          ))}
        {art.flown
          .filter(([k]) => k.endsWith("lit"))
          .map(([k, path]) => (
            <path key={k} className={`flown ${k}`} d={path} />
          ))}

        {sky.threads.map((t) => (
          <circle
            key={`${t.r.family}${t.r.cutoff}${t.r.start}`}
            className={`end ${HUE[t.r.family]} ${passes(d, t.r.test) ? "lit" : "dim"}`}
            cx={x(X1)}
            cy={y(t.r.estimate)}
            r={passes(d, t.r.test) ? 2 : 1.2}
          />
        ))}

        <line className="horizon" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
        <text className="c-note horizon-label" x={L + 3} y={y(0) - 6}>
          what happened
        </text>

        {hover !== null && shown.r !== mine && (
          <g className="picked hovered">
            <path d={art.run(shown, shown.at, last)} />
            <circle cx={x(X1)} cy={y(shown.r.estimate)} r={4} />
          </g>
        )}

        <g className="picked mine">
          <path className="mine-glow" d={art.run(yours, yours.at, last)} />
          <path d={art.run(yours, yours.at, last)} />
          <circle cx={x(X1)} cy={y(mine.estimate)} r={4.5} />
          <text className="c-strong" x={x(X1) + 9} y={Math.min(B - 2, Math.max(T + 10, y(mine.estimate) + 4))}>
            {signed(mine.estimate)}
          </text>
        </g>

        <text className="c-note" x={L - 6} y={16}>
          {narrow ? "how far from each baseline" : "how far trade ran from what each baseline expects"}
        </text>
        {(narrow ? [2005, 2015, 2025] : [2001, 2005, 2010, 2015, 2020, 2025]).map((yr) => (
          <text key={yr} className="c-tick" x={x(yr)} y={B + 18} textAnchor="middle">
            {yr}
          </text>
        ))}
      </svg>

      <p className="readout" aria-live="polite">
        {hover !== null && shown.r !== mine
          ? `That one: ${tell(shown.r, d)}. Tap it to take it.`
          : `Yours: ${tell(mine, d)}. Point anywhere in the sky to read another, or tap it to take it.`}
      </p>

      <ul className="legend" aria-hidden="true">
        <li className="l-trend">its own trend</li>
        <li className="l-pace">non-EU trade</li>
        <li className="l-drift">non-EU, with drift</li>
      </ul>

      <p className="legend-note" aria-hidden="true">
        Bright threads could forecast four ordinary years. Dim ones could not. The white one is yours. The block at the
        right is the twelve months the answer is taken from.
      </p>
    </div>
  );
}
