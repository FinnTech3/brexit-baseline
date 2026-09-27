import { useEffect, useMemo, useRef, useState } from "react";
import {
  type BaselineFile,
  type Choice,
  CUTOFFS,
  Engine,
  FAMILIES,
  FIRST_START,
  type Family,
  type Flow,
  type Result,
  lastStart,
  passes,
  readChoice,
  settle,
  writeChoice,
} from "../lib/baseline";
import { between, bn, direction, pct, span } from "../lib/format";
import { PathChart } from "./PathChart";
import { RecordsChart } from "./RecordsChart";
import { ShareCard } from "./ShareCard";
import { StripChart } from "./StripChart";
import { useCountUp } from "./hooks";

const REPO = "https://github.com/FinnTech3/brexit-baseline";

const FLOW_LABEL: Record<Flow, string> = {
  Exports: "UK goods exports to the EU",
  Imports: "UK goods imports from the EU",
};
const FAMILY_LABEL: Record<Family, string> = {
  "own trend": "Its own trend",
  "with non-EU": "Non-EU trade",
  "with non-EU and drift": "Non-EU, with drift",
};
const CUTOFF_LABEL: Record<number, string> = { 2015: "Before the vote", 2019: "Before the new rules" };

function useTheme() {
  const [theme, setTheme] = useState<string | undefined>(() => document.documentElement.dataset.theme);
  const systemDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme ? theme === "dark" : systemDark;
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private windows may refuse; the choice then lasts for this visit only.
    }
    setTheme(next);
  }
  return { dark, toggle };
}

/** The baseline in words, finishing the sentence "a baseline where ...". */
function describe(c: Choice, slope: number): string {
  const years = span(c.start, c.cutoff);
  if (c.family === "own trend")
    return `trade with the EU keeps ${slope < 0 ? "shrinking" : "growing"} at its ${years} rate, ${pct(slope)} a year`;
  if (c.family === "with non-EU") return `trade with the EU keeps pace with trade elsewhere, at its ${years} ratio`;
  return `trade with the EU keeps pace with trade elsewhere but ${slope < 0 ? "loses" : "gains"} ${pct(slope)} a year on it, as in ${years}`;
}

interface Derived {
  estimate: number;
  test: number;
  slope: number;
  actual: number;
  expected: number;
  path: number[];
  result: Result;
  all: Result[];
}

function derive(engine: Engine, d: BaselineFile, c: Choice): Derived {
  const path = engine.expected(c);
  const eu = seriesOf(d, c);
  let actual = 0;
  let expected = 0;
  for (const i of engine.evaluation()) {
    actual += eu[i]!;
    expected += path[i]!;
  }
  const all = d.results.filter((r) => r.flow === c.flow && r.record === c.record);
  const result = all.find((r) => r.family === c.family && r.cutoff === c.cutoff && r.start === c.start)!;
  return {
    estimate: engine.estimate(c),
    test: engine.test(c),
    slope: engine.slope(c),
    actual,
    expected,
    path,
    result,
    all,
  };
}

function seriesOf(d: BaselineFile, c: Choice): number[] {
  if (c.flow === "Exports") return d.series.exports_eu;
  return c.record === "EU" ? d.series.imports_eu_eu_record : d.series.imports_eu;
}

