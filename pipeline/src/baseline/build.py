"""Write the app's data, data/built/baseline.json, from the checked pipeline.

    PYTHONPATH=pipeline/src python3 -m baseline.build

The app refits whichever baseline the reader picks, so it gets the monthly
series rather than finished answers. It also gets every recipe's result from
the pipeline, which its tests must reproduce, so the page and the write-up
cannot drift apart.
"""

from __future__ import annotations

import json
import os
import sys

from . import study
from .sources import ROOT, eu_exports_to_uk, months, series

OUT = os.path.join(ROOT, "data", "built", "baseline.json")
FIRST = "1997 JAN"


def main() -> int:
    r = study.run()
    ms = months()
    span = ms[ms.index(FIRST):]
    uk, eu = series(study.TOTALS[("EU", "Imports", "CP")]), eu_exports_to_uk()
    both = [m for m in span if m in eu]

    def column(values: dict[str, float]) -> list[float]:
        return [values[m] for m in span]

    checks = {c.name: c.detail for c in r["checks"] + [study.verify.check_volumes_added()]}
    data = {
        "first": FIRST,
        "months": len(span),
        "evaluation": len(r["evaluation"]),
        "pass": study.PASS,
        "test_years": study.TEST_YEARS,
        "series": {
            "exports_eu": column(study.volumes("Exports", "EU")),
            "exports_other": column(study.volumes("Exports", "Non-EU")),
            "imports_eu": column(study.volumes("Imports", "EU")),
            "imports_eu_eu_record": column(study.volumes("Imports", "EU", "EU")),
            "imports_other": column(study.volumes("Imports", "Non-EU")),
        },
        "records": {
            "first": both[0],
            "uk": [uk[m] for m in both],
            "eu": [round(eu[m], 6) for m in both],
            "before": study.record_before(),
        },
        "checks": {
            "totals": [checks["Every published total, rebuilt from its parts"][k] for k in ("matched", "total")],
            "calendar": [checks["Months add to the published quarters and years"][k] for k in ("matched", "total")],
            "twin": [checks["Twin: the same sums in chained volumes"][k] for k in ("matched", "total")],
        },
        "results": [
            {
                "flow": x.recipe.flow, "record": x.recipe.record, "family": x.recipe.family,
                "cutoff": x.recipe.cutoff, "start": x.recipe.start,
                "estimate": x.estimate, "test": x.test, "slope": study.slope(x.recipe),
            }
            for res in r["results"].values() for x in res
        ],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
        f.write("\n")
    print(f"{OUT}: {os.path.getsize(OUT):,} bytes, {len(data['results'])} recipes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
