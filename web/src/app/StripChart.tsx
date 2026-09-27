import type { Result } from "../lib/baseline";
import { between, direction } from "../lib/format";
import { useWidth } from "./hooks";

interface Props {
  results: Result[]; // every baseline for this flow and record
  mine: Result;
  pass: number;
}

const ROWS = [
  { cutoff: 2015, label: "From before the vote" },
  { cutoff: 2019, label: "From before the new rules" },
];

/** Every baseline as a dot, filled if it passed its test, with the reader's lit. */
export function StripChart({ results, mine, pass }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const narrow = W < 520;
  const L = 10;
  const R = 10;
  const r = narrow ? 3.4 : 4;
  const step = 2 * r + 1.2;
  const lo = Math.min(-0.3, ...results.map((x) => x.estimate));
  const hi = Math.max(0.3, ...results.map((x) => x.estimate));
  const a = Math.floor(lo * 10) / 10;
  const b = Math.ceil(hi * 10) / 10;
  const x = (v: number) => L + ((v - a) / (b - a)) * (W - L - R);
  const ticks: number[] = [];
  for (let v = Math.ceil(a * 5) / 5; v <= b + 1e-9; v += 0.2) ticks.push(Math.round(v * 10) / 10);

  // a row of dots per cut-off, stacked above and below its line so none overlap
  const placed = ROWS.map((row) => {
    const rs = results.filter((x) => x.cutoff === row.cutoff).sort((p, q) => p.estimate - q.estimate);
    const taken = new Map<number, number[]>();
    return {
      ...row,
      dots: rs.map((res) => {
        const cx = x(res.estimate);
        let k = 0;
        while (taken.get(k)?.some((c) => Math.abs(c - cx) < step)) k = k > 0 ? -k : -k + 1;
        taken.set(k, [...(taken.get(k) ?? []), cx]);
        return { res, cx, k };
      }),
    };
  });
  const spread = placed.map((p) => Math.max(0, ...p.dots.map((d) => Math.abs(d.k))));
  const T = 20;
  const heights = spread.map((s) => 2 * s * step + 2 * r + 34);
  const tops = heights.map((_, i) => T + heights.slice(0, i).reduce((s, h) => s + h, 0));
  const H = T + heights.reduce((s, h) => s + h, 0) + 26;
  const ok = results.filter((res) => Math.abs(res.test) <= pass);

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="strip-desc">
        <desc id="strip-desc">
          {`${results.length} baselines, ${ok.length} of which pass their test. Those that pass say ${between(Math.min(...ok.map((o) => o.estimate)), Math.max(...ok.map((o) => o.estimate)))}. ` +
            `Yours: ${direction(mine.estimate)}, ${Math.abs(mine.test) <= pass ? "passes" : "fails"}.`}
        </desc>
        {ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "c-zero" : "c-grid"} x1={x(v) + 0.5} x2={x(v) + 0.5} y1={T - 6} y2={H - 26} />
            <text className="c-tick" x={x(v)} y={H - 8} textAnchor="middle">
              {v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.round(Math.abs(v) * 100)}%`}
            </text>
          </g>
        ))}
        {placed.map((row, i) => {
          const mid = tops[i]! + 22 + spread[i]! * step + r;
          return (
            <g key={row.cutoff}>
              <text className="c-row c-halo" x={L} y={tops[i]! + 10}>
                {`${row.label} (${row.cutoff})`}
              </text>
              {row.dots.map(({ res, cx, k }) => {
                const me = res.family === mine.family && res.cutoff === mine.cutoff && res.start === mine.start;
                const good = Math.abs(res.test) <= pass;
                return (
                  <circle
                    key={`${res.family}-${res.start}`}
                    cx={cx}
                    cy={mid + k * step}
                    r={me ? r + 2 : good ? r : r - 0.6}
                    className={me ? "c-mine" : good ? "c-pass" : "c-fail"}
                  >
                    <title>{`${res.family}, ${res.start}-${res.cutoff}: ${direction(res.estimate)}; ${good ? "passes" : "fails"} its test`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
