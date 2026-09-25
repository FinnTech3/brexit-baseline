"""Rebuild the ONS's published totals from their parts before measuring anything.

In current prices every total in the file is the sum of its parts: the ten
commodity sections make each partner's total, the EU and non-EU make the
world, goods less precious metals are all goods minus the metals, and the
months make each quarter and year. The checks recompute every one of those,
for every month from January 1997, and require them to match exactly.

The twin does the same sums with chained volumes, which are not additive
across series: each year is valued at the previous year's prices and then
linked to the reference year, 2023, so the parts only add up to the total for
the months valued at the reference year's own prices, from 2024 on. A check
that passed on volumes before then would be a check that could not fail.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .sources import LESS_PRECIOUS_METALS, MONTH_NAMES, PRECIOUS_METALS, TOTALS, months, quarters, sections, value, years

PARTNERS = ("EU", "Non-EU")
FLOWS = ("Exports", "Imports")
TOLERANCE = 0.5     # £ million: the file is published to the nearest million


@dataclass
class Result:
    name: str
    passed: bool
    summary: str
    detail: dict = field(default_factory=dict)


def _identities(measure: str) -> list[tuple[str, list[str], list[str], str]]:
    """(label, parts to add, parts to subtract, total) for every identity in one measure."""
    out = []
    for partner in PARTNERS:
        for flow in FLOWS:
            secs = sections()[(partner, flow, measure)]
            out.append((f"{partner} {flow.lower()}: sections", [secs[d] for d in sorted(secs)], [],
                        TOTALS[(partner, flow, measure)]))
            if measure == "CP":
                out.append((f"{partner} {flow.lower()}: less precious metals", [TOTALS[(partner, flow, "CP")]],
                            [PRECIOUS_METALS[(partner, flow)]], LESS_PRECIOUS_METALS[(partner, flow, "CP")]))
    for flow in FLOWS:
        out.append((f"World {flow.lower()}: EU and non-EU", [TOTALS[("EU", flow, measure)], TOTALS[("Non-EU", flow, measure)]],
                    [], TOTALS[("World", flow, measure)]))
    return out


def check_identities(measure: str = "CP", name: str = "Every published total, rebuilt from its parts") -> Result:
    matched = total = 0
    worst = (0.0, "", "")
    for label, plus, minus, whole in _identities(measure):
        for m in months():
            vals = [value(c, m) for c in plus + minus + [whole]]
            if None in vals:
                continue
            total += 1
            gap = abs(sum(value(c, m) for c in plus) - sum(value(c, m) for c in minus) - value(whole, m))
            if gap <= TOLERANCE:
                matched += 1
            if gap > worst[0]:
                worst = (gap, label, m)
    return Result(name, matched == total,
                  f"{matched:,} of {total:,} month-identities exact; worst gap £{worst[0]:,.0f}m"
                  + (f" ({worst[1]}, {worst[2]})" if worst[0] else ""),
                  {"matched": matched, "total": total, "worst": worst})


def _calendar() -> list[tuple[str, list[str]]]:
    """Every quarter and year in the file, with the months that make it up."""
    out = [(y, [f"{y} {n}" for n in MONTH_NAMES]) for y in years()]
    out += [(q, [f"{q[:4]} {MONTH_NAMES[3 * (int(q[-1]) - 1) + k]}" for k in range(3)]) for q in quarters()]
    return out


def check_calendar() -> Result:
    """Months add to the published quarters and years, for every series the study uses.

    This holds for chained volumes too: they are chained a year at a time, so
    within a year the months are at the same prices and do add up.
    """
    matched = total = 0
    for cdid in LESS_PRECIOUS_METALS.values():
        for whole, parts in _calendar():
            vals = [value(cdid, m) for m in parts]
            if None in vals or value(cdid, whole) is None:
                continue
            total += 1
            matched += abs(sum(vals) - value(cdid, whole)) <= TOLERANCE
    return Result("Months add to the published quarters and years", matched == total,
                  f"{matched:,} of {total:,} quarters and years exact", {"matched": matched, "total": total})


def check_volumes_added() -> Result:
    """The twin: volumes treated as if they added up."""
    return check_identities("CVM", "Twin: the same sums in chained volumes")


def run() -> list[Result]:
    return [check_identities(), check_calendar(), check_volumes_added()]


def gate() -> list[Result]:
    results = [check_identities(), check_calendar()]
    failed = [r for r in results if not r.passed]
    if failed:
        raise SystemExit("verification failed: " + "; ".join(f"{r.name}: {r.summary}" for r in failed))
    return results
