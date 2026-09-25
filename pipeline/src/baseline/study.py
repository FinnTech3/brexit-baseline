"""How much UK goods trade with the EU is missing, measured against many baselines.

A baseline is a recipe for where trade with the EU would otherwise have been.
Each recipe is fitted to a run of years ending at a cut-off and carried
forward to the latest twelve months, and the gap is what was actually traded
over what the recipe expected, minus one. There are three recipes:

- Its own trend: trade with the EU keeps growing at its own rate, a straight
  line through the logs of the monthly figures.
- With non-EU trade: trade with the EU moves in step with the UK's trade with
  everywhere else, at the ratio between the two in the fit years.
- With non-EU trade and the drift: the same, but the ratio keeps moving at the
  rate it was moving in the fit years.

And two cut-offs. 2015, the last full year before the referendum, measures
the vote and the new rules together. 2019, the last full year before the new
rules and the pandemic, takes whatever happened after the vote as given and
measures the new rules alone.

The fit years run from any start year from 2001 to the cut-off, at least five
years for the two recipes with a slope. Starting no earlier than 2001 leaves
room for the test: the same recipe run four years earlier, as if the cut-off
had come four years sooner, and judged on the four years that followed, when
nothing had changed yet. For the 2015 cut-off those are 2012 to 2015; for
2019, 2016 to 2019. A recipe that cannot forecast four ordinary years has no
claim to know the last ten.

Everything is in chained volumes, goods less precious metals, seasonally
adjusted.
"""

from __future__ import annotations

import functools
import math
from dataclasses import dataclass

from . import verify
from .sources import LESS_PRECIOUS_METALS, PRECIOUS_METALS, TOTALS, eu_exports_to_uk, month_index, months, series

FLOWS = ("Exports", "Imports")
FAMILIES = ("own trend", "with non-EU", "with non-EU and drift")
CUTOFFS = (2015, 2019)
FIRST_START = 2001
MIN_YEARS = 5           # fit years for the two recipes with a slope
TEST_YEARS = 4
PASS = 0.05             # a recipe passes if it got its four test years within 5%
RECORD_YEARS = (2016, 2020)     # the last five years before either side changed its recording


@dataclass(frozen=True)
class Recipe:
    flow: str
    family: str
    cutoff: int
    start: int
    record: str = "UK"      # imports only: "EU" moves them in line with the EU's record from 2021

    @property
    def label(self) -> str:
        return f"{self.family}, {self.start}-{self.cutoff}" if self.start < self.cutoff else f"{self.family}, {self.cutoff}"


def t(month: str) -> float:
    """A month as a point in time, in years."""
    y, m = month_index(month)
    return y + (m - 0.5) / 12


def year(month: str) -> int:
    return int(month[:4])


def evaluation() -> list[str]:
    """The latest twelve months."""
    return months()[-12:]


@functools.lru_cache(maxsize=None)
def record_ratio() -> dict[str, float]:
    """The UK's record of its imports from the EU over the EU's record of its exports to the UK, all goods."""
    uk, eu = series(TOTALS[("EU", "Imports", "CP")]), eu_exports_to_uk()
    return {m: uk[m] / eu[m] for m in uk if m in eu}


@functools.lru_cache(maxsize=None)
def record_before() -> float:
    """The ratio over the five years before either side changed how it recorded this trade."""
    first, last = RECORD_YEARS
    uk, eu = series(TOTALS[("EU", "Imports", "CP")]), eu_exports_to_uk()
    span = [m for m in uk if first <= year(m) <= last]
    return sum(uk[m] for m in span) / sum(eu[m] for m in span)


@functools.lru_cache(maxsize=None)
def volumes(flow: str, partner: str, record: str = "UK") -> dict[str, float]:
    """Monthly chained volumes, goods less precious metals, £ million."""
    out = series(LESS_PRECIOUS_METALS[(partner, flow, "CVM")])
    if record == "UK":
        return out
    if (flow, partner) != ("Imports", "EU"):
        raise ValueError("only imports from the EU have a second record")
    # from 2021, move them as the EU's record moved: scale each month by how
    # far the two records have come apart since 2016-2020
    ratio, before = record_ratio(), record_before()
    return {m: v * before / ratio[m] if year(m) >= 2021 else v for m, v in out.items()}


