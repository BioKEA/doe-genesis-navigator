import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { embedTexts } from "./lib/embed";
import type { ConceptVector, RawConceptResponse } from "./lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const IN = resolve(BUILD_DIR, "raw-concepts.json");
const OUT = resolve(BUILD_DIR, "concept-vectors.json");

function normalize(p: string): string {
  return p.toLowerCase().trim().replace(/\s+/g, " ");
}

async function main() {
  const raw = JSON.parse(readFileSync(IN, "utf8")) as RawConceptResponse[];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const r of raw) {
    for (const p of r.phrases) {
      const n = normalize(p);
      if (n.length === 0 || seen.has(n)) continue;
      seen.add(n);
      unique.push(n);
    }
  }
  console.log(`embedding ${unique.length} unique phrases (model warm-up takes ~30s)…`);

  const BATCH = 50;
  const vectors: number[][] = [];
  for (let i = 0; i < unique.length; i += BATCH) {
    const slice = unique.slice(i, i + BATCH);
    const v = await embedTexts(slice);
    vectors.push(...v);
    console.log(`  [${Math.min(i + BATCH, unique.length)}/${unique.length}]`);
  }

  const out: ConceptVector[] = unique.map((phrase, i) => ({ phrase, embedding: vectors[i] }));
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT}: ${out.length} vectors of dim ${out[0].embedding.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
