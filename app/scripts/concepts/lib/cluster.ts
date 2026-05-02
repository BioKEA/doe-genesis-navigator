import pkg from "density-clustering";
import type { ClusterResult } from "./types";
const { DBSCAN } = pkg;

export interface ClusterOptions {
  eps: number;        // distance threshold (Euclidean over normalized embeddings ≈ sqrt(2*(1-cos)))
  minPoints: number;  // min cluster size
}

export function dbscanCluster(
  phrases: string[],
  vectors: number[][],
  opts: ClusterOptions,
): ClusterResult[] {
  if (phrases.length === 0) return [];
  if (phrases.length !== vectors.length) {
    throw new Error(`phrases.length (${phrases.length}) !== vectors.length (${vectors.length})`);
  }

  const dbscan = new DBSCAN();
  const clusters: number[][] = dbscan.run(vectors, opts.eps, opts.minPoints);
  const noise: number[] = dbscan.noise;

  const out: ClusterResult[] = clusters.map((memberIdx, clusterId) => ({
    clusterId,
    members: memberIdx.map((i) => phrases[i]),
  }));
  if (noise.length > 0) {
    out.push({ clusterId: -1, members: noise.map((i) => phrases[i]) });
  }
  return out;
}
