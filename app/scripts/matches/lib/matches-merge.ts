import type { Match } from "../../../src/types";

/**
 * Returns matches keeping only the top-K outgoing per `from`. Input must
 * already be sorted by from then score desc (the shape produced by
 * finalizeMatches). Output preserves that order.
 *
 * The runtime app slices on a render-time slider, so the data layer doesn't
 * need to apply this — but parse.ts uses it to produce a smaller `matches.json`
 * in public/data/ when the full set would exceed the bundle budget.
 */
export function topKMatchesPerPartner(matches: Match[], k: number): Match[] {
  const out: Match[] = [];
  let lastFrom: string | null = null;
  let countForCurrent = 0;
  for (const m of matches) {
    if (m.from !== lastFrom) {
      lastFrom = m.from;
      countForCurrent = 0;
    }
    if (countForCurrent < k) {
      out.push(m);
      countForCurrent++;
    }
  }
  return out;
}
