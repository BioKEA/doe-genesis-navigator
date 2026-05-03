import type { Match } from "../../types";

export function selectTopKMatchEdges(matches: Match[], k: number): Match[] {
  if (k <= 0) return [];
  const byFrom = new Map<string, Match[]>();
  for (const m of matches) {
    const list = byFrom.get(m.from) ?? [];
    list.push(m);
    byFrom.set(m.from, list);
  }
  const out: Match[] = [];
  for (const list of byFrom.values()) {
    list.sort((a, b) => b.score - a.score);
    out.push(...list.slice(0, k));
  }
  return out;
}
