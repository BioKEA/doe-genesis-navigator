import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClaude } from "./lib/claude";
import { conceptSourceText, loadParsedProfiles } from "./lib/profiles";
import type { ConceptsArtifact, ProfileConceptMap } from "./lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const CACHE_DIR = resolve(BUILD_DIR, "llm-cache/retag");
const CONCEPTS_PATH = resolve(__dirname, "../../data-source/concepts.json");
const OUT = resolve(__dirname, "../../data-source/profile-concepts.json");

const SYSTEM = `You assign canonical concept tags to research-consortium \
profiles. Use ONLY ids from the provided concept list. Return ONLY JSON: \
{"conceptIds": ["id1", "id2", ...]}. Aim for 3-12 ids per profile. Do not \
invent new ids — if nothing fits, return an empty list.`;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  mkdirSync(CACHE_DIR, { recursive: true });
  const claude = createClaude({ apiKey, cacheDir: CACHE_DIR });

  const concepts = JSON.parse(readFileSync(CONCEPTS_PATH, "utf8")) as ConceptsArtifact;
  const validIds = new Set(concepts.concepts.map((c) => c.id));
  const conceptList = concepts.concepts
    .map((c) => `- ${c.id} (${c.label}) — e.g. ${c.memberPhrases.slice(0, 4).join(", ")}`)
    .join("\n");

  const profiles = loadParsedProfiles();
  const usable = profiles.filter((p) => conceptSourceText(p).length > 0);
  console.log(`re-tagging ${usable.length} profiles against ${concepts.concepts.length} curated concepts…`);

  const out: ProfileConceptMap = {};
  const PARALLEL = 10;
  for (let i = 0; i < usable.length; i += PARALLEL) {
    const batch = usable.slice(i, i + PARALLEL);
    const batchResults = await Promise.all(
      batch.map(async (p) => {
        const text = conceptSourceText(p);
        try {
          const r = await claude.askJson<{ conceptIds: string[] }>({
            system: SYSTEM,
            user: `Concept list:\n${conceptList}\n\nProfile:\n${text}\n\nReturn JSON.`,
          });
          const filtered = (r.conceptIds || []).filter((id) => validIds.has(id));
          return [p.slug, filtered] as const;
        } catch (e) {
          console.error(`  ${p.slug}: ${(e as Error).message}`);
          return [p.slug, [] as string[]] as const;
        }
      }),
    );
    for (const [slug, ids] of batchResults) out[slug] = ids;
    console.log(`  [${Math.min(i + PARALLEL, usable.length)}/${usable.length}]`);
  }

  writeFileSync(OUT, JSON.stringify(out, null, 2));
  const totalTags = Object.values(out).reduce((n, ids) => n + ids.length, 0);
  console.log(`wrote ${OUT}: ${Object.keys(out).length} profiles, ${totalTags} total tags`);
}

main().catch((e) => { console.error(e); process.exit(1); });
