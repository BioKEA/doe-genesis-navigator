import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCandidatePairs } from "./lib/candidates";
import type { ProfileFieldConceptsMap } from "../../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const IN = resolve(__dirname, "../../data-source/profile-field-concepts.json");
const OUT = resolve(BUILD_DIR, "candidates.json");

function main() {
  mkdirSync(BUILD_DIR, { recursive: true });
  const fc = JSON.parse(readFileSync(IN, "utf8")) as ProfileFieldConceptsMap;
  const pairs = buildCandidatePairs(fc);
  writeFileSync(OUT, JSON.stringify(pairs));
  console.log(`wrote ${OUT}: ${pairs.length} candidate pairs`);
}

main();
