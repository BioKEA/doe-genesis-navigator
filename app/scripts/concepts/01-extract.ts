import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClaude } from "./lib/claude";
import { conceptSourceText, loadParsedProfiles } from "./lib/profiles";
import type { RawConceptResponse } from "./lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const CACHE_DIR = resolve(BUILD_DIR, "llm-cache/extract");
const OUT = resolve(BUILD_DIR, "raw-concepts.json");

const SYSTEM = `You read scientist/organization profiles from a research \
consortium and extract canonical concepts. Return ONLY a JSON object of the \
shape {"phrases": ["...", "..."]}. Each phrase is 1-4 words, lowercased, \
naming a capability, method, domain, or tool. Aim for 5-15 phrases. No \
duplicates. No vague terms ("research", "innovation", "collaboration").`;

function userPrompt(text: string): string {
  return `Profile:\n\n${text}\n\nReturn JSON: {"phrases": ["...", ...]}`;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  mkdirSync(BUILD_DIR, { recursive: true });
  mkdirSync(CACHE_DIR, { recursive: true });
  const claude = createClaude({ apiKey, cacheDir: CACHE_DIR });

  const profiles = loadParsedProfiles();
  const usable = profiles.filter((p) => conceptSourceText(p).length > 0);
  console.log(
    `extracting concepts from ${usable.length} profiles ` +
    `(skipped ${profiles.length - usable.length} empty)`,
  );

  const results: RawConceptResponse[] = [];
  const PARALLEL = 10;
  for (let i = 0; i < usable.length; i += PARALLEL) {
    const batch = usable.slice(i, i + PARALLEL);
    const batchResults = await Promise.all(
      batch.map(async (p) => {
        const text = conceptSourceText(p);
        try {
          const r = await claude.askJson<{ phrases: string[] }>({
            system: SYSTEM,
            user: userPrompt(text),
          });
          return { slug: p.slug, phrases: r.phrases };
        } catch (e) {
          console.error(`  ${p.slug}: ${(e as Error).message}`);
          return { slug: p.slug, phrases: [] };
        }
      }),
    );
    results.push(...batchResults);
    console.log(`  [${Math.min(i + PARALLEL, usable.length)}/${usable.length}]`);
  }

  writeFileSync(OUT, JSON.stringify(results, null, 2));
  const totalPhrases = results.reduce((n, r) => n + r.phrases.length, 0);
  console.log(`wrote ${OUT}: ${results.length} profiles, ${totalPhrases} raw phrases`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
