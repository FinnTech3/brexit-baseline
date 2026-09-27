// Numbers as the page prints them. British conventions throughout.

/** 0.071 as "7.1%"; no sign, the words around it say which way. */
export function pct(x: number, digits = 1): string {
  return `${(Math.abs(x) * 100).toFixed(digits)}%`;
}

/** -0.071 as "7.1% lower", 0.39 as "39.0% higher". */
export function direction(x: number): string {
  return `${pct(x)} ${x < 0 ? "lower" : "higher"}`;
}

export function bn(x: number): string {
  return `£${Math.round(x / 1000)}bn`;
}

export function span(first: number, last: number): string {
  return first === last ? String(last) : `${first}-${last}`;
}

/** A span of results in words: "between 5.3% and 23.7% lower", or "from 12.8% lower to 22.2% higher". */
export function between(lo: number, hi: number): string {
  if (hi < 0) return `between ${pct(hi)} and ${pct(lo)} lower`;
  if (lo >= 0) return `between ${pct(lo)} and ${pct(hi)} higher`;
  return `from ${direction(lo)} to ${direction(hi)}`;
}
