import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dbscanCluster } from "./lib/cluster";
import type { ClusterResult, ConceptVector } from "./lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const IN = resolve(BUILD_DIR, "concept-vectors.json");
const OUT = resolve(BUILD_DIR, "clusters.json");

// Tunables. These produce ~80-150 clusters in our typical run; lower eps for
// tighter clusters, higher minPoints to demand more support per cluster.
const EPS = 0.4;
const MIN_POINTS = 3;

function main() {
  const vectors = JSON.parse(readFileSync(IN, "utf8")) as ConceptVector[];
  const phrases = vectors.map((v) => v.phrase);
  const embeddings = vectors.map((v) => v.embedding);

  const clusters: ClusterResult[] = dbscanCluster(phrases, embeddings, {
    eps: EPS,
    minPoints: MIN_POINTS,
  });

  const real = clusters.filter((c) => c.clusterId !== -1);
  const noise = clusters.find((c) => c.clusterId === -1);
  console.log(
    `clustered ${vectors.length} phrases → ${real.length} clusters, ` +
    `${noise?.members.length ?? 0} noise points (eps=${EPS}, minPoints=${MIN_POINTS})`,
  );

  writeFileSync(OUT, JSON.stringify(clusters, null, 2));
  console.log(`wrote ${OUT}`);
}

main();
