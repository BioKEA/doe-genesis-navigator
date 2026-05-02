import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { finalizeMatches } from "./lib/finalize";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const IN = resolve(BUILD_DIR, "scored-matches.json");
const OUT = resolve(__dirname, "../../data-source/matches.json");

interface ScoredMatch {
  from: string;
  to: string;
  score: number;
  rationale: string;
  sharedConcepts: string[];
}

function main() {
  const scored = JSON.parse(readFileSync(IN, "utf8")) as ScoredMatch[];
  const matches = finalizeMatches(scored);
  const reciprocalCount = matches.filter((m) => m.reciprocal).length;
  writeFileSync(OUT, JSON.stringify(matches, null, 2));
  console.log(
    `wrote ${OUT}: ${matches.length} matches, ${reciprocalCount} reciprocal ` +
    `(${(100 * reciprocalCount / matches.length).toFixed(1)}%)`,
  );
}

main();
