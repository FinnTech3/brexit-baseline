import { useWidth } from "./hooks";

interface Props {
  times: number[];
  ratio: number[]; // UK record over EU record, the twelve months to each month
  before: number;
}

const FROM = 2003;

/** The UK's record of imports from the EU for every £1 the EU records sending. */
export function RecordsChart({ times, ratio, before }: Props) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const narrow = W < 520;
  const H = narrow ? 220 : 260;
  const L = 44;
  const R = narrow ? 44 : 54;
  const T = 14;
  const B = H - 30;
  const lo = 0.85;
  const hi = 1.2;
  const last = times[times.length - 1]!;
  const x = (t: number) => L + ((t - FROM) / (last + 0.2 - FROM)) * (W - L - R);
  const y = (v: number) => B - ((Math.min(v, hi) - lo) / (hi - lo)) * (B - T);
  const keep = times.map((t, i) => (t >= FROM ? i : -1)).filter((i) => i >= 0);
  const end = ratio[ratio.length - 1]!;
  const years = narrow ? [2005, 2015, 2025] : [2005, 2010, 2015, 2020, 2025];

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby="records-desc">
        <desc id="records-desc">
          {`UK imports from the EU for every £1 of EU exports to the UK, in the twelve months to each month from ${FROM}. ` +
            `In 2016 to 2020 it was ${Math.round(before * 100)}p; in the latest twelve months £${end.toFixed(2)}.`}
        </desc>
        {[0.9, 1.0, 1.1, 1.2].map((v) => (
          <g key={v}>
            <line className={v === 1 ? "c-base" : "c-grid"} x1={L} x2={W - R} y1={y(v) + 0.5} y2={y(v) + 0.5} />
            <text className="c-tick" x={L - 6} y={y(v) + 4} textAnchor="end">
              {`£${v.toFixed(2)}`}
            </text>
          </g>
        ))}
        {years.map((yr) => (
          <text key={yr} className="c-tick" x={x(yr)} y={B + 20} textAnchor="middle">
            {yr}
          </text>
        ))}
        <line className="c-level" x1={x(2016)} x2={x(2021)} y1={y(before)} y2={y(before)} />
        <line className="c-mark" x1={x(2022)} x2={x(2022)} y1={T} y2={y(0.92)} />
        <polyline
          className="c-actual"
          points={keep.map((i) => `${x(times[i]!).toFixed(1)},${y(ratio[i]!).toFixed(1)}`).join(" ")}
        />
        <circle className="c-actual-dot" cx={x(last)} cy={y(end)} r={3.5} />
        <text className="c-strong" x={x(last) + 8} y={y(end) + 5}>
          {`£${end.toFixed(2)}`}
        </text>
        <text className="c-level-label" x={x(2016)} y={y(0.875)}>
          {`2016-2020: ${Math.round(before * 100)}p`}
        </text>
      </svg>
    </div>
  );
}
