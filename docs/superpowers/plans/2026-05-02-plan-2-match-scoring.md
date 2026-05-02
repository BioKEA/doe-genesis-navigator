# Plan 2 — Match Scoring Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one committed JSON artifact — `app/data-source/matches.json` — containing scored, directional offer→seek matches between profiles, each with an LLM-generated rationale and a reciprocity flag. This is the data layer that powers the C overlay (offer→seek match edges) in the Canvas UI from Plan 3.

**Architecture:** Four-step offline pipeline: (0) per-field re-tagging splits each profile's combined `conceptIds` into `offer` and `seek` subsets so the candidate filter can be precise; (1) generate ordered (A, B) candidate pairs where A.offer ∩ B.seek is non-empty; (2) Haiku scores each candidate with a 1-sentence rationale, cached; (3) finalize — sort, drop noise (<0.5), detect reciprocity. The runtime applies top-K-per-partner at render time so the slider in the Canvas UI doesn't require a rebuild.

**Tech Stack:** Reuses Plan 1's pipeline scaffolding — `@anthropic-ai/sdk` (Claude Haiku), the SHA-keyed `cache.ts`, and the `claude.ts` JSON wrapper. New dependencies: none.

**Spec reference:** `docs/superpowers/specs/2026-05-02-knowledge-graph-redesign-design.md` § 7.

**Cost / time estimate:** ~$10–30 in Haiku calls (~$5 for per-field retag, ~$5–25 for candidate scoring depending on overlap density), ~10–15 min wall clock end-to-end. Well within the $100 user-set ceiling.

---

## Decision recorded during brainstorming

The original spec assumed offer-side and seek-side concept tags as inputs, but Plan 1 produced unified per-profile tags from all four text fields combined. Adding a per-field re-tagging step at the start of Plan 2 (Task 2 below) restores the spec's intended filter shape with a small one-time cost (~$5).

---

## File structure

**Created:**
```
app/
├── data-source/
│   ├── profile-field-concepts.json    (NEW — committed; from Task 2)
│   └── matches.json                    (NEW — committed; from Task 6)
├── build/
│   ├── candidates.json                 (intermediate, gitignored, from Task 4)
│   └── llm-cache/
│       ├── retag-fields/               (Task 2)
│       └── score/                      (Task 5)
├── scripts/
│   └── matches/                        (NEW directory)
│       ├── lib/
│       │   ├── candidates.ts            (pure: build candidate pairs)
│       │   ├── finalize.ts              (pure: sort + reciprocity + noise floor)
│       │   └── matches-merge.ts         (pure: merge matches into network for parse)
│       ├── 01-retag-fields.ts           (orchestrator — paid)
│       ├── 02-candidates.ts             (orchestrator — free)
│       ├── 03-score.ts                  (orchestrator — paid)
│       └── 04-finalize.ts               (orchestrator — free)
└── tests/
    └── matches/
        ├── candidates.test.ts
        ├── finalize.test.ts
        └── matches-merge.test.ts
```

**Modified:**
- `app/scripts/parse.ts` — load and write `matches.json` to public/data/.
- `app/src/types.ts` — add `Match` and `ProfileFieldConcepts` types.
- `app/package.json` — add 5 new npm scripts.
- `app/README.md` — extend the "Concept extraction pipeline" section with the matches workflow.

---

## Task 1: Shared types

**Files:**
- Modify: `app/src/types.ts`
- Modify: `app/scripts/concepts/lib/types.ts` (re-export the new shapes for pipeline use)

- [ ] **Step 1: Add Match types to `app/src/types.ts`**

Append to the end of the file (after the existing `ProfileConceptMap` type):

```ts

// --- Match layer (Plan 2 of the knowledge-graph redesign) ---

export interface ProfileFieldConcepts {
  offer: ConceptId[];
  seek: ConceptId[];
}

export type ProfileFieldConceptsMap = Record<string /* slug */, ProfileFieldConcepts>;

export interface Match {
  from: string;          // source partner slug — A's offer feeds this match
  to: string;            // target partner slug — B's seek feeds this match
  score: number;         // 0.5..1.0 (rows below 0.5 are dropped)
  rationale: string;     // one-sentence explanation
  sharedConcepts: ConceptId[];
  reciprocal: boolean;   // true iff the (to → from) reverse direction also kept
}
```

