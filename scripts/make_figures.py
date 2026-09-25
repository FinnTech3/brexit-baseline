"""Draw the figures in docs/figures from the committed data.

    python3 scripts/make_figures.py

Every number comes from the same run the report prints, so a figure cannot
disagree with the text. CI regenerates them and fails on any difference. Each
figure comes in a light and a dark version, written as SVG directly: no
plotting library, nothing to install.
"""

from __future__ import annotations

import os
import sys
from xml.sax.saxutils import escape

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "pipeline", "src"))

from baseline import sources, study  # noqa: E402

OUT = os.path.join(ROOT, "docs", "figures")
SANS = "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif"
MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

# Indigo for a baseline that passes its test and for the first of two
# compared, crimson for the second, grey for everything else. Indigo and
# crimson stay distinct under the common colour-vision deficiencies and clear
# 3:1 against both backgrounds.
LIGHT = {"bg": "#fbfaf7", "ink": "#111110", "dim": "#52514e", "muted": "#6b6a65",
         "grid": "#e6e4dc", "axis": "#c3c2b7", "rest": "#b9b6ab", "you": "#4f46b8", "other": "#b3306a"}
DARK = {"bg": "#161614", "ink": "#f3f2ee", "dim": "#c3c2b7", "muted": "#9a988f",
        "grid": "#2a2a27", "axis": "#3d3d3a", "rest": "#5f5e59", "you": "#9c93f0", "other": "#e8739e"}

W = 1120
LEFT = 64


class Svg:
    def __init__(self, h: int, p: dict, title: str, subtitle: str):
        self.p, self.h = p, h
        self.parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {h}" width="{W}" height="{h}" '
            f'role="img" aria-label="{escape(title)}">',
            f'<rect width="{W}" height="{h}" fill="{p["bg"]}"/>',
        ]
        self.text(LEFT, 44, title, 21, "ink", weight=600)
        self.text(LEFT, 70, subtitle, 14, "dim")

    def text(self, x, y, s, size=13, colour="ink", family=SANS, anchor="start", weight=400, halo=False):
        ring = f' stroke="{self.p["bg"]}" stroke-width="4" paint-order="stroke"' if halo else ""
        self.parts.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}" fill="{self.p[colour]}" text-anchor="{anchor}"{ring}>{escape(s)}</text>')

    def line(self, x1, y1, x2, y2, colour="grid", width=1.0, dash=None):
        extra = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                          f'stroke="{self.p[colour]}" stroke-width="{width}"{extra}/>')

    def column(self, x, base, width, height, colour):
        """A column rounded at its data end and square at the baseline."""
        r = min(3.0, width / 2, abs(height))
        top = base - height
        self.parts.append(
            f'<path d="M{x:.1f},{base:.1f} V{top + r:.1f} Q{x:.1f},{top:.1f} {x + r:.1f},{top:.1f} '
            f'H{x + width - r:.1f} Q{x + width:.1f},{top:.1f} {x + width:.1f},{top + r:.1f} V{base:.1f} Z" '
            f'fill="{self.p[colour]}"/>')

    def bar(self, x, y, length, thick, colour):
        """A horizontal bar rounded at its data end."""
        r = min(3.0, thick / 2, length)
        self.parts.append(
            f'<path d="M{x:.1f},{y:.1f} H{x + length - r:.1f} Q{x + length:.1f},{y:.1f} {x + length:.1f},{y + r:.1f} '
            f'V{y + thick - r:.1f} Q{x + length:.1f},{y + thick:.1f} {x + length - r:.1f},{y + thick:.1f} '
            f'H{x:.1f} Z" fill="{self.p[colour]}"/>')

    def dot(self, x, y, colour, r=5.0):
        self.parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r + 2:.1f}" fill="{self.p["bg"]}"/>')
        self.parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{self.p[colour]}"/>')

    def polyline(self, pts, colour, width=2.0, dash=None):
        d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        extra = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(f'<polyline points="{d}" fill="none" stroke="{self.p[colour]}" '
                          f'stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"{extra}/>')

    def footnote(self, s):
        self.text(LEFT, self.h - 24, s, 12, "muted")

    def svg(self) -> str:
        return "\n".join(self.parts + ["</svg>"]) + "\n"


    def ring(self, x, y, colour, r=4.5):
        self.parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{self.p["bg"]}" '
                          f'stroke="{self.p[colour]}" stroke-width="1.5"/>')