def _ols(xs: list[float], ys: list[float]) -> tuple[float, float]:
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    return my - slope * mx, slope


def _control(recipe: Recipe):
    other = volumes(recipe.flow, "Non-EU")
    return (lambda m: 1.0) if recipe.family == "own trend" else (lambda m: other[m])


def fit(recipe: Recipe, first: int, last: int) -> tuple[float, float]:
    """The line through the logs, EU trade or its ratio to non-EU trade, over the years first to last.

    The slope is the yearly rate at which the recipe has trade with the EU, or
    its ratio to trade elsewhere, moving on its own; "with non-EU" holds it at
    zero.
    """
    eu, control = volumes(recipe.flow, "EU", recipe.record), _control(recipe)
    span = [m for m in eu if first <= year(m) <= last]
    logs = [math.log(eu[m] / control(m)) for m in span]
    if recipe.family == "with non-EU":
        return sum(logs) / len(logs), 0.0
    return _ols([t(m) for m in span], logs)


def expected(recipe: Recipe, first: int, last: int) -> dict[str, float]:
    """What the recipe, fitted to the years first to last, expects for every month."""
    a, b = fit(recipe, first, last)
    control = _control(recipe)
    return {m: control(m) * math.exp(a + b * t(m)) for m in volumes(recipe.flow, "EU", recipe.record)}


def gap(recipe: Recipe, first: int, last: int, judged: list[str]) -> float:
    eu, exp = volumes(recipe.flow, "EU", recipe.record), expected(recipe, first, last)
    return sum(eu[m] for m in judged) / sum(exp[m] for m in judged) - 1


def slope(recipe: Recipe) -> float:
    """The yearly rate of change the recipe carries forward, as a share: -0.02 is 2% a year down."""
    return math.exp(fit(recipe, recipe.start, recipe.cutoff)[1]) - 1


def estimate(recipe: Recipe) -> float:
    """Actual over expected in the latest twelve months, minus one."""
    return gap(recipe, recipe.start, recipe.cutoff, evaluation())


def test(recipe: Recipe) -> float:
    """The same recipe four years earlier, judged on the four years after its cut-off."""
    cutoff = recipe.cutoff - TEST_YEARS
    judged = [m for m in months() if cutoff < year(m) <= recipe.cutoff]
    return gap(recipe, recipe.start - TEST_YEARS, cutoff, judged)


def recipes(flow: str, record: str = "UK") -> list[Recipe]:
    out = []
    for cutoff in CUTOFFS:
        for family in FAMILIES:
            last_start = cutoff if family == "with non-EU" else cutoff - MIN_YEARS + 1
            out += [Recipe(flow, family, cutoff, s, record) for s in range(FIRST_START, last_start + 1)]
    return out


@dataclass(frozen=True)
class Result:
    recipe: Recipe
    estimate: float
    test: float

    @property
    def passed(self) -> bool:
        return abs(self.test) <= PASS


@functools.lru_cache(maxsize=None)
def results(flow: str, record: str = "UK") -> list[Result]:
    return [Result(r, estimate(r), test(r)) for r in recipes(flow, record)]


def share(flow: str, span: list[str]) -> float:
    """The EU's share of the flow over some months, in volumes."""
    eu, other = volumes(flow, "EU"), volumes(flow, "Non-EU")
    return sum(eu[m] for m in span) / (sum(eu[m] for m in span) + sum(other[m] for m in span))


def run() -> dict:
    checks = verify.gate()
    return {
        "checks": checks,
        "evaluation": evaluation(),
        "results": {
            ("Exports", "UK"): results("Exports"),
            ("Imports", "UK"): results("Imports"),
            ("Imports", "EU"): results("Imports", "EU"),
        },
    }