- [ ] **Step 2: Re-export from `app/scripts/concepts/lib/types.ts`**

Append to the end of that file:

```ts

// Match types — re-exported for pipeline scripts to consume
// (canonical definitions live in app/src/types.ts)
export type { Match, ProfileFieldConcepts, ProfileFieldConceptsMap } from "../../../src/types";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd app && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/types.ts app/scripts/concepts/lib/types.ts
git commit -m "feat(matches): shared types for the match scoring pipeline"
```

---

## Task 2: Per-field re-tagging script (paid, ~$5)

For each profile, two Haiku calls — one filtering the profile's existing `conceptIds` to those supported by the **offer** text, another to the **seek** text. The constrained prompt (offer/seek subset of already-assigned concepts) keeps results consistent with Plan 1's tagging.

**Files:**
- Create: `app/scripts/matches/01-retag-fields.ts`
- Modify: `app/package.json` (add `matches:retag-fields` script)

- [ ] **Step 1: Create `app/scripts/matches/01-retag-fields.ts`**

```ts
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
```

- [ ] **Step 2: Add npm script**

In `app/package.json`, add (after `concepts:retag`):

```json
    "matches:retag-fields": "tsx --env-file=.env scripts/matches/01-retag-fields.ts",
```

- [ ] **Step 3: Run it**

```bash
cd app && npm run matches:retag-fields
```

Expected: ~5–8 min wall clock, ~$5 in Haiku, output `wrote .../profile-field-concepts.json: ~470 profiles, ~2500-4000 offer tags, ~2000-3500 seek tags`.

- [ ] **Step 4: Sanity check**

```bash
node -e "
const m = require('./app/data-source/profile-field-concepts.json');
const b = m['biokea'];
console.log('biokea offer:', b?.offer);
console.log('biokea seek:', b?.seek);
const sizes = Object.values(m).map(fc => fc.offer.length + fc.seek.length).sort((a,b)=>a-b);
console.log('per-profile total tags — min:', sizes[0], 'median:', sizes[Math.floor(sizes.length/2)], 'max:', sizes[sizes.length-1]);
"
```

Expected: BioKEA's offer and seek arrays are non-empty and look semantically right (offers should overlap with their stated capabilities; seeks with their stated needs). Median ~5–10 total tags per profile.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/matches/01-retag-fields.ts app/package.json app/data-source/profile-field-concepts.json
git commit -m "feat(matches): per-field concept re-tagging (offer / seek splits)"
```

---

## Task 3: Candidates generator (TDD)

Pure function: given the field-concepts map, emit ordered (from, to) pairs where `from.offer` ∩ `to.seek` is non-empty. Skip self-pairs. Each pair carries `sharedConcepts`.

**Files:**
- Create: `app/scripts/matches/lib/candidates.ts`
- Create: `app/tests/matches/candidates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/matches/candidates.test.ts
import { describe, expect, it } from "vitest";
import { buildCandidatePairs } from "../../scripts/matches/lib/candidates";
import type { ProfileFieldConceptsMap } from "../../src/types";