def pct(v: float) -> str:
    return f"{v * 100:+.1f}%".replace("-", "\u2212")


def swarm(xs: list[float], step: float) -> list[int]:
    """An offset for each dot, 0, -1, 1, -2, 2 and so on, so that none overlap: the nearest free one."""
    taken: dict[int, list[float]] = {}
    out = []
    for cx in xs:
        k = 0
        while any(abs(cx - c) < step for c in taken.get(k, [])):
            k = -k if k > 0 else -k + 1
        taken.setdefault(k, []).append(cx)
        out.append(k)
    return out


def fig_recipes(p):
    groups = [("Exports", "UK", 2015), ("Exports", "UK", 2019), ("Imports", "UK", 2015), ("Imports", "UK", 2019)]
    s = Svg(640, p, "Imports: every baseline that passes says lower. Exports: they disagree",
            "UK goods trade with the EU in the latest twelve months against each baseline, in volume. "
            "Filled: got its four test years within 5%")
    x0, x1 = LEFT + 170, W - 40
    lo, hi = -0.40, 0.70
    x = lambda v: x0 + (v - lo) / (hi - lo) * (x1 - x0)
    top, gap = 160, 108
    for v in [-0.4, -0.2, 0, 0.2, 0.4, 0.6]:
        s.line(x(v), top - 40, x(v), top + gap * len(groups) - 40, "axis" if v == 0 else "grid", 1.5 if v == 0 else 1)
        s.text(x(v), top + gap * len(groups) - 18, pct(v).replace(".0", "").replace("+0%", "0"), 12, "muted", MONO, "middle")
    s.text(x(0) - 8, top - 52, "\u2190 lower than the baseline expects", 12, "muted", SANS, "end")
    s.text(x(0) + 8, top - 52, "higher \u2192", 12, "muted")
    for k, (flow, record, cutoff) in enumerate(groups):
        base = top + k * gap
        res = sorted((x_ for x_ in study.results(flow, record) if x_.recipe.cutoff == cutoff), key=lambda r: r.estimate)
        ok = [r for r in res if r.passed]
        s.text(LEFT, base - 8, flow, 15, "ink", SANS, "start", 600)
        s.text(LEFT, base + 10, f"from {'before the vote' if cutoff == 2015 else 'before the new rules'}", 13, "dim")
        s.text(LEFT, base + 28, f"({cutoff}); {len(ok)} of {len(res)} pass", 12, "muted", MONO)
        rows = swarm([x(r.estimate) for r in res], 9.0)
        for r, row in zip(res, rows):
            cy = base + row * 9.0
            if r.passed:
                s.dot(x(r.estimate), cy, "you", 4.3)
            else:
                s.ring(x(r.estimate), cy, "muted", 3.8)
    s.footnote("Chained volumes, goods less precious metals, August 2025 to July 2026. Sources: ONS MRETS; the pipeline in this repo.")
    return s.svg()


def rolling(values: dict[str, float], ms: list[str]) -> list[float]:
    """The twelve months to each month in ms."""
    every = sources.months()
    return [sum(values[m] for m in every[every.index(end) - 11:every.index(end) + 1]) for end in ms]


def axis_years(s, x, y0, first, last, step=2):
    for yr in range(first, last + 1, step):
        s.text(x(yr), y0 + 20, str(yr), 12, "muted", MONO, "middle")


