"""The ONS's totals, rebuilt from their parts, and the twin that shows the check can fail."""

import functools

from baseline import sources, verify


@functools.lru_cache(maxsize=None)
def results():
    return {r.name: r for r in verify.run()}


def test_every_total_rebuilds_from_its_parts():
    r = results()["Every published total, rebuilt from its parts"]
    assert r.passed, r.summary
    assert r.detail["matched"] == r.detail["total"] == 3550


def test_months_add_to_quarters_and_years():
    r = results()["Months add to the published quarters and years"]
    assert r.passed, r.summary
    assert r.detail["matched"] == r.detail["total"] == 1176


def test_twin_chained_volumes_do_not_add_up():
    r = results()["Twin: the same sums in chained volumes"]
    assert not r.passed
    assert r.detail["matched"] == 190
    assert r.detail["total"] == 2130


def test_every_partner_flow_and_measure_has_ten_sections():
    assert len(sources.sections()) == 8
    assert all(sorted(s) == [str(d) for d in range(10)] for s in sources.sections().values())


def test_study_series_run_from_1997_to_july_2026():
    for cdid in sources.LESS_PRECIOUS_METALS.values():
        s = sources.series(cdid)
        assert next(iter(s)) == "1997 JAN"
        assert list(s)[-1] == "2026 JUL"
        assert len(s) == 355