export function App() {
  const [d, setD] = useState<BaselineFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [c, setC] = useState<Choice>(() => readChoice(location.search));
  const theme = useTheme();
  const engine = useMemo(() => (d ? new Engine(d) : null), [d]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/baseline.json`)
      .then((r) => r.json() as Promise<BaselineFile>)
      .then(setD)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    history.replaceState(null, "", `${location.pathname}${writeChoice(c)}`);
  }, [c]);

  const got = useMemo(() => (engine && d ? derive(engine, d, c) : null), [engine, d, c]);

  // on a phone the controls push the answer off screen, so a small copy of it
  // sits at the foot of the screen while the big one is out of view
  const bigRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  useEffect(() => {
    const el = bigRef.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(([e]) => setAway(!e!.isIntersecting && e!.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [got !== null]);

  const set = (patch: Partial<Choice>) => setC((prev) => settle({ ...prev, ...patch }));

  return (
    <div className="wrap">
      <header>
        <div className="mark">
          <svg className="glyph" viewBox="0 0 20 16" aria-hidden="true">
            <polyline points="1,13 8,6 13,9 19,3" className="g-actual" />
            <polyline points="1,11 19,1" className="g-base" />
          </svg>
          <b>Brexit baseline</b>
          <small>the assumption inside the number</small>
        </div>
        <button
          className="toggle"
          type="button"
          onClick={theme.toggle}
          aria-label={`Switch to ${theme.dark ? "light" : "dark"} theme`}
        >
          {theme.dark ? "Light" : "Dark"}
        </button>
      </header>

      <main>
        <div className="hero">
          <h1>What did Brexit do to UK trade with the EU? It depends what you compare it with.</h1>
          <p className="lede">
            Nobody can see the UK that stayed in, so every answer compares what happened with a baseline for what would
            have happened. Pick one, and see whether it could forecast four ordinary years before you believe it.
          </p>
        </div>

        <div className={got ? "answer" : "answer skeleton"} aria-live="polite">
          {failed ? (
            <p>The data did not load. Refresh the page to try again.</p>
          ) : got && d ? (
            <Answer d={d} c={c} got={got} bigRef={bigRef} />
          ) : (
            <p>Loading thirty years of UK trade</p>
          )}
        </div>

        <Controls c={c} set={set} />

        {got && d && <Sections d={d} c={c} got={got} />}
      </main>

      {got && (
        <div className={away ? "dock shown" : "dock"} aria-hidden="true">
          <b>{direction(got.estimate)}</b>
          <span className={passes(d!, got.test) ? "ok" : "no"}>
            {passes(d!, got.test) ? "passes its test" : "fails its test"}
          </span>
        </div>
      )}

      <footer>
        <p>
          Sources: ONS, trade in goods, all countries, seasonally adjusted (MRETS), released 11 September 2026;
          Eurostat, EU27 exports to the United Kingdom and the pound-per-euro rate. Chained volumes at 2023 prices,
          goods less precious metals.
        </p>
        <p>
          Goods only. A gap against a baseline says how far trade is from what that baseline expects, not what caused
          it. The pandemic, the energy shock and anything that hit trade elsewhere differently move these answers.
        </p>
        <p>
          Built by Finn Lakin. The method, the code and every check are at{" "}
          <a href={REPO}>github.com/FinnTech3/brexit-baseline</a>. No cookies, no tracking.
        </p>
      </footer>
    </div>
  );
}

function Segmented<T extends string | number>({
  id,
  label,
  options,
  value,
  onPick,
}: {
  id: string;
  label: string;
  options: [T, string][];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="field">
      <span id={id}>{label}</span>
      <div className="segmented" role="group" aria-labelledby={id}>
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onPick(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Controls({ c, set }: { c: Choice; set: (patch: Partial<Choice>) => void }) {
  const hi = lastStart(c.family, c.cutoff);
  return (
    <div className="controls" aria-label="Choose the baseline">
      <Segmented
        id="flow"
        label="Trade"
        options={[
          ["Exports", "Exports to the EU"],
          ["Imports", "Imports from the EU"],
        ]}
        value={c.flow}
        onPick={(flow) => set({ flow })}
      />
      <Segmented
        id="family"
        label="Compared with"
        options={FAMILIES.map((f) => [f, FAMILY_LABEL[f]])}
        value={c.family}
        onPick={(family) => set({ family })}
      />
      <Segmented
        id="cutoff"
        label="Measured from"
        options={CUTOFFS.map((y) => [y, `${CUTOFF_LABEL[y]} (${y})`])}
        value={c.cutoff}
        onPick={(cutoff) => set({ cutoff })}
      />
      <div className="field">
        <label htmlFor="start">{`Fitted to ${c.start === c.cutoff ? `${c.cutoff} alone` : `${c.start} to ${c.cutoff}`}`}</label>
        <input
          id="start"
          type="range"
          min={FIRST_START}
          max={hi}
          step={1}
          value={c.start}
          onChange={(e) => set({ start: Number(e.target.value) })}
          aria-valuetext={`from ${c.start}`}
        />
        <span className="hint">{`Any start year from ${FIRST_START} to ${hi}.`}</span>
      </div>
      {c.flow === "Imports" && (
        <Segmented
          id="record"
          label="Whose record"
          options={[
            ["UK", "The UK's"],
            ["EU", "The EU's"],
          ]}
          value={c.record}
          onPick={(record) => set({ record })}
        />
      )}
    </div>
  );
}

function Answer({
  d,
  c,
  got,
  bigRef,
}: {
  d: BaselineFile;
  c: Choice;
  got: Derived;
  bigRef: React.RefObject<HTMLDivElement>;
}) {
  const shown = useCountUp(got.estimate) ?? got.estimate;
  const ok = passes(d, got.test);
  const row = got.all.filter((r) => r.cutoff === c.cutoff);
  const good = row.filter((r) => passes(d, r.test));
  return (
    <>
      <div className="answer-main">
        <div className="where">
          <b>{FLOW_LABEL[c.flow]}</b>
          <span>{`August 2025 to July 2026, in volume${c.flow === "Imports" ? `, on the ${c.record === "UK" ? "UK's" : "EU's"} record` : ""}`}</span>
        </div>
        <div className="big" ref={bigRef}>
          <span className="num">{pct(shown)}</span>
          <span className="dir">{got.estimate < 0 ? "lower" : "higher"}</span>
        </div>
        <p className="unit">
          {`than a baseline where ${describe(c, got.slope)} expects: ${bn(got.actual)} against ${bn(got.expected)}.`}
        </p>
      </div>
      <div className="answer-side">
        <div className={ok ? "verdict ok" : "verdict no"}>
          <span className="pill">{ok ? "Passes its test" : "Fails its test"}</span>
          <span>{`Run four years earlier, it was off by ${pct(got.test)} on ${c.cutoff - d.test_years + 1} to ${c.cutoff}, when nothing had changed yet.`}</span>
        </div>
        <p className="context">
          {`Of the ${row.length} baselines measured from ${CUTOFF_LABEL[c.cutoff]!.toLowerCase()}, ${good.length} pass. ` +
            (good.length
              ? `They say ${between(Math.min(...good.map((r) => r.estimate)), Math.max(...good.map((r) => r.estimate)))}.`
              : "")}
        </p>
      </div>
    </>
  );
}

function Sections({ d, c, got }: { d: BaselineFile; c: Choice; got: Derived }) {
  const engine = useMemo(() => new Engine(d), [d]);
  const eu = seriesOf(d, c);
  const rolling = useMemo(() => ({ actual: engine.rolling(eu), times: engine.times.slice(11) }), [engine, eu]);
  const expected = useMemo(() => engine.rolling(got.path), [engine, got.path]);
  const records = useMemo(() => {
    const first = engine.times.indexOf(Number(d.records.first.slice(0, 4)) + 1 / 24);
    const uk = engine.rolling(d.records.uk);
    const euR = engine.rolling(d.records.eu);
    return { times: engine.times.slice(first + 11, first + 11 + uk.length), ratio: uk.map((v, i) => v / euR[i]!) };
  }, [engine, d]);
  const passing = got.all.filter((r) => passes(d, r.test));
  const card = useMemo(
    () => ({
      lead: `${FLOW_LABEL[c.flow]} in the latest twelve months, against a baseline where ${describe(c, got.slope)}:`,
      big: direction(got.estimate),
      unit: "than that baseline expects",
      lines: [
        `Run four years earlier, it was off by ${pct(got.test)}: it ${passes(d, got.test) ? "passes" : "fails"} its test.`,
        `Of ${got.all.length} baselines, the ${passing.length} that pass say ${between(Math.min(...passing.map((r) => r.estimate)), Math.max(...passing.map((r) => r.estimate)))}.`,
      ],
      dots: got.all.map((r) => ({
        v: r.estimate,
        pass: passes(d, r.test),
        me: r === got.result,
      })),
    }),
    [c, got, d, passing],
  );

  return (
    <>
      <section>
        <h2>What this baseline expects</h2>
        <p className="sub">
          {`${FLOW_LABEL[c.flow]} in the twelve months to each month, against the baseline fitted to ${span(c.start, c.cutoff)}. The bar along the axis marks the four years it was tested on, run from four years earlier.`}
        </p>
        <div className="fig">
          <PathChart
            times={rolling.times}
            actual={rolling.actual}
            expected={expected}
            start={c.start}
            cutoff={c.cutoff}
            testYears={d.test_years}
            label={FLOW_LABEL[c.flow]}
          />
          <ul className="legend" aria-hidden="true">
            <li className="l-actual">what happened</li>
            <li className="l-expected">what the baseline expects</li>
            <li className="l-fit">years it was fitted to</li>
            <li className="l-test">its test years</li>
          </ul>
        </div>
      </section>

      <section>
        <h2>Every baseline, and yours</h2>
        <p className="sub">
          {`All ${got.all.length} baselines for ${c.flow === "Exports" ? "exports" : "imports"}: three recipes, two starting points and every start year from ${FIRST_START}. Filled dots got their four test years within ${Math.round(d.pass * 100)}%; rings missed. The large dot is yours.`}
        </p>
        <div className="fig">
          <StripChart results={got.all} mine={got.result} pass={d.pass} />
        </div>
      </section>

      <section>
        <h2>Whose record?</h2>
        <p className="sub">
          {c.flow === "Imports"
            ? `The EU keeps its own record of what it sends the UK. Until 2021 the two moved together; since the UK started counting EU imports from customs declarations in January 2022, the UK has recorded far more. On the EU's record, imports from the EU are about ${pct(1 - d.records.before / records.ratio[records.ratio.length - 1]!, 0)} lower again. You are using the ${c.record === "UK" ? "UK's" : "EU's"} record.`
            : "For imports, the UK's and the EU's records of the same goods have come apart since January 2022. The same check cannot be made on exports: since 2021 the EU records its imports from outside the EU by country of origin, so goods sent from the UK but made elsewhere no longer count as coming from the UK."}
        </p>
        <div className="fig">
          <RecordsChart times={records.times} ratio={records.ratio} before={d.records.before} />
          <p className="caption">UK imports from the EU for every £1 of EU exports to the UK, all goods, in pounds.</p>
        </div>
      </section>

      <section>
        <h2>How I know the numbers are right</h2>
        <p className="sub">
          Every baseline rests on the ONS's monthly series, so the first check is that they add up the way the ONS says
          they do.
        </p>
        <ul className="checks">
          <li>
            <span className="pill">Pass</span>
            <div>
              <b>Every published total, rebuilt from its parts</b>
              <span>{`${d.checks.totals[0].toLocaleString("en-GB")} of ${d.checks.totals[1].toLocaleString("en-GB")} month-identities exact, in current prices, every month since January 1997; ${d.checks.calendar[0].toLocaleString("en-GB")} of ${d.checks.calendar[1].toLocaleString("en-GB")} months adding to their quarters and years.`}</span>
            </div>
          </li>
          <li>
            <span className="pill neutral">Twin</span>
            <div>
              <b>The same sums in chained volumes, which do not add up</b>
              <span>{`${d.checks.twin[0]} of ${d.checks.twin[1].toLocaleString("en-GB")} hold, so the check can fail.`}</span>
            </div>
          </li>
          <li>
            <span className="pill">Pass</span>
            <div>
              <b>This page against the pipeline</b>
              <span>{`The page refits every baseline itself; its tests hold all ${d.results.length} of its answers to the pipeline's.`}</span>
            </div>
          </li>
        </ul>
      </section>

      <section>
        <h2>Save your result</h2>
        <ShareCard content={card} file={`brexit-baseline-${c.flow.toLowerCase()}-${c.start}-${c.cutoff}.png`} />
      </section>
    </>
  );
}