def fig_two(p):
    a = study.Recipe("Exports", "with non-EU", 2019, 2017)
    b = study.Recipe("Exports", "with non-EU and drift", 2015, 2009)
    s = Svg(620, p, f"Two baselines that both pass: one says exports are {abs(study.estimate(a)):.0%} lower, the other "
            f"{study.estimate(b):.0%} higher",
            "UK goods exports to the EU in the twelve months to each month, chained volume, £ billion, against what two "
            "baselines expect")
    every = sources.months()
    ms = every[every.index("2008 DEC"):]
    actual = rolling(study.volumes("Exports", "EU"), ms)
    lines = [(a, "you", rolling(study.expected(a, a.start, a.cutoff), ms)),
             (b, "other", rolling(study.expected(b, b.start, b.cutoff), ms))]
    x0, x1, top, bot = LEFT + 40, W - 250, 110, 520
    lo, hi = 120, 260
    x = lambda t: x0 + (t - 2009) / (2026.6 - 2009) * (x1 - x0)
    y = lambda v: bot - (v / 1000 - lo) / (hi - lo) * (bot - top)
    for v in range(lo, hi + 1, 20):
        s.line(x0, y(v * 1000), x1, y(v * 1000), "grid")
        s.text(x0 - 8, y(v * 1000) + 4, str(v), 12, "muted", MONO, "end")
    axis_years(s, x, bot, 2010, 2026)
    for yr, label in ((2016.48, "vote"), (2021.0, "new rules")):
        s.line(x(yr), top - 10, x(yr), bot, "axis", 1, "3 3")
        s.text(x(yr) + 5, top - 2, label, 12, "muted")
    t = [study.t(m) + 1 / 24 for m in ms]
    for recipe, colour, path in lines:
        s.parts.append(f'<rect x="{x(recipe.start):.1f}" y="{bot - (6 if colour == "you" else 12):.1f}" '
                       f'width="{x(recipe.cutoff + 1) - x(recipe.start):.1f}" height="6" fill="{p[colour]}"/>')
        # each baseline from the end of its first fitted year on
        s.polyline([(x(tt), y(v)) for tt, v in zip(t, path) if tt >= recipe.start + 1], colour, 2.2, "6 4")
    s.polyline([(x(tt), y(v)) for tt, v in zip(t, actual)], "ink", 2.6)
    end = x(t[-1])
    s.dot(end, y(actual[-1]), "ink", 4)
    s.text(end + 12, y(actual[-1]) + 4, f"actual: £{actual[-1] / 1000:.0f}bn", 13, "ink", MONO, "start", 600)
    notes = {
        "you": [f"in step with non-EU trade at its", f"{a.start}-{a.cutoff} ratio: actual {pct(study.estimate(a))}",
                f"off by {abs(study.test(a)):.1%} on its test years"],
        "other": [f"with the EU's share still falling", f"as in {b.start}-{b.cutoff}: actual {pct(study.estimate(b))}",
                  f"off by {abs(study.test(b)):.1%} on its test years"],
    }
    for recipe, colour, path in lines:
        yy = y(path[-1])
        s.dot(end, yy, colour, 4)
        # the upper note sits above its line's end, the lower one below
        first = yy - 20 if path[-1] > actual[-1] else yy + 4
        for i, line in enumerate(notes[colour]):
            s.text(end + 12, first + i * 16, line, 12, colour if i < 2 else "dim", SANS, "start", 600 if i < 2 else 400)
    s.text(x0, bot + 48, "Bars along the axis: the years each baseline was fitted to.", 12, "dim")
    s.footnote("Goods less precious metals, seasonally adjusted, 2023 prices. Source: ONS MRETS; the pipeline in this repo.")
    return s.svg()


