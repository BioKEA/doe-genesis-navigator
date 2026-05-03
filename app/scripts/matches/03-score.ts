// app/scripts/matches/03-score.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClaude } from "../concepts/lib/claude";
import { loadParsedProfiles } from "../concepts/lib/profiles";
import type { CandidatePair } from "./lib/candidates";
import type { Profile } from "../../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const CACHE_DIR = resolve(BUILD_DIR, "llm-cache/score");
const IN = resolve(BUILD_DIR, "candidates.json");
const OUT = resolve(BUILD_DIR, "scored-matches.json");

const NOISE_FLOOR = 0.5;

const SYSTEM = `You judge whether one research-consortium partner's stated \
OFFER plausibly satisfies another partner's stated SEEK. Be strict — score \
high only when the match is concrete and substantive. Return ONLY JSON: \
{"score": <0.0-1.0>, "rationale": "<one sentence explaining the fit>"}.`;

function userPrompt(fromName: string, fromOffer: string, toName: string, toSeek: string, sharedConcepts: string[]): string {
  return `Partner A (${fromName}) offers:\n${fromOffer.trim()}\n\n` +
    `Partner B (${toName}) seeks:\n${toSeek.trim()}\n\n` +
    `Shared concepts: ${sharedConcepts.join(", ")}\n\n` +
    `Would A's offer plausibly satisfy B's seek? Return JSON.`;
}

interface ScoredMatch {
  from: string;
  to: string;
  score: number;
  rationale: string;
  sharedConcepts: string[];
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  mkdirSync(CACHE_DIR, { recursive: true });
  const claude = createClaude({ apiKey, cacheDir: CACHE_DIR });

  const candidates = JSON.parse(readFileSync(IN, "utf8")) as CandidatePair[];
  const profiles = loadParsedProfiles();
  const bySlug = new Map(profiles.map((p) => [p.slug, p] as const));

  console.log(`scoring ${candidates.length} candidates (parallelism=20, drops below ${NOISE_FLOOR})…`);

  const results: ScoredMatch[] = [];
  let dropped = 0;
  const PARALLEL = 20;
  for (let i = 0; i < candidates.length; i += PARALLEL) {
    const batch = candidates.slice(i, i + PARALLEL);
    const batchResults = await Promise.all(
      batch.map(async (c): Promise<ScoredMatch | null> => {
        const from = bySlug.get(c.from) as Profile | undefined;
        const to = bySlug.get(c.to) as Profile | undefined;
        if (!from?.offerings?.text || !to?.seeking?.text) return null;
        try {
          const r = await claude.askJson<{ score: number; rationale: string }>({
            system: SYSTEM,
            user: userPrompt(from.name, from.offerings.text, to.name, to.seeking.text, c.sharedConcepts),
          });
          if (typeof r.score !== "number" || r.score < NOISE_FLOOR) return null;
          return {
            from: c.from,
            to: c.to,
            score: r.score,
            rationale: r.rationale ?? "",
            sharedConcepts: c.sharedConcepts,
          };
        } catch (e) {
          console.error(`  ${c.from} → ${c.to}: ${(e as Error).message}`);
          return null;
        }
      }),
    );
    for (const r of batchResults) {
      if (r === null) dropped++;
      else results.push(r);
    }
    if ((i / PARALLEL) % 25 === 0 || i + PARALLEL >= candidates.length) {
      console.log(`  [${Math.min(i + PARALLEL, candidates.length)}/${candidates.length}] kept=${results.length} dropped=${dropped}`);
    }
  }

  writeFileSync(OUT, JSON.stringify(results));
  console.log(`wrote ${OUT}: ${results.length} scored matches (dropped ${dropped} below ${NOISE_FLOOR})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
