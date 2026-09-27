import { bn, span } from "../lib/format";
import { useWidth } from "./hooks";

interface Props {
  times: number[]; // the middle of each month, in years, for the rolling sums below
  actual: number[]; // the twelve months to each month, £ million
  expected: number[];
  start: number;
  cutoff: number;
  testYears: number;
  label: string;
}

const FROM = 2000;

/** Trade with the EU against what the baseline expects, with its fitted and test years marked. */
export function PathChart({ times, actual, expected, start, cutoff, testYears, label }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const narrow = W < 520;
  const H = narrow ? 250 : 300;
  const L = 34;
  const R = narrow ? 44 : 60;
  const T = 26;
  const B = H - 30;
  const keep = times.map((t, i) => (t >= FROM ? i : -1)).filter((i) => i >= 0);
  // the baseline is drawn from the end of its first fitted year
  const from = keep.filter((i) => times[i]! >= start + 1);
  const vals = [...keep.map((i) => actual[i]!), ...from.map((i) => expected[i]!)];
  const lo = Math.floor(Math.min(...vals) / 20000) * 20;
  const hi = Math.ceil(Math.max(...vals) / 20000) * 20;
  const last = times[times.length - 1]!;
  const x = (t: number) => L + ((t - FROM) / (last + 0.2 - FROM)) * (W - L - R);
  const y = (v: number) => B - ((v / 1000 - lo) / (hi - lo)) * (B - T);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += hi - lo > 80 ? 40 : 20) ticks.push(v);
  const years = narrow ? [2000, 2010, 2020] : [2000, 2005, 2010, 2015, 2020, 2025];
  const line = (idx: number[], v: number[]) =>
    idx.map((i) => `${x(times[i]!).toFixed(1)},${y(v[i]!).toFixed(1)}`).join(" ");
  const endA = actual[actual.length - 1]!;
  const endE = expected[expected.length - 1]!;
  const aboveE = endE > endA;

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="path-desc">
        <desc id="path-desc">
          {`${label} in the twelve months to each month from ${FROM}, against what the baseline fitted to ${span(start, cutoff)} expects. ` +
            `In the latest twelve months: ${bn(endA)} traded, ${bn(endE)} expected.`}
        </desc>
        <rect className="c-fit" x={x(start)} y={T - 16} width={x(cutoff + 1) - x(start)} height={B - T + 16} />
        <rect
          className="c-test"
          x={x(cutoff - testYears + 1)}
          y={B - 6}
          width={x(cutoff + 1) - x(cutoff - testYears + 1)}
          height={6}
        />
        <text className="c-note" x={x(start) + 4} y={T - 4}>
          fitted
        </text>
        {ticks.map((v) => (
          <g key={v}>
            <line className="c-grid" x1={L} x2={W - R} y1={y(v * 1000) + 0.5} y2={y(v * 1000) + 0.5} />
            <text className="c-tick" x={L - 6} y={y(v * 1000) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {years.map((yr) => (
          <text key={yr} className="c-tick" x={x(yr)} y={B + 20} textAnchor="middle">
            {yr}
          </text>
        ))}
        <polyline className="c-expected" points={line(from, expected)} />
        <polyline className="c-actual" points={line(keep, actual)} />
        <circle className="c-actual-dot" cx={x(last)} cy={y(endA)} r={3.5} />
        <circle className="c-expected-dot" cx={x(last)} cy={y(endE)} r={3.5} />
        <text className="c-strong" x={x(last) + 8} y={y(endA) + (aboveE ? 14 : -6)}>
          {bn(endA)}
        </text>
        <text className="c-expected-label" x={x(last) + 8} y={y(endE) + (aboveE ? -6 : 14)}>
          {bn(endE)}
        </text>
      </svg>
    </div>
  );
}
