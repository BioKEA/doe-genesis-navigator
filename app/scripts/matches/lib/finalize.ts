import type { Match } from "../../../src/types";

interface ScoredMatch {
  from: string;
  to: string;
  score: number;
  rationale: string;
  sharedConcepts: string[];
}

export function finalizeMatches(scored: ScoredMatch[]): Match[] {
  // Build a set of direction keys for O(1) reciprocity lookup
  const present = new Set<string>();
  for (const m of scored) present.add(`${m.from}::${m.to}`);

  const out: Match[] = scored.map((m) => ({
    from: m.from,
    to: m.to,
    score: m.score,
    rationale: m.rationale,
    sharedConcepts: m.sharedConcepts,
    reciprocal: present.has(`${m.to}::${m.from}`),
  }));

  out.sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return b.score - a.score;
  });

  return out;
}