describe("buildCandidatePairs", () => {
  it("emits ordered pairs where from.offer overlaps to.seek", () => {
    const fc: ProfileFieldConceptsMap = {
      a: { offer: ["x", "y"], seek: ["z"] },
      b: { offer: ["z"], seek: ["x"] },
      c: { offer: [], seek: ["y", "x"] },
    };
    const pairs = buildCandidatePairs(fc).sort((p, q) =>
      p.from.localeCompare(q.from) || p.to.localeCompare(q.to),
    );
    // a.offer={x,y} → b.seek={x} : shared=[x]
    // a.offer={x,y} → c.seek={y,x} : shared=[x,y] (any order)
    // b.offer={z} → a.seek={z} : shared=[z]
    // c.offer={} → no candidates
    expect(pairs).toHaveLength(3);
    expect(pairs[0]).toEqual({ from: "a", to: "b", sharedConcepts: ["x"] });
    expect(pairs[1].from).toBe("a");
    expect(pairs[1].to).toBe("c");
    expect(pairs[1].sharedConcepts.sort()).toEqual(["x", "y"]);
    expect(pairs[2]).toEqual({ from: "b", to: "a", sharedConcepts: ["z"] });
  });

  it("skips self-pairs even when offer intersects own seek", () => {
    const fc: ProfileFieldConceptsMap = {
      a: { offer: ["x"], seek: ["x"] },
    };
    expect(buildCandidatePairs(fc)).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(buildCandidatePairs({})).toEqual([]);
  });

  it("emits no pair when no overlap exists", () => {
    const fc: ProfileFieldConceptsMap = {
      a: { offer: ["x"], seek: ["y"] },
      b: { offer: ["z"], seek: ["w"] },
    };
    expect(buildCandidatePairs(fc)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
cd app && npx vitest run tests/matches/candidates.test.ts
```

Expected: FAIL — `Cannot find module '.../lib/candidates'`.

- [ ] **Step 3: Implement**

```ts
// app/scripts/matches/lib/candidates.ts
import type { ProfileFieldConceptsMap } from "../../../src/types";

export interface CandidatePair {
  from: string;
  to: string;
  sharedConcepts: string[];
}

export function buildCandidatePairs(
  fc: ProfileFieldConceptsMap,
): CandidatePair[] {
  const slugs = Object.keys(fc);
  const out: CandidatePair[] = [];
  for (const from of slugs) {
    const offerSet = new Set(fc[from].offer);
    if (offerSet.size === 0) continue;
    for (const to of slugs) {
      if (to === from) continue;
      const seek = fc[to].seek;
      const shared: string[] = [];
      for (const id of seek) {
        if (offerSet.has(id)) shared.push(id);
      }
      if (shared.length > 0) {
        out.push({ from, to, sharedConcepts: shared });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd app && npx vitest run tests/matches/candidates.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Create the test directory placeholder if needed**

```bash
mkdir -p app/tests/matches && touch app/tests/matches/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
git add app/scripts/matches/lib/candidates.ts app/tests/matches/candidates.test.ts app/tests/matches/.gitkeep
git commit -m "feat(matches): pure candidate-pair builder (offer ∩ seek)"
```

---

## Task 4: Candidates orchestrator script

Reads `profile-field-concepts.json`, calls `buildCandidatePairs`, writes `app/build/candidates.json`. No API calls.

**Files:**
- Create: `app/scripts/matches/02-candidates.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Write the script**

```ts
// app/scripts/matches/02-candidates.ts
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
```

- [ ] **Step 2: Add npm script**

In `app/package.json`, after `matches:retag-fields`:

```json
    "matches:candidates": "tsx scripts/matches/02-candidates.ts",
```

- [ ] **Step 3: Run it**

```bash
cd app && npm run matches:candidates
```

Expected: ~1–2 sec, output `wrote .../candidates.json: <N> candidate pairs`. The number N (typically 5k–30k) determines the cost of Task 5. **If N > 30,000, stop and discuss before running Task 5** — the scoring step at $0.005/call would exceed budget. Options at that point: tighten the per-field re-tag prompt to be more selective, or add a `min-shared-concepts` filter (e.g. require ≥2).

- [ ] **Step 4: Commit**

```bash
git add app/scripts/matches/02-candidates.ts app/package.json
git commit -m "feat(matches): script 02 — generate candidate pairs from field concepts"
```

---

## Task 5: Score script (paid, ~$5–25)

For each candidate, one Haiku call asking whether A's offer plausibly satisfies B's seek; returns score + rationale; cached. Drops `score < 0.5` rows at write time.

**Files:**
- Create: `app/scripts/matches/03-score.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Write the script**

```ts
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
```

- [ ] **Step 2: Add npm script**

```json
    "matches:score": "tsx --env-file=.env scripts/matches/03-score.ts",
```

- [ ] **Step 3: Run it**

```bash
cd app && npm run matches:score
```

Expected: ~5–15 min wall clock depending on candidate count. ~50–70% of candidates typically clear the 0.5 noise floor. Output `wrote .../scored-matches.json: <K> scored matches (dropped <D> below 0.5)`.

- [ ] **Step 4: Sanity check a few rows**

```bash
node -e "
const r = require('./app/build/scored-matches.json');
console.log('total scored matches:', r.length);
console.log('score distribution:');
const buckets = {'>=0.9': 0, '0.8-0.9': 0, '0.7-0.8': 0, '0.6-0.7': 0, '0.5-0.6': 0};
for (const m of r) {
  if (m.score >= 0.9) buckets['>=0.9']++;
  else if (m.score >= 0.8) buckets['0.8-0.9']++;
  else if (m.score >= 0.7) buckets['0.7-0.8']++;
  else if (m.score >= 0.6) buckets['0.6-0.7']++;
  else buckets['0.5-0.6']++;
}
for (const [k, v] of Object.entries(buckets)) console.log(' ', k, ':', v);
console.log('\\nbiokea outgoing (top 5):');
const out = r.filter(m => m.from === 'biokea').sort((a,b)=>b.score-a.score).slice(0, 5);
for (const m of out) console.log(' ', m.score.toFixed(2), '→', m.to, ':', m.rationale.slice(0, 100));
"
```

Expected: bell-shaped score distribution with bulk in 0.6–0.8, plus a tail above 0.9. The biokea outgoing matches should look semantically reasonable (target slugs like microsoft, snowflake, argonne for capability-rich orgs).

- [ ] **Step 5: Commit**

```bash
git add app/scripts/matches/03-score.ts app/package.json
git commit -m "feat(matches): script 03 — Haiku-scored offer→seek matches with rationale"
```

---

## Task 6: Finalize — sort + reciprocity (TDD)

Pure function takes `ScoredMatch[]`, returns `Match[]` sorted by `from` then `score` desc, with `reciprocal: true` for any pair where both directions survived.

**Files:**
- Create: `app/scripts/matches/lib/finalize.ts`
- Create: `app/tests/matches/finalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/matches/finalize.test.ts
import { describe, expect, it } from "vitest";
import { finalizeMatches } from "../../scripts/matches/lib/finalize";

describe("finalizeMatches", () => {
  it("sorts by from then score desc and detects reciprocity", () => {
    const scored = [
      { from: "a", to: "b", score: 0.9, rationale: "ab", sharedConcepts: ["x"] },
      { from: "b", to: "a", score: 0.8, rationale: "ba", sharedConcepts: ["y"] },
      { from: "a", to: "c", score: 0.6, rationale: "ac", sharedConcepts: ["z"] },
      { from: "a", to: "d", score: 0.7, rationale: "ad", sharedConcepts: ["w"] },
    ];
    const out = finalizeMatches(scored);
    // sorted: a→b (0.9), a→d (0.7), a→c (0.6), b→a (0.8)
    expect(out.map((m) => `${m.from}-${m.to}`)).toEqual(["a-b", "a-d", "a-c", "b-a"]);
    // a→b and b→a are both present → both reciprocal
    expect(out.find((m) => m.from === "a" && m.to === "b")!.reciprocal).toBe(true);
    expect(out.find((m) => m.from === "b" && m.to === "a")!.reciprocal).toBe(true);
    // a→d has no d→a → not reciprocal
    expect(out.find((m) => m.from === "a" && m.to === "d")!.reciprocal).toBe(false);
  });

  it("handles empty input", () => {
    expect(finalizeMatches([])).toEqual([]);
  });

  it("a single direction is never reciprocal", () => {
    const out = finalizeMatches([
      { from: "a", to: "b", score: 0.9, rationale: "ab", sharedConcepts: ["x"] },
    ]);
    expect(out[0].reciprocal).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
cd app && npx vitest run tests/matches/finalize.test.ts
```

Expected: FAIL — `Cannot find module '.../finalize'`.

- [ ] **Step 3: Implement**

```ts
// app/scripts/matches/lib/finalize.ts
import type { Match } from "../../../src/types";

interface ScoredMatch {
  from: string;
  to: string;
  score: number;
  rationale: string;
  sharedConcepts: string[];
}

export function finalizeMatches(scored: ScoredMatch[]): Match[] {
  // Build a set of direction keys for O(1) reciprocity lookup
  const present = new Set<string>();
  for (const m of scored) present.add(`${m.from}::${m.to}`);

  const out: Match[] = scored.map((m) => ({
    from: m.from,
    to: m.to,
    score: m.score,
    rationale: m.rationale,
    sharedConcepts: m.sharedConcepts,
    reciprocal: present.has(`${m.to}::${m.from}`),
  }));

  out.sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    return b.score - a.score;
  });

  return out;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd app && npx vitest run tests/matches/finalize.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/matches/lib/finalize.ts app/tests/matches/finalize.test.ts
git commit -m "feat(matches): finalize step — sort by from/score, mark reciprocal"
```

---

## Task 7: Finalize orchestrator script

Reads `build/scored-matches.json`, calls `finalizeMatches`, writes `app/data-source/matches.json`.

**Files:**
- Create: `app/scripts/matches/04-finalize.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Write the script**

```ts
// app/scripts/matches/04-finalize.ts
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
```

- [ ] **Step 2: Add npm script**

```json
    "matches:finalize": "tsx scripts/matches/04-finalize.ts",
```

- [ ] **Step 3: Run it**

```bash
cd app && npm run matches:finalize
```

Expected: <1 sec, output `wrote .../matches.json: <K> matches, <R> reciprocal (~10–25%)`.

- [ ] **Step 4: Commit (script + final committed artifact)**

```bash
git add app/scripts/matches/04-finalize.ts app/package.json app/data-source/matches.json
git commit -m "feat(matches): finalize script and committed matches.json artifact"
```

---

## Task 8: Wire matches into parse output (TDD)

The runtime needs `matches.json` in `app/public/data/` to consume. Mirror Plan 1's pattern: copy `data-source/matches.json` to `public/data/` during `npm run parse`.

**Files:**
- Create: `app/scripts/matches/lib/matches-merge.ts`
- Create: `app/tests/matches/matches-merge.test.ts`
- Modify: `app/scripts/parse.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/matches/matches-merge.test.ts
import { describe, expect, it } from "vitest";
import { topKMatchesPerPartner } from "../../scripts/matches/lib/matches-merge";
import type { Match } from "../../src/types";

const m = (from: string, to: string, score: number): Match => ({
  from, to, score, rationale: "", sharedConcepts: [], reciprocal: false,
});

describe("topKMatchesPerPartner", () => {
  it("keeps top-K outgoing per from, preserving overall sort order", () => {
    const matches = [
      m("a", "x", 0.9), m("a", "y", 0.8), m("a", "z", 0.7), m("a", "w", 0.6),
      m("b", "x", 0.85),
    ];
    const out = topKMatchesPerPartner(matches, 2);
    const fromA = out.filter((x) => x.from === "a");
    const fromB = out.filter((x) => x.from === "b");
    expect(fromA).toHaveLength(2);
    expect(fromA.map((x) => x.to)).toEqual(["x", "y"]);
    expect(fromB).toHaveLength(1);
  });

  it("returns input unchanged when K is larger than any per-from group", () => {
    const matches = [m("a", "x", 0.9), m("a", "y", 0.8)];
    expect(topKMatchesPerPartner(matches, 10)).toEqual(matches);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
cd app && npx vitest run tests/matches/matches-merge.test.ts
```

Expected: FAIL — `Cannot find module '.../matches-merge'`.

- [ ] **Step 3: Implement**

```ts
// app/scripts/matches/lib/matches-merge.ts
import type { Match } from "../../../src/types";

/**
 * Returns matches keeping only the top-K outgoing per `from`. Input must
 * already be sorted by from then score desc (the shape produced by
 * finalizeMatches). Output preserves that order.
 *
 * The runtime app slices on a render-time slider, so the data layer doesn't
 * need to apply this — but parse.ts uses it to produce a smaller `matches.json`
 * in public/data/ when the full set would exceed the bundle budget.
 */
export function topKMatchesPerPartner(matches: Match[], k: number): Match[] {
  const out: Match[] = [];
  let lastFrom: string | null = null;
  let countForCurrent = 0;
  for (const m of matches) {
    if (m.from !== lastFrom) {
      lastFrom = m.from;
      countForCurrent = 0;
    }
    if (countForCurrent < k) {
      out.push(m);
      countForCurrent++;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd app && npx vitest run tests/matches/matches-merge.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Wire into `parse.ts`**

Open `app/scripts/parse.ts`. Add to the import block (after the existing concepts merge import):

```ts
import { topKMatchesPerPartner } from "./matches/lib/matches-merge";
import type { Match } from "../src/types";
```

Locate the existing concept-merge block (the `if (existsSync(CONCEPTS_PATH)...)` block). Add the matches handling immediately *after* that block, still before the `topNeighbors` line:

```ts
  // Merge match layer if available (Plan 2 of the knowledge-graph redesign)
  const MATCHES_PATH = resolve(__dirname, "../data-source/matches.json");
  if (existsSync(MATCHES_PATH)) {
    const matches = JSON.parse(readFileSync(MATCHES_PATH, "utf8")) as Match[];
    // Cap to top-20 per partner for shipping (runtime slider goes 3-20).
    const trimmed = topKMatchesPerPartner(matches, 20);
    writeFileSync(join(OUT_DIR, "matches.json"), JSON.stringify(trimmed));
    console.log(
      `merged ${matches.length} matches → ${trimmed.length} after top-20 cap`,
    );
  } else {
    console.log("no matches.json found — skipping match merge (run npm run matches first)");
  }
```

- [ ] **Step 6: Run parse and verify**

```bash
cd app && npm run parse
```

Expected logs:
```
merged 126 concepts, tagged 486 profiles
merged <K> matches → <K'> after top-20 cap
parsed 486 profiles, 99275 edges, 0 errors
```

```bash
node -e "
const m = require('./app/public/data/matches.json');
console.log('matches in public/data:', m.length);
console.log('biokea outgoing:', m.filter(x => x.from === 'biokea').length, '(should be ≤20)');
"
```

Expected: total count is positive; biokea outgoing ≤ 20.

- [ ] **Step 7: Commit**

```bash
git add app/scripts/matches/lib/matches-merge.ts app/tests/matches/matches-merge.test.ts app/scripts/parse.ts
git commit -m "feat(matches): top-K trim + parse-step copy of matches.json to public/data"
```

---

## Task 9: Convenience `matches` script + README

Adds a single `npm run matches` that chains the four matches steps in order, and documents the workflow.

**Files:**
- Modify: `app/package.json`
- Modify: `app/README.md`

- [ ] **Step 1: Add chained script to `package.json`**

After the existing `matches:finalize` line:

```json
    "matches": "npm run matches:retag-fields && npm run matches:candidates && npm run matches:score && npm run matches:finalize",
```

- [ ] **Step 2: Extend README**

In `app/README.md`, find the existing concept-pipeline section (the one starting `## Concept extraction pipeline`). After its final line (just before `## Deploy to Vercel`), insert:

````markdown

## Match scoring pipeline (one-shot, offline)

Once the concept layer is in place (above), this pipeline produces directional
offer→seek match edges with rationales — the data layer for the C overlay in
the Canvas UI.

```bash
# 1. Run the full chain (retag fields → candidates → score → finalize)
npm run matches                     # ~10-15 min, ~$10-25 in Haiku

# 2. Commit the artifacts
git add app/data-source/profile-field-concepts.json \
        app/data-source/matches.json
git commit -m "data(matches): refresh match layer"
```

Same caching + idempotency story as the concepts pipeline (`app/build/llm-cache/`
keyed by input SHA, gitignored).

`npm run parse` picks up `matches.json` automatically and copies a top-20-per-partner
trimmed version to `app/public/data/` for the runtime to consume. Vercel's build
never needs `ANTHROPIC_API_KEY`.
````

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/README.md
git commit -m "docs(matches): chained pipeline script and README workflow"
```

---

## Task 10: Verify build still works end-to-end

**Files:** none

- [ ] **Step 1: Clean rebuild**

```bash
cd app && rm -rf dist public/data && npm run build 2>&1 | tail -20
```

Expected: parse logs both "merged 126 concepts" and "merged <K> matches → <K'> after top-20 cap"; tsc + vite build succeed.

- [ ] **Step 2: Verify shipped data**

```bash
ls -la dist/data/ | grep -E "(concepts|matches|profiles|network|search)"
```

Expected: `concepts.json`, `matches.json`, `profiles.json`, `network.json`, `search.json` all present.

- [ ] **Step 3: Run full test suite**

```bash
cd app && npm test
```

Expected: all existing tests + 4 new matches tests (candidates × 4, finalize × 3, matches-merge × 2) pass.

- [ ] **Step 4: No commit needed** if everything passed.

---

## Definition of Done for Plan 2

- `npm run matches` runs the four-step chain end-to-end without errors.
- `app/data-source/profile-field-concepts.json` and `app/data-source/matches.json` are committed to git.
- `npm run parse` writes a top-20-trimmed `matches.json` to `app/public/data/`.
- `npm test` passes including 3 new test files in `app/tests/matches/`.
- `npm run build` succeeds without `ANTHROPIC_API_KEY` set.
- Spot-check biokea's top outgoing matches and confirm they look semantically right.
- Plan 3 (Canvas UI) can proceed using `data-source/matches.json` as input.
