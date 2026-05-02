import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClaude } from "./lib/claude";
import type {
  CategoryProposal,
  ClusterResult,
  ConceptCandidate,
} from "./lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const CACHE_DIR = resolve(BUILD_DIR, "llm-cache/label");
const IN = resolve(BUILD_DIR, "clusters.json");
const OUT = resolve(BUILD_DIR, "concept-candidates.json");
const OUT_CATS = resolve(BUILD_DIR, "categories.json");

const SYSTEM_CATS = `You design taxonomies for a research consortium. \
Given the FULL list of concept clusters in the corpus, propose 8-14 parent \
categories that together cover the field with no single category dominating. \
Aim for categories where the largest will have at most ~20% of clusters. \
Return ONLY JSON: {"categories": [{"id": "kebab-case", "label": "Title Case"}, ...]}`;

const SYSTEM_LABEL = `You assign canonical labels and parent categories to \
clusters of related research concepts. Return ONLY JSON: \
{"label": "short canonical name (1-4 words, Title Case)", "categoryId": "<one of the provided ids>"}`;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  mkdirSync(CACHE_DIR, { recursive: true });
  const claude = createClaude({ apiKey, cacheDir: CACHE_DIR });

  const allClusters = (JSON.parse(readFileSync(IN, "utf8")) as ClusterResult[])
    .filter((c) => c.clusterId !== -1);

  // Pass 1: propose parent categories from the FULL cluster list
  // (each cluster summarized as 2 representative phrases, keeps prompt small)
  const fullText = allClusters
    .map((c, i) => `${i + 1}. ${c.members.slice(0, 2).join(" / ")}`)
    .join("\n");

  console.log(`proposing categories from all ${allClusters.length} clusters…`);
  const catResp = await claude.askJson<{ categories: CategoryProposal[] }>({
    system: SYSTEM_CATS,
    user: `All clusters in the corpus:\n${fullText}\n\nReturn JSON.`,
  });
  const categories = catResp.categories;
  const validCatIds = new Set(categories.map((c) => c.id));
  const fallbackCatId = categories[0].id;
  writeFileSync(OUT_CATS, JSON.stringify(categories, null, 2));
  console.log(`  → ${categories.length} categories: ${categories.map((c) => c.id).join(", ")}`);

  // Pass 2: label each cluster + assign category
  const catList = categories.map((c) => `- ${c.id}: ${c.label}`).join("\n");
  console.log(`labeling ${allClusters.length} clusters…`);

  const candidates: ConceptCandidate[] = [];
  const PARALLEL = 10;
  for (let i = 0; i < allClusters.length; i += PARALLEL) {
    const batch = allClusters.slice(i, i + PARALLEL);
    const batchResults = await Promise.all(
      batch.map(async (c) => {
        const phrasesText = c.members.slice(0, 12).join(", ");
        const r = await claude.askJson<{ label: string; categoryId: string }>({
          system: SYSTEM_LABEL,
          user: `Categories:\n${catList}\n\nCluster phrases: ${phrasesText}\n\nReturn JSON.`,
        });
        const cat = validCatIds.has(r.categoryId) ? r.categoryId : fallbackCatId;
        return {
          clusterId: c.clusterId,
          suggestedLabel: r.label,
          suggestedCategory: cat,
          members: c.members,
        };
      }),
    );
    candidates.push(...batchResults);
    console.log(`  [${Math.min(i + PARALLEL, allClusters.length)}/${allClusters.length}]`);
  }

  writeFileSync(OUT, JSON.stringify({ categories, candidates }, null, 2));
  console.log(`wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
