import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCandidatePairs } from "./lib/candidates";
import type { ProfileFieldConceptsMap } from "../../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const IN = resolve(__dirname, "../../data-source/profile-field-concepts.json");
const OUT = resolve(BUILD_DIR, "candidates.json");

// Pre-filter: require at least N shared concepts to qualify as a candidate.
// At ≥1 the corpus produces ~138k pairs (~$100-150 to score), almost all of
// which would be dropped at the 0.5 score floor as weak overlaps. At ≥2 we
// get ~63k candidates (~$50) covering essentially the same high-quality
// matches with multiple thematic anchors.
const MIN_SHARED_CONCEPTS = 2;

function main() {
  mkdirSync(BUILD_DIR, { recursive: true });
  const fc = JSON.parse(readFileSync(IN, "utf8")) as ProfileFieldConceptsMap;
  const all = buildCandidatePairs(fc);
  const pairs = all.filter((p) => p.sharedConcepts.length >= MIN_SHARED_CONCEPTS);
  writeFileSync(OUT, JSON.stringify(pairs));
  console.log(
    `wrote ${OUT}: ${pairs.length} candidate pairs ` +
    `(filtered from ${all.length} with ≥${MIN_SHARED_CONCEPTS} shared concepts)`,
  );
}

main();
