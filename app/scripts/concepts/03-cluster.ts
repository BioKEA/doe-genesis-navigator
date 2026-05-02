import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dbscanCluster } from "./lib/cluster";
import type { ClusterResult, ConceptVector } from "./lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const IN = resolve(BUILD_DIR, "concept-vectors.json");
const OUT = resolve(BUILD_DIR, "clusters.json");

// Tunables.
const EPS = 0.6;
const MIN_POINTS = 3;
const SMALL_CLUSTER_MAX = 4;        // clusters with ≤ this many members are "small"
const MERGE_COSINE_THRESHOLD = 0.6;  // small ↔ any centroid similarity to fuse (iterative)

function centroid(idxs: number[], vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const c = new Array(dim).fill(0);
  for (const i of idxs) {
    const v = vectors[i];
    for (let d = 0; d < dim; d++) c[d] += v[d];
  }
  for (let d = 0; d < dim; d++) c[d] /= idxs.length;
  return c;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/**
 * Iterative agglomeration: while any cluster of size ≤ SMALL_CLUSTER_MAX
 * exists, find its single nearest other cluster (any size) by centroid cosine
 * similarity. If that similarity exceeds MERGE_COSINE_THRESHOLD, merge the
 * two; otherwise leave the small cluster standalone. Repeats until no further
 * merges are possible. Two small clusters can fuse into a larger one, which
 * may then no longer be "small" and stops attracting further merges.
 */
function mergeSmallClusters(
  clusters: ClusterResult[],
  phraseToIdx: Map<string, number>,
  vectors: number[][],
): { merged: ClusterResult[]; absorbed: number } {
  const real = clusters.filter((c) => c.clusterId !== -1).map((c) => ({ ...c, members: [...c.members] }));
  const noise = clusters.find((c) => c.clusterId === -1);

  const centroidOf = (members: string[]): number[] => {
    const idxs = members.map((m) => phraseToIdx.get(m)!).filter((i) => i !== undefined);
    return centroid(idxs, vectors);
  };

  let absorbed = 0;
  // Map clusterId → live ClusterResult (mutable while we iterate)
  const live = new Map<number, ClusterResult>();
  for (const c of real) live.set(c.clusterId, c);

  while (true) {
    const liveArr = [...live.values()];
    const smallCandidates = liveArr.filter((c) => c.members.length <= SMALL_CLUSTER_MAX);
    if (smallCandidates.length === 0) break;

    // Score each small cluster's best merge candidate; pick the highest-scoring
    // pair across the whole set. This gives the most-confident merge first and
    // is more stable than first-match-wins.
    let bestPair: { aId: number; bId: number; sim: number } | null = null;
    const centroids = new Map<number, number[]>();
    for (const c of liveArr) centroids.set(c.clusterId, centroidOf(c.members));

    for (const s of smallCandidates) {
      const sc = centroids.get(s.clusterId)!;
      for (const o of liveArr) {
        if (o.clusterId === s.clusterId) continue;
        const sim = cosine(sc, centroids.get(o.clusterId)!);
        if (sim > MERGE_COSINE_THRESHOLD && (!bestPair || sim > bestPair.sim)) {
          bestPair = { aId: s.clusterId, bId: o.clusterId, sim };
        }
      }
    }

    if (!bestPair) break;

    // Merge bestPair.a into bestPair.b (keep b's id; b is at least as large)
    const a = live.get(bestPair.aId)!;
    const b = live.get(bestPair.bId)!;
    const into = b.members.length >= a.members.length ? b : a;
    const from = into === b ? a : b;
    into.members = [...new Set([...into.members, ...from.members])];
    live.delete(from.clusterId);
    absorbed++;
  }

  const out: ClusterResult[] = [...live.values()];
  if (noise) out.push(noise);
  return { merged: out, absorbed };
}

function main() {
  const vectors = JSON.parse(readFileSync(IN, "utf8")) as ConceptVector[];
  const phrases = vectors.map((v) => v.phrase);
  const embeddings = vectors.map((v) => v.embedding);
  const phraseToIdx = new Map(phrases.map((p, i) => [p, i] as const));

  const clusters: ClusterResult[] = dbscanCluster(phrases, embeddings, {
    eps: EPS,
    minPoints: MIN_POINTS,
  });

  const realInitial = clusters.filter((c) => c.clusterId !== -1).length;
  const noiseInitial = clusters.find((c) => c.clusterId === -1)?.members.length ?? 0;
  console.log(
    `dbscan: ${vectors.length} phrases → ${realInitial} clusters, ` +
    `${noiseInitial} noise (eps=${EPS}, minPoints=${MIN_POINTS})`,
  );

  const { merged, absorbed } = mergeSmallClusters(clusters, phraseToIdx, embeddings);
  const finalReal = merged.filter((c) => c.clusterId !== -1).length;
  console.log(
    `merge-small: absorbed ${absorbed} small clusters into larger neighbors ` +
    `(threshold cos≥${MERGE_COSINE_THRESHOLD}, max small size=${SMALL_CLUSTER_MAX}) ` +
    `→ ${finalReal} clusters remaining`,
  );

  writeFileSync(OUT, JSON.stringify(merged, null, 2));
  console.log(`wrote ${OUT}`);
}

main();
