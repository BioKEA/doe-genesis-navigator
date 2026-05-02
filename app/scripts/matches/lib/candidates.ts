import type { ProfileFieldConceptsMap } from "../../../src/types";

export interface CandidatePair {
  from: string;
  to: string;
  sharedConcepts: string[];
}

export function buildCandidatePairs(
  fc: ProfileFieldConceptsMap,
): CandidatePair[] {
  const slugs = Object.keys(fc);
  const out: CandidatePair[] = [];
  for (const from of slugs) {
    const offerSet = new Set(fc[from].offer);
    if (offerSet.size === 0) continue;
    for (const to of slugs) {
      if (to === from) continue;
      const seek = fc[to].seek;
      const shared: string[] = [];
      for (const id of seek) {
        if (offerSet.has(id)) shared.push(id);
      }
      if (shared.length > 0) {
        out.push({ from, to, sharedConcepts: shared });
      }
    }
  }
  return out;
}
