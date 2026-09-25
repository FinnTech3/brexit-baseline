"""Every number the README quotes, printed from the checked pipeline.

    PYTHONPATH=pipeline/src python3 -m baseline.report
"""

from __future__ import annotations

import sys

from . import study
from .sources import eu_exports_to_uk, eu_exports_to_uk_volume, months, series

pct = lambda x: f"{x * 100:+.1f}%"      # noqa: E731


def span(res: list[study.Result]) -> str:
    if not res:
        return "none"
    lo, hi = min(r.estimate for r in res), max(r.estimate for r in res)
    return f"{pct(lo)} to {pct(hi)}"


def main() -> int:
    r = study.run()
    ev = r["evaluation"]
    print("Verification")
    for c in r["checks"] + [study.verify.check_volumes_added()]:
        print(f"  {'pass' if c.passed else 'FAIL'}  {c.name}: {c.summary}")

    print(f"\nThe latest twelve months: {ev[0]} to {ev[-1]}")
    print(f"A recipe passes if its test is within {study.PASS:.0%}\n")
    for (flow, record), res in r["results"].items():
        name = f"{flow}, {'the UK' if record == 'UK' else 'the EU'}'s record"
        passed = [x for x in res if x.passed]
        print(f"{name}: {len(res)} recipes, {len(passed)} pass; all {span(res)}; passing {span(passed)}")
        for cutoff in study.CUTOFFS:
            rs = [x for x in res if x.recipe.cutoff == cutoff]
            ok = [x for x in rs if x.passed]
            best = min(rs, key=lambda x: abs(x.test))
            print(f"  cut-off {cutoff}: {len(rs)} recipes, all {span(rs)}; {len(ok)} pass, {span(ok)}")
            print(f"    closest test: {best.recipe.label}, {pct(best.estimate)} (test {pct(best.test)})")
            strict = [x for x in rs if abs(x.test) <= 0.03]
            print(f"    within 3% instead: {len(strict)} pass, {span(strict)}")
            for family in study.FAMILIES:
                f = [x for x in rs if x.recipe.family == family]
                fo = [x for x in f if x.passed]
                print(f"    {family}: {len(f)}, all {span(f)}; {len(fo)} pass, {span(fo)}")

    print("\nExports: what the passing recipes carry forward")
    passed = [x for x in r["results"][("Exports", "UK")] if x.passed]
    up = [x for x in passed if x.estimate > 0]
    down = [x for x in passed if x.estimate <= 0]
    print(f"  {len(up)} find exports higher; their slopes run {pct(min(study.slope(x.recipe) for x in up))}"
          f" to {pct(max(study.slope(x.recipe) for x in up))} a year")
    print(f"  {len(down)} find them lower; their slopes run {pct(min(study.slope(x.recipe) for x in down))}"
          f" to {pct(max(study.slope(x.recipe) for x in down))} a year")
    for x in sorted(passed, key=lambda x: x.estimate):
        print(f"    {x.recipe.label:<36} {pct(x.estimate):>7}  test {pct(x.test):>6}  slope {pct(study.slope(x.recipe))}")

    print("\nThe simplest comparison: with non-EU trade, from one year")
    for flow in study.FLOWS:
        for cutoff in study.CUTOFFS:
            x = next(x for x in study.results(flow) if x.recipe.family == "with non-EU" and x.recipe.start == cutoff
                     and x.recipe.cutoff == cutoff)
            print(f"  {flow} from {cutoff}: {pct(x.estimate)} (test {pct(x.test)})")

    print("\nThe EU's share, in volumes")
    fraud = series("OFNN")      # the ONS's adjustment for missing trader VAT fraud, imports, CVM
    for flow in study.FLOWS:
        by_year = {y: study.share(flow, [m for m in months() if study.year(m) == y]) for y in range(1997, 2026)}
        held = [by_year[y] for y in range(2012, 2020)]
        print(f"  {flow}: {by_year[1999]:.1%} in 1999, {by_year[2002]:.1%} in 2002, {by_year[2006]:.1%} in 2006, "
              f"{by_year[2012]:.1%} in 2012, {min(held):.1%} to {max(held):.1%} from 2012 to 2019, "
              f"{study.share(flow, ev):.1%} in the latest twelve months")
    peaks = sorted(range(1999, 2022), key=lambda y: -sum(v for m, v in fraud.items() if study.year(m) == y))[:2]
    print("  the fraud adjustment's two biggest years: " + ", ".join(
        f"{y} (£{sum(v for m, v in fraud.items() if study.year(m) == y) / 1000:.1f} billion)" for y in sorted(peaks)))
    top = study.Recipe("Exports", "with non-EU and drift", 2015, 2006)
    later = study.Recipe("Exports", "with non-EU and drift", 2015, 2007)
    print(f"  the top of the export range starts in 2006: {pct(study.estimate(top))}; from 2007: {pct(study.estimate(later))}")

    print("\nThe closest-fitting recipes, year by year")
    for (flow, record), res in r["results"].items():
        for cutoff in study.CUTOFFS:
            best = min((x for x in res if x.recipe.cutoff == cutoff), key=lambda x: abs(x.test))
            got = {y: study.gap(best.recipe, best.recipe.start, cutoff, [m for m in months() if study.year(m) == y])
                   for y in range(2021, 2026)}
            print(f"  {flow} ({record}), {best.recipe.label}: " + ", ".join(f"{y} {pct(v)}" for y, v in got.items()))

    print("\nWhose record: UK imports from the EU over EU exports to the UK, all goods, in pounds")
    uk, eu = series(study.TOTALS[("EU", "Imports", "CP")]), eu_exports_to_uk()
    ratio = lambda ms: sum(uk[m] for m in ms) / sum(eu[m] for m in ms)      # noqa: E731
    years = {y: ratio([m for m in uk if study.year(m) == y and m in eu]) for y in range(2002, 2026)}
    calm = [years[y] for y in range(2007, 2021)]
    print(f"  2007 to 2020, year by year: {min(calm):.3f} to {max(calm):.3f}")
    print(f"  2016 to 2020, the level the EU record is held to: {study.record_before():.3f}")
    print(f"  2021: {years[2021]:.3f}; 2022: {years[2022]:.3f}; latest twelve months: {ratio(ev):.3f}")
    print(f"  so the EU's record is {1 - study.record_before() / ratio(ev):.1%} lower than the UK's, relative to 2016-2020")
    print(f"  January 2022 on December 2021: the UK's record {pct(uk['2022 JAN'] / uk['2021 DEC'] - 1)},"
          f" the EU's {pct(eu['2022 JAN'] / eu['2021 DEC'] - 1)}")
    vol = eu_exports_to_uk_volume()
    uk_vol = series(study.LESS_PRECIOUS_METALS[("EU", "Imports", "CVM")])
    drift = lambda y: sum(uk_vol[m] for m in months() if study.year(m) == y) / sum(vol[m] for m in vol if study.year(m) == y)  # noqa: E731
    print(f"  Eurostat's volume index against the ONS's volumes, 2002 to 2019: {pct(drift(2019) / drift(2002) - 1)}")

    print("\nWhat I got wrong first")
    short = study.Recipe("Exports", "own trend", 2015, 2013)
    print(f"  a three-year trend, 2013-2015: exports {pct(study.estimate(short))}, test {pct(study.test(short))}")
    for flow in study.FLOWS:
        v = study.Recipe(flow, "with non-EU", 2019, 2019)
        eu_cp, other_cp = series(study.LESS_PRECIOUS_METALS[("EU", flow, "CP")]), series(study.LESS_PRECIOUS_METALS[("Non-EU", flow, "CP")])
        base = [m for m in months() if study.year(m) == 2019]
        value = (sum(eu_cp[m] for m in ev) / sum(other_cp[m] for m in ev)) / (sum(eu_cp[m] for m in base) / sum(other_cp[m] for m in base)) - 1
        print(f"  {flow} with non-EU from 2019: {pct(study.estimate(v))} in volumes, {pct(value)} in current prices")
    return 0


if __name__ == "__main__":
    sys.exit(main())
