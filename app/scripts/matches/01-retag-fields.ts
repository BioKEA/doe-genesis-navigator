import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClaude } from "../concepts/lib/claude";
import { loadParsedProfiles } from "../concepts/lib/profiles";
import type {
  ConceptsArtifact,
  ProfileFieldConcepts,
  ProfileFieldConceptsMap,
} from "../../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const CACHE_DIR = resolve(BUILD_DIR, "llm-cache/retag-fields");
const CONCEPTS_PATH = resolve(__dirname, "../../data-source/concepts.json");
const PROFILE_CONCEPTS_PATH = resolve(__dirname, "../../data-source/profile-concepts.json");
const OUT = resolve(__dirname, "../../data-source/profile-field-concepts.json");

const SYSTEM = `You decide which of a profile's already-assigned concept tags \
are supported by ONE specific text field. Only return ids from the provided \
allowed list. Return ONLY JSON: {"conceptIds": ["id1", "id2", ...]}. If \
nothing applies, return {"conceptIds": []}.`;

function userPrompt(field: "offer" | "seek", text: string, allowed: { id: string; label: string }[]): string {
  const list = allowed.map((c) => `- ${c.id} (${c.label})`).join("\n");
  const fieldLabel = field === "offer" ? "OFFER text (what they bring)" : "SEEK text (what they need)";
  return `Allowed concept ids:\n${list}\n\n${fieldLabel}:\n${text.trim()}\n\nReturn JSON.`;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  mkdirSync(CACHE_DIR, { recursive: true });
  const claude = createClaude({ apiKey, cacheDir: CACHE_DIR });

  const concepts = JSON.parse(readFileSync(CONCEPTS_PATH, "utf8")) as ConceptsArtifact;
  const conceptById = new Map(concepts.concepts.map((c) => [c.id, c] as const));
  const profileConcepts = JSON.parse(readFileSync(PROFILE_CONCEPTS_PATH, "utf8")) as Record<string, string[]>;
  const profiles = loadParsedProfiles();

  const eligible = profiles.filter((p) => {
    const ids = profileConcepts[p.slug];
    return ids && ids.length > 0 && (p.offerings?.text?.trim().length ?? 0) > 0 && (p.seeking?.text?.trim().length ?? 0) > 0;
  });
  console.log(
    `re-tagging fields for ${eligible.length} profiles ` +
    `(skipped ${profiles.length - eligible.length} without offer or seek text)`,
  );

  const out: ProfileFieldConceptsMap = {};
  const PARALLEL = 8;

  for (let i = 0; i < eligible.length; i += PARALLEL) {
    const batch = eligible.slice(i, i + PARALLEL);
    const batchResults = await Promise.all(
      batch.map(async (p): Promise<[string, ProfileFieldConcepts]> => {
        const allowedIds = profileConcepts[p.slug];
        const allowed = allowedIds
          .map((id) => conceptById.get(id))
          .filter((c): c is NonNullable<typeof c> => c !== undefined)
          .map((c) => ({ id: c.id, label: c.label }));
        const validSet = new Set(allowed.map((c) => c.id));

        const filterValid = (ids: string[] | undefined): string[] =>
          (ids ?? []).filter((id) => validSet.has(id));

        try {
          const [offerR, seekR] = await Promise.all([
            claude.askJson<{ conceptIds: string[] }>({
              system: SYSTEM,
              user: userPrompt("offer", p.offerings!.text, allowed),
            }),
            claude.askJson<{ conceptIds: string[] }>({
              system: SYSTEM,
              user: userPrompt("seek", p.seeking!.text, allowed),
            }),
          ]);
          return [p.slug, { offer: filterValid(offerR.conceptIds), seek: filterValid(seekR.conceptIds) }];
        } catch (e) {
          console.error(`  ${p.slug}: ${(e as Error).message}`);
          return [p.slug, { offer: [], seek: [] }];
        }
      }),
    );
    for (const [slug, fc] of batchResults) out[slug] = fc;
    console.log(`  [${Math.min(i + PARALLEL, eligible.length)}/${eligible.length}]`);
  }

  writeFileSync(OUT, JSON.stringify(out, null, 2));
  const totalOffer = Object.values(out).reduce((n, fc) => n + fc.offer.length, 0);
  const totalSeek = Object.values(out).reduce((n, fc) => n + fc.seek.length, 0);
  console.log(
    `wrote ${OUT}: ${Object.keys(out).length} profiles, ` +
    `${totalOffer} offer tags, ${totalSeek} seek tags`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