def fig_share(p):
    every = sources.months()
    ms = every[every.index("1997 DEC"):]
    s = Svg(560, p, "The EU's share of UK goods exports fell until 2012, then held until the new rules",
            "The EU's share of UK goods trade in the twelve months to each month, in volume")
    x0, x1, top, bot = LEFT + 40, W - 150, 110, 470
    lo, hi = 45, 65
    x = lambda t: x0 + (t - 1998) / (2026.6 - 1998) * (x1 - x0)
    y = lambda v: bot - (v * 100 - lo) / (hi - lo) * (bot - top)
    for v in range(lo, hi + 1, 5):
        s.line(x0, y(v / 100), x1, y(v / 100), "grid")
        s.text(x0 - 8, y(v / 100) + 4, f"{v}%", 12, "muted", MONO, "end")
    axis_years(s, x, bot, 1998, 2026, 4)
    for yr, label in ((2016.48, "vote"), (2021.0, "new rules")):
        s.line(x(yr), top - 10, x(yr), bot, "axis", 1, "3 3")
        s.text(x(yr) + 5, top - 2, label, 12, "muted")
    t = [study.t(m) + 1 / 24 for m in ms]
    for flow, colour in (("Exports", "you"), ("Imports", "other")):
        eu, other = rolling(study.volumes(flow, "EU"), ms), rolling(study.volumes(flow, "Non-EU"), ms)
        share = [e / (e + o) for e, o in zip(eu, other)]
        s.polyline([(x(tt), y(v)) for tt, v in zip(t, share)], colour, 2.4)
        s.dot(x(t[-1]), y(share[-1]), colour, 4)
        s.text(x(t[-1]) + 12, y(share[-1]) + 4 + (8 if flow == "Imports" else -2), f"{flow.lower()} {share[-1]:.0%}", 13, colour, SANS, "start", 600)
    s.text(x(2002.3), y(0.635), "2002 and 2006: the ONS's two biggest", 12, "dim", SANS, "start")
    s.text(x(2002.3), y(0.635) + 16, "adjustments for missing-trader VAT fraud", 12, "dim", SANS, "start")
    s.footnote("Goods less precious metals, chained volumes. Fraud: the ONS's adjustment, series OFNN. Source: ONS MRETS.")
    return s.svg()


def fig_records(p):
    uk = sources.series(study.TOTALS[("EU", "Imports", "CP")])
    eu = sources.eu_exports_to_uk()
    every = [m for m in sources.months() if m in eu]
    ms = every[11:]
    ratio = [sum(uk[m] for m in every[i - 11:i + 1]) / sum(eu[m] for m in every[i - 11:i + 1]) for i in range(11, len(every))]
    s = Svg(560, p, "The UK's record of imports from the EU jumped in 2022; the EU's did not",
            "UK imports from the EU for every £1 of EU exports to the UK, all goods, in the twelve months to each month")
    x0, x1, top, bot = LEFT + 50, W - 150, 110, 470
    lo, hi = 0.85, 1.15
    x = lambda t: x0 + (t - 2003) / (2026.6 - 2003) * (x1 - x0)
    y = lambda v: bot - (v - lo) / (hi - lo) * (bot - top)
    for v in (0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15):
        s.line(x0, y(v), x1, y(v), "axis" if v == 1 else "grid")
        s.text(x0 - 8, y(v) + 4, f"£{v:.2f}", 12, "muted", MONO, "end")
    axis_years(s, x, bot, 2003, 2026, 3)
    before = study.record_before()
    s.line(x(2016), y(before), x(2021), y(before), "you", 2.5)
    s.text(x(2016), y(0.895), f"2016-2020: £{before:.2f}", 12, "you", MONO, "start", 600)
    s.text(x(2006.9) + 10, y(1.15), "2006: the peak of the ONS's adjustment", 12, "dim")
    s.text(x(2006.9) + 10, y(1.15) + 16, "for missing-trader VAT fraud", 12, "dim")
    s.line(x(2022), top - 10, x(2022), bot, "axis", 1, "3 3")
    s.text(x(2022) - 6, y(0.865), "January 2022: GB imports from the EU move from a survey to customs declarations",
           12, "muted", SANS, "end")
    t = [study.t(m) + 1 / 24 for m in ms]
    s.polyline([(x(tt), y(v)) for tt, v in zip(t, ratio)], "ink", 2.4)
    s.dot(x(t[-1]), y(ratio[-1]), "ink", 4)
    s.text(x(t[-1]) + 12, y(ratio[-1]) + 4, f"£{ratio[-1]:.2f}", 13, "ink", MONO, "start", 600)
    s.footnote("UK: ONS MRETS, series L87U. EU: Eurostat, EU27 exports to the UK in euros, at each month's average rate.")
    return s.svg()


FIGURES = {
    "recipes": fig_recipes,
    "two": fig_two,
    "share": fig_share,
    "records": fig_records,
}


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    for name, fig in FIGURES.items():
        for mode, palette in (("light", LIGHT), ("dark", DARK)):
            with open(os.path.join(OUT, f"{name}-{mode}.svg"), "w") as f:
                f.write(fig(palette))
    print(f"wrote {len(FIGURES) * 2} figures to docs/figures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
