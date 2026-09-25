"""The recipes, on made-up trade where the answer is known, and the pinned results."""

import functools
import math

import pytest

from baseline import sources, study


def made_up(eu_after: float = 0.9):
    """Non-EU trade growing 3% a year; EU trade 1.2 times it, then eu_after times that from 2021."""
    other = {m: 100 * math.exp(0.03 * (study.t(m) - 1997)) for m in sources.months() if study.year(m) >= 1997}
    eu = {m: 1.2 * v * (eu_after if study.year(m) >= 2021 else 1) for m, v in other.items()}
    return lambda flow, partner, record="UK": eu if partner == "EU" else other


@pytest.fixture
def fake(monkeypatch):
    monkeypatch.setattr(study, "volumes", made_up())


def test_every_recipe_finds_a_ten_per_cent_fall_it_was_given(fake):
    for flow in study.FLOWS:
        for recipe in study.recipes(flow):
            assert study.estimate(recipe) == pytest.approx(-0.10, abs=1e-9), recipe.label
            assert study.test(recipe) == pytest.approx(0.0, abs=1e-9), recipe.label


def test_the_slope_is_what_was_carried_forward(fake):
    own = study.Recipe("Exports", "own trend", 2015, 2006)
    assert study.slope(own) == pytest.approx(math.exp(0.03) - 1)
    assert study.slope(study.Recipe("Exports", "with non-EU and drift", 2015, 2006)) == pytest.approx(0.0, abs=1e-9)
    assert study.slope(study.Recipe("Exports", "with non-EU", 2015, 2006)) == 0.0


def test_a_recipe_cannot_see_past_its_cut_off(monkeypatch):
    # the same trade to 2015, wildly different after: the 2015 recipes' tests cannot tell
    tests = []
    for after in (0.5, 2.0):
        monkeypatch.setattr(study, "volumes", made_up(after))
        tests.append([study.test(r) for r in study.recipes("Exports") if r.cutoff == 2015])
    assert tests[0] == tests[1]


def test_the_grid():
    recipes = study.recipes("Exports")
    assert len(recipes) == 86
    assert {r.cutoff for r in recipes} == {2015, 2019}
    assert min(r.start for r in recipes) == 2001
    for r in recipes:
        years = r.cutoff - r.start + 1
        assert years >= (1 if r.family == "with non-EU" else study.MIN_YEARS)


def test_the_eu_record_changes_nothing_before_2021():
    uk, eu = study.volumes("Imports", "EU"), study.volumes("Imports", "EU", "EU")
    assert all(uk[m] == eu[m] for m in uk if study.year(m) < 2021)
    m = "2024 JUN"
    assert eu[m] == pytest.approx(uk[m] * study.record_before() / study.record_ratio()[m])
    with pytest.raises(ValueError):
        study.volumes("Exports", "EU", "EU")


def test_the_records_part_in_january_2022():
    uk, eu = sources.series("L87U"), sources.eu_exports_to_uk()
    assert uk["2022 JAN"] / uk["2021 DEC"] - 1 == pytest.approx(0.1415, abs=5e-5)
    assert eu["2022 JAN"] / eu["2021 DEC"] - 1 == pytest.approx(-0.0331, abs=5e-5)
    assert study.record_before() == pytest.approx(0.9401, abs=5e-5)


@functools.lru_cache(maxsize=None)
def passing(flow, record="UK"):
    return sorted(round(r.estimate * 100, 1) for r in study.results(flow, record) if r.passed)


def test_pinned_imports_are_lower_on_every_passing_recipe():
    assert len(passing("Imports")) == 31
    assert (passing("Imports")[0], passing("Imports")[-1]) == (-23.7, -5.3)
    assert (passing("Imports", "EU")[0], passing("Imports", "EU")[-1]) == (-33.2, -17.1)


def test_pinned_exports_split_on_direction():
    p = passing("Exports")
    assert len(p) == 20
    assert (p[0], p[-1]) == (-12.8, 64.3)
    assert sum(x > 0 for x in p) == 10
