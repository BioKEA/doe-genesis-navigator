import type { NetworkEdge, Profile } from "../../src/types";

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function featureSet(p: Profile): Set<string> {
  const feats = new Set<string>();
  for (const c of p.challengeAreas) feats.add("c:" + c);
  for (const t of p.partnerTypeSeeking) feats.add("pt:" + t);
  for (const t of p.offerings?.tags ?? []) feats.add("o:" + t);
  return feats;
}

export function topNeighbors(profiles: Profile[], k: number): Record<string, string[]> {
  const feats = new Map(profiles.map((p) => [p.slug, featureSet(p)]));
  const result: Record<string, string[]> = {};
  for (const p of profiles) {
    const me = feats.get(p.slug)!;
    const scored = profiles
      .filter((q) => q.slug !== p.slug)
      .map((q) => ({ slug: q.slug, score: jaccard(me, feats.get(q.slug)!) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((x) => x.slug);
    result[p.slug] = scored;
  }
  return result;
}

export function buildEdges(profiles: Profile[]): NetworkEdge[] {
  const edges: NetworkEdge[] = [];
  const byChallenge = new Map<string, string[]>();
  for (const p of profiles) {
    for (const c of p.challengeAreas) {
      const arr = byChallenge.get(c) ?? [];
      arr.push(p.slug);
      byChallenge.set(c, arr);
    }
  }
  const pairs = new Map<string, number>();
  for (const slugs of byChallenge.values()) {
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        const [a, b] = [slugs[i], slugs[j]].sort();
        const key = `${a}|${b}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, weight] of pairs) {
    const [a, b] = key.split("|");
    edges.push({ a, b, weight });
  }
  return edges;
}
