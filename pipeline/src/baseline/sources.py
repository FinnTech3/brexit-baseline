"""The ONS's monthly trade in goods series, and how to find the ones this uses.

MRETS is one wide table: a column per series, identified by a four-character
CDID and titled like "Trade in Goods (T): EU: Exports: BOP: CP: SA", and a row
per period ("2016 JUN", "2016 Q2", "2016"). CP is current prices, CVM chained
volume measures in 2023 prices, SA seasonally adjusted, all in £ million, on
the balance of payments basis.
"""

from __future__ import annotations

import csv
import functools
import io
import lzma
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SOURCES = os.path.join(ROOT, "data", "sources")
MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

# The series the study uses: goods less precious metals (including
# non-monetary gold), whose huge, erratic flows through London would
# otherwise swamp the non-EU figures.
LESS_PRECIOUS_METALS = {
    ("EU", "Exports", "CVM"): "JIM8",
    ("EU", "Imports", "CVM"): "JIM7",
    ("Non-EU", "Exports", "CVM"): "JIN3",
    ("Non-EU", "Imports", "CVM"): "JIN2",
    ("EU", "Exports", "CP"): "FSL4",
    ("EU", "Imports", "CP"): "FSL5",
    ("Non-EU", "Exports", "CP"): "FSL7",
    ("Non-EU", "Imports", "CP"): "FSL8",
}

# Totals of all goods, and the precious metals themselves, for the checks
TOTALS = {
    ("EU", "Exports", "CP"): "L87S", ("EU", "Imports", "CP"): "L87U",
    ("Non-EU", "Exports", "CP"): "L87M", ("Non-EU", "Imports", "CP"): "L87O",
    ("World", "Exports", "CP"): "BOKG", ("World", "Imports", "CP"): "BOKH",
    ("EU", "Exports", "CVM"): "LGCN", ("EU", "Imports", "CVM"): "LGDF",
    ("Non-EU", "Exports", "CVM"): "LGEB", ("Non-EU", "Imports", "CVM"): "LGEU",
    ("World", "Exports", "CVM"): "BQKQ", ("World", "Imports", "CVM"): "BQKO",
}
PRECIOUS_METALS = {
    ("EU", "Exports"): "FSJ6", ("EU", "Imports"): "FSJ4",
    ("Non-EU", "Exports"): "FSJ9", ("Non-EU", "Imports"): "FSJ8",
}

_SECTION = re.compile(r"^Trade in Goods: (.+) \((\d)\): (EU|Non-EU): (Exports|Imports): ?BOP: (CP|CVM): SA$")


@functools.lru_cache(maxsize=None)
def _table() -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    """(CDID to title, period to {CDID: cell})."""
    text = lzma.decompress(open(os.path.join(SOURCES, "ons_mret.csv.xz"), "rb").read()).decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    titles, cdids = rows[0], rows[1]
    first = next(i for i, r in enumerate(rows) if r and r[0][:4].isdigit())
    out = {}
    for r in rows[first:]:
        if r and r[0]:
            out[r[0].strip()] = {c: v.strip() for c, v in zip(cdids[1:], r[1:])}
    return dict(zip(cdids[1:], titles[1:])), out


def title(cdid: str) -> str:
    return _table()[0][cdid]


def months() -> list[str]:
    """Every month in the file, "2016 JUN" style, oldest first."""
    return [p for p in _table()[1] if re.match(r"^\d{4} [A-Z]{3}$", p)]


def years() -> list[str]:
    return [p for p in _table()[1] if re.match(r"^\d{4}$", p)]


def quarters() -> list[str]:
    return [p for p in _table()[1] if re.match(r"^\d{4} Q[1-4]$", p)]


def value(cdid: str, period: str) -> float | None:
    cell = _table()[1].get(period, {}).get(cdid, "")
    return float(cell) if cell else None


def series(cdid: str) -> dict[str, float]:
    """A series' monthly values, where published."""
    return {m: v for m in months() if (v := value(cdid, m)) is not None}


@functools.lru_cache(maxsize=None)
def sections() -> dict[tuple[str, str, str], dict[str, str]]:
    """(partner, flow, measure) to {SITC section digit: CDID}, found by title."""
    out: dict[tuple[str, str, str], dict[str, str]] = {}
    for cdid, t in _table()[0].items():
        m = _SECTION.match(t.strip())
        if m:
            out.setdefault((m.group(3), m.group(4), m.group(5)), {})[m.group(2)] = cdid
    return out


def month_index(period: str) -> tuple[int, int]:
    y, m = period.split()
    return int(y), MONTH_NAMES.index(m) + 1
