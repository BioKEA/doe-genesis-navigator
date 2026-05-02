# Plan 1 — Concept Extraction Pipeline + Curation UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce two committed JSON artifacts — `app/data-source/concepts.json` (curated canonical concept layer with parent categories) and `app/data-source/profile-concepts.json` (slug → concept_ids[]) — via a one-shot offline pipeline. These are the foundation that Plans 2 (matches) and 3 (canvas UI) will consume.

**Architecture:** Six-step pipeline run from `app/scripts/concepts/` — (1) LLM extract raw phrases per profile, (2) embed locally, (3) cluster, (4) LLM label + propose categories, (5) human curation via local-only Node http server with HTML+vanilla-JS UI, (6) LLM re-tag profiles using the curated vocabulary. Intermediate artifacts live in `app/build/` (gitignored). Final outputs live in `app/data-source/` (committed). The existing `npm run parse` is extended to copy these into `app/public/data/`. No runtime LLM calls.

**Tech Stack:** TypeScript / `tsx` (existing), `@anthropic-ai/sdk` (Claude Haiku for extract/label/retag), `@xenova/transformers` (local sentence-transformers embeddings, no API), `density-clustering` (HDBSCAN), Node `node:http` (curation server, no Express). Vitest for deterministic-layer tests.

**Spec reference:** `docs/superpowers/specs/2026-05-02-knowledge-graph-redesign-design.md` § 6.

---

## File structure

**Created:**
```
app/
├── data-source/                          (NEW directory — committed)
│   ├── concepts.json                       (final, after curation)
│   └── profile-concepts.json               (final, after retag)
├── build/                                (NEW directory — gitignored)
│   ├── llm-cache/                          (LLM response cache, gitignored)
│   ├── raw-concepts.json
│   ├── concept-vectors.json
│   ├── clusters.json
│   └── concept-candidates.json
├── scripts/
│   └── concepts/
│       ├── lib/
│       │   ├── types.ts
│       │   ├── cache.ts
│       │   ├── claude.ts
│       │   ├── profiles.ts
│       │   ├── embed.ts
│       │   ├── cluster.ts
│       │   └── merge.ts                    (parse-step merge helper)
│       ├── 01-extract.ts
│       ├── 02-embed.ts
│       ├── 03-cluster.ts
│       ├── 04-label.ts
│       ├── 05-retag.ts
│       ├── curate.ts                       (Node http server)
│       └── curate.html                     (the UI page)
└── tests/
    └── concepts/
        ├── cache.test.ts
        ├── cluster.test.ts
        ├── merge.test.ts
        ├── profiles.test.ts
        └── claude.test.ts
```

**Modified:**
- `app/scripts/parse.ts` — load and merge `data-source/concepts.json` + `data-source/profile-concepts.json` into the public output.
- `app/src/types.ts` — add `Concept`, `ConceptCategory` types and extend `Profile` with `conceptIds?: string[]`.
- `app/package.json` — add deps + 7 new npm scripts.
- `.gitignore` — add `app/build/`.
- `.env.example` (create if missing) — document `ANTHROPIC_API_KEY`.
- `app/README.md` — document the one-shot pipeline.

---

## Task 1: Setup — install deps, scaffold dirs, gitignore

**Files:**
- Modify: `app/package.json`
- Modify: `.gitignore`
- Create: `app/.env.example`
- Create: `app/data-source/.gitkeep`
- Create: `app/scripts/concepts/lib/.gitkeep`
- Create: `app/tests/concepts/.gitkeep`

- [ ] **Step 1: Install build-time deps**

```bash
cd app && npm install --save-dev @anthropic-ai/sdk @xenova/transformers density-clustering
npm install --save-dev @types/density-clustering
```

Expected: `package.json` and `package-lock.json` updated. The `@xenova/transformers` install is ~25MB.

- [ ] **Step 2: Create directories with .gitkeep placeholders**

```bash
cd .. # back to repo root
mkdir -p app/data-source app/scripts/concepts/lib app/tests/concepts
touch app/data-source/.gitkeep app/scripts/concepts/lib/.gitkeep app/tests/concepts/.gitkeep
```

- [ ] **Step 3: Add `app/build/` to `.gitignore`**

Edit `.gitignore`. After the existing `app/dist/` line, add:

```
app/build/
```

- [ ] **Step 4: Create `app/.env.example`**

Write `app/.env.example`:

```
# Required for the one-shot concept extraction pipeline (npm run concepts).
# Not needed at production build time.
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json .gitignore app/.env.example app/data-source/.gitkeep app/scripts/concepts/lib/.gitkeep app/tests/concepts/.gitkeep
git commit -m "feat(concepts): scaffold pipeline directories and install build-time deps"
```

---

## Task 2: Shared types

**Files:**
- Create: `app/scripts/concepts/lib/types.ts`
- Modify: `app/src/types.ts`

- [ ] **Step 1: Create `app/scripts/concepts/lib/types.ts`**

```ts
// Shared types for the concept extraction pipeline.
// Final shapes (Concept, ProfileConceptMap) are also exported from
// app/src/types.ts so the runtime app can consume them.

export type ConceptId = string;            // e.g. "biomarker-discovery"
export type CategoryId = string;           // e.g. "bio-health"

export interface RawConceptResponse {
  slug: string;                            // partner slug
  phrases: string[];                       // 5-15 short phrases from one Haiku call
}

export interface ConceptVector {
  phrase: string;                          // unique phrase across the corpus
  embedding: number[];                     // sentence-transformers vector
}

export interface ClusterResult {
  clusterId: number;                       // -1 = noise
  members: string[];                       // raw phrases in this cluster
}

export interface ConceptCandidate {
  clusterId: number;
  suggestedLabel: string;                  // canonical short name from Haiku
  suggestedCategory: CategoryId;           // one of the LLM-proposed categories
  members: string[];                       // raw phrases in this cluster
}

export interface CategoryProposal {
  id: CategoryId;
  label: string;                           // human-friendly name
}

// Final committed shapes — also re-exported from app/src/types.ts

export interface Concept {
  id: ConceptId;
  label: string;                           // canonical short name (post-curation)
  categoryId: CategoryId;
  memberPhrases: string[];                 // for debugging / search index
}

export interface ConceptCategory {
  id: CategoryId;
  label: string;
}

export interface ConceptsArtifact {
  generatedAt: string;                     // ISO timestamp
  categories: ConceptCategory[];
  concepts: Concept[];
}

export type ProfileConceptMap = Record<string /* slug */, ConceptId[]>;
```

- [ ] **Step 2: Re-export the runtime types from `app/src/types.ts`**

Open `app/src/types.ts`. After the existing `ChallengeArea` line at the end, append:

```ts

// --- Concept layer (Plan 1 of the knowledge-graph redesign) ---

export type ConceptId = string;
export type CategoryId = string;

export interface ConceptCategory {
  id: CategoryId;
  label: string;
}

export interface Concept {
  id: ConceptId;
  label: string;
  categoryId: CategoryId;
  memberPhrases: string[];
}

export interface ConceptsArtifact {
  generatedAt: string;
  categories: ConceptCategory[];
  concepts: Concept[];
}

export type ProfileConceptMap = Record<string, ConceptId[]>;
```

Also extend the existing `Profile` interface — add this line inside the `Profile` interface, just before `rawHtmlPath`:

```ts
  conceptIds?: ConceptId[];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd app && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/scripts/concepts/lib/types.ts app/src/types.ts
git commit -m "feat(concepts): shared types for the extraction pipeline"
```

---

## Task 3: Cache helper (TDD)

The cache key is a SHA-256 of the input string. Each cache entry is a single JSON file under `app/build/llm-cache/<hash>.json`. This makes runs idempotent — re-running the pipeline after a partial failure is free for already-completed inputs.

**Files:**
- Create: `app/scripts/concepts/lib/cache.ts`
- Create: `app/tests/concepts/cache.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/concepts/cache.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCache } from "../../scripts/concepts/lib/cache";

describe("cache", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cache-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null on miss, stores and returns on hit", async () => {
    const cache = createCache<{ value: number }>(dir);
    expect(await cache.get("input-a")).toBeNull();

    await cache.set("input-a", { value: 42 });
    expect(await cache.get("input-a")).toEqual({ value: 42 });
  });

  it("isolates entries by input string", async () => {
    const cache = createCache<{ v: string }>(dir);
    await cache.set("input-a", { v: "alpha" });
    await cache.set("input-b", { v: "beta" });
    expect(await cache.get("input-a")).toEqual({ v: "alpha" });
    expect(await cache.get("input-b")).toEqual({ v: "beta" });
  });

  it("survives a fresh cache instance over the same dir", async () => {
    const c1 = createCache<{ x: number }>(dir);
    await c1.set("k", { x: 7 });

    const c2 = createCache<{ x: number }>(dir);
    expect(await c2.get("k")).toEqual({ x: 7 });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
cd app && npx vitest run tests/concepts/cache.test.ts
```

Expected: FAIL — `Cannot find module './lib/cache'`.

- [ ] **Step 3: Implement `cache.ts`**

```ts
// app/scripts/concepts/lib/cache.ts
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface Cache<T> {
  get(input: string): Promise<T | null>;
  set(input: string, value: T): Promise<void>;
}

function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function createCache<T>(dir: string): Cache<T> {
  mkdirSync(dir, { recursive: true });

  return {
    async get(input) {
      const path = join(dir, `${hashKey(input)}.json`);
      if (!existsSync(path)) return null;
      return JSON.parse(readFileSync(path, "utf8")) as T;
    },
    async set(input, value) {
      const path = join(dir, `${hashKey(input)}.json`);
      writeFileSync(path, JSON.stringify(value));
    },
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
cd app && npx vitest run tests/concepts/cache.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/concepts/lib/cache.ts app/tests/concepts/cache.test.ts
git commit -m "feat(concepts): SHA-keyed JSON cache for LLM responses"
```

---

## Task 4: Profile loader (TDD)

Loads parsed profiles from `app/public/data/profiles.json` (output of the existing `npm run parse`) and yields the concept-source text per profile (the four fields concatenated).

**Files:**
- Create: `app/scripts/concepts/lib/profiles.ts`
- Create: `app/tests/concepts/profiles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/concepts/profiles.test.ts
import { describe, expect, it } from "vitest";
import { conceptSourceText } from "../../scripts/concepts/lib/profiles";
import type { Profile } from "../../src/types";

const baseProfile = (overrides: Partial<Profile> = {}): Profile => ({
  slug: "test-slug",
  name: "Test",
  kind: "organization",
  challengeAreas: [],
  partnerTypeSeeking: [],
  rawHtmlPath: "detail-pages/test-slug.html",
  ...overrides,
});

describe("conceptSourceText", () => {
  it("concatenates the four source fields with section markers", () => {
    const p = baseProfile({
      introduction: "We do science.",
      offerings: { text: "compute power", tags: [] },
      seeking: { text: "wet-lab partners", tags: [] },
      projectIdeaSummary: "AI for materials.",
    });
    const text = conceptSourceText(p);
    expect(text).toContain("INTRODUCTION:\nWe do science.");
    expect(text).toContain("OFFERS:\ncompute power");
    expect(text).toContain("SEEKS:\nwet-lab partners");
    expect(text).toContain("PROJECT IDEA:\nAI for materials.");
  });

  it("omits sections with empty / missing fields", () => {
    const p = baseProfile({ introduction: "Only intro." });
    const text = conceptSourceText(p);
    expect(text).toContain("INTRODUCTION:\nOnly intro.");
    expect(text).not.toContain("OFFERS:");
    expect(text).not.toContain("SEEKS:");
    expect(text).not.toContain("PROJECT IDEA:");
  });

  it("returns empty string when all four fields missing", () => {
    expect(conceptSourceText(baseProfile())).toBe("");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
cd app && npx vitest run tests/concepts/profiles.test.ts
```

Expected: FAIL — `Cannot find module './lib/profiles'`.

- [ ] **Step 3: Implement `profiles.ts`**

```ts
// app/scripts/concepts/lib/profiles.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { Profile } from "../../../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function conceptSourceText(p: Profile): string {
  const parts: string[] = [];
  const push = (label: string, text?: string) => {
    if (text && text.trim().length > 0) {
      parts.push(`${label}:\n${text.trim()}`);
    }
  };
  push("INTRODUCTION", p.introduction);
  push("OFFERS", p.offerings?.text);
  push("SEEKS", p.seeking?.text);
  push("PROJECT IDEA", p.projectIdeaSummary);
  return parts.join("\n\n");
}

export function loadParsedProfiles(): Profile[] {
  const path = resolve(__dirname, "../../../public/data/profiles.json");
  return JSON.parse(readFileSync(path, "utf8")) as Profile[];
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
cd app && npx vitest run tests/concepts/profiles.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/concepts/lib/profiles.ts app/tests/concepts/profiles.test.ts
git commit -m "feat(concepts): profile loader and concept-source-text helper"
```

---

## Task 5: Claude wrapper (TDD with mocks)

Wraps the Anthropic SDK with the cache from Task 3. The wrapper accepts a system prompt and a user prompt, calls Claude Haiku, parses the response as JSON (the prompt always asks for JSON), and persists the parsed result to the cache. On a cache hit, no API call is made.

**Files:**
- Create: `app/scripts/concepts/lib/claude.ts`
- Create: `app/tests/concepts/claude.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/concepts/claude.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class FakeAnthropic {
      messages = { create: createMessage };
    },
  };
});

import { createClaude } from "../../scripts/concepts/lib/claude";

describe("createClaude", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "claude-test-"));
    createMessage.mockReset();
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("calls Anthropic on cache miss, returns parsed JSON", async () => {
    createMessage.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"foo": "bar"}' }],
    });
    const claude = createClaude({ apiKey: "test", cacheDir: dir });
    const result = await claude.askJson<{ foo: string }>({
      system: "be helpful",
      user: "hi",
    });
    expect(result).toEqual({ foo: "bar" });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it("returns cached value on second call with same input", async () => {
    createMessage.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"n": 1}' }],
    });
    const claude = createClaude({ apiKey: "test", cacheDir: dir });
    await claude.askJson({ system: "s", user: "u" });
    const second = await claude.askJson({ system: "s", user: "u" });
    expect(second).toEqual({ n: 1 });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it("strips markdown code fences before parsing JSON", async () => {
    createMessage.mockResolvedValueOnce({
      content: [{ type: "text", text: "```json\n{\"a\": 1}\n```" }],
    });
    const claude = createClaude({ apiKey: "test", cacheDir: dir });
    expect(await claude.askJson({ system: "s", user: "u" })).toEqual({ a: 1 });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
cd app && npx vitest run tests/concepts/claude.test.ts
```

Expected: FAIL — `Cannot find module './lib/claude'`.

- [ ] **Step 3: Implement `claude.ts`**

```ts
// app/scripts/concepts/lib/claude.ts
import Anthropic from "@anthropic-ai/sdk";
import { createCache } from "./cache";

export interface ClaudeOptions {
  apiKey: string;
  cacheDir: string;
  model?: string;
}

export interface AskParams {
  system: string;
  user: string;
}

export interface Claude {
  askJson<T>(params: AskParams): Promise<T>;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function stripFences(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : text;
}

export function createClaude(opts: ClaudeOptions): Claude {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const cache = createCache<unknown>(opts.cacheDir);
  const model = opts.model ?? DEFAULT_MODEL;

  return {
    async askJson<T>(params: AskParams): Promise<T> {
      const cacheKey = JSON.stringify({ model, ...params });
      const cached = await cache.get(cacheKey);
      if (cached !== null) return cached as T;

      const resp = await client.messages.create({
        model,
        max_tokens: 1024,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
      });
      const block = resp.content[0];
      if (!block || block.type !== "text") {
        throw new Error(`Unexpected response shape: ${JSON.stringify(resp)}`);
      }
      const parsed = JSON.parse(stripFences(block.text)) as T;
      await cache.set(cacheKey, parsed);
      return parsed;
    },
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
cd app && npx vitest run tests/concepts/claude.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/concepts/lib/claude.ts app/tests/concepts/claude.test.ts
git commit -m "feat(concepts): cached Claude Haiku wrapper for JSON-shaped responses"
```

---

## Task 6: Script 01 — Extract raw concepts

Orchestrates the per-profile Haiku call. No new tests (it's a script orchestrator over already-tested pieces). After running, you visually inspect `app/build/raw-concepts.json`.

**Files:**
- Create: `app/scripts/concepts/01-extract.ts`

- [ ] **Step 1: Write the script**

```ts
// app/scripts/concepts/01-extract.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
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
  console.log(`extracting concepts from ${usable.length} profiles (skipped ${profiles.length - usable.length} empty)`);

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
```

- [ ] **Step 2: Add `concepts:extract` to `package.json` and dotenv loader**

Open `app/package.json`. In `"scripts"` add (after `"scrape"`):

```json
    "concepts:extract": "tsx --env-file=.env scripts/concepts/01-extract.ts",
```

(`--env-file` is built into Node ≥20 via `tsx`. No `dotenv` dependency needed.)

- [ ] **Step 3: Smoke test (real API call — incurs ~$2-3 in Haiku)**

Make sure `app/.env` exists with `ANTHROPIC_API_KEY=sk-ant-...` (copy from `.env.example`). Then:

```bash
cd app && npm run concepts:extract
```

Expected: `wrote .../raw-concepts.json: ~480 profiles, ~5000-7000 raw phrases`. Total wall clock ~3-5 minutes. If you need to re-run, deletions of `app/build/llm-cache/extract/` will force a full re-call; otherwise reruns are free.

Inspect a few entries in the output:

```bash
cat build/raw-concepts.json | head -40
```

Sanity check: phrases look like real concepts ("biomarker discovery", "DFT", "RNA-seq"), not garbage.

- [ ] **Step 4: Commit (script + package.json, NOT the build artifact)**

```bash
git add app/scripts/concepts/01-extract.ts app/package.json
git commit -m "feat(concepts): script 01 — extract raw concept phrases per profile"
```

---

## Task 7: Embed wrapper

Wraps `@xenova/transformers` to embed an array of strings locally. The first call downloads the model (~25MB, cached in `node_modules/@xenova/transformers/.cache`).

**Files:**
- Create: `app/scripts/concepts/lib/embed.ts`

- [ ] **Step 1: Implement the wrapper**

```ts
// app/scripts/concepts/lib/embed.ts
import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

let extractor: FeatureExtractionPipeline | null = null;

const MODEL = "Xenova/all-MiniLM-L6-v2"; // 384-dim, ~25MB, fast

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = (await pipeline("feature-extraction", MODEL)) as FeatureExtractionPipeline;
  }
  return extractor;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const ex = await getExtractor();
  const out: number[][] = [];
  for (const t of texts) {
    const tensor = await ex(t, { pooling: "mean", normalize: true });
    out.push(Array.from(tensor.data as Float32Array));
  }
  return out;
}

export const EMBED_DIM = 384;
```

- [ ] **Step 2: Smoke test in Node REPL (no Vitest needed — model download would slow tests)**

```bash
cd app && node --import tsx -e "import('./scripts/concepts/lib/embed.ts').then(async (m) => { const v = await m.embedTexts(['hello world', 'machine learning']); console.log(v.length, v[0].length); })"
```

Expected output (after 1-2 minutes for first-time model download): `2 384`.

- [ ] **Step 3: Commit**

```bash
git add app/scripts/concepts/lib/embed.ts
git commit -m "feat(concepts): local sentence-transformers embedding wrapper"
```

---

## Task 8: Script 02 — Embed unique phrases

Loads `raw-concepts.json`, dedupes phrases (lowercased, trimmed), embeds, writes `concept-vectors.json`.

**Files:**
- Create: `app/scripts/concepts/02-embed.ts`

- [ ] **Step 1: Write the script**

```ts
// app/scripts/concepts/02-embed.ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
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
```

- [ ] **Step 2: Add `concepts:embed` script to `package.json`**

Add (after `concepts:extract`):

```json
    "concepts:embed": "tsx scripts/concepts/02-embed.ts",
```

- [ ] **Step 3: Run it**

```bash
cd app && npm run concepts:embed
```

Expected: ~5-10 min wall clock (CPU-bound), output `wrote .../concept-vectors.json: ~3000-5000 vectors of dim 384`.

- [ ] **Step 4: Commit**

```bash
git add app/scripts/concepts/02-embed.ts app/package.json
git commit -m "feat(concepts): script 02 — embed unique phrases locally"
```

---

## Task 9: Cluster wrapper (TDD)

Wraps `density-clustering`'s DBSCAN (the npm package's HDBSCAN-equivalent). Returns clusters as `{ clusterId, members }`. Noise points get `clusterId: -1`.

(Note: the `density-clustering` npm package provides DBSCAN; HDBSCAN is not available in JS without WASM. DBSCAN with tuned eps gives equivalent results for our use case at this scale.)

**Files:**
- Create: `app/scripts/concepts/lib/cluster.ts`
- Create: `app/tests/concepts/cluster.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/concepts/cluster.test.ts
import { describe, expect, it } from "vitest";
import { dbscanCluster } from "../../scripts/concepts/lib/cluster";

describe("dbscanCluster", () => {
  it("groups close points and isolates far ones", () => {
    // Two tight clusters + one outlier in 2D
    const phrases = ["a1", "a2", "a3", "b1", "b2", "outlier"];
    const vectors = [
      [0.0, 0.0],
      [0.05, 0.0],
      [0.0, 0.05],
      [10.0, 10.0],
      [10.05, 10.0],
      [50.0, 50.0],
    ];
    const clusters = dbscanCluster(phrases, vectors, { eps: 0.2, minPoints: 2 });
    const byCluster = new Map<number, string[]>();
    for (const c of clusters) byCluster.set(c.clusterId, c.members);

    expect(byCluster.size).toBe(3); // 2 real + 1 noise
    const noise = byCluster.get(-1);
    expect(noise).toEqual(["outlier"]);

    const real = [...byCluster.entries()].filter(([id]) => id !== -1);
    expect(real).toHaveLength(2);
    expect(real.map(([, m]) => m.sort())).toEqual(
      expect.arrayContaining([
        ["a1", "a2", "a3"],
        ["b1", "b2"],
      ]),
    );
  });

  it("returns empty array for empty input", () => {
    expect(dbscanCluster([], [], { eps: 0.2, minPoints: 2 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
cd app && npx vitest run tests/concepts/cluster.test.ts
```

Expected: FAIL — `Cannot find module './lib/cluster'`.

- [ ] **Step 3: Implement `cluster.ts`**

```ts
// app/scripts/concepts/lib/cluster.ts
import pkg from "density-clustering";
import type { ClusterResult } from "./types";
const { DBSCAN } = pkg;

export interface ClusterOptions {
  eps: number;        // distance threshold (cosine ≈ 1 - similarity for normalized vectors)
  minPoints: number;  // min cluster size
}

export function dbscanCluster(
  phrases: string[],
  vectors: number[][],
  opts: ClusterOptions,
): ClusterResult[] {
  if (phrases.length === 0) return [];
  if (phrases.length !== vectors.length) {
    throw new Error(`phrases.length (${phrases.length}) !== vectors.length (${vectors.length})`);
  }

  const dbscan = new DBSCAN();
  // density-clustering uses Euclidean by default; for unit-normalized embeddings
  // Euclidean distance ≈ sqrt(2 * (1 - cosine_similarity)) so eps maps directly.
  const clusters: number[][] = dbscan.run(vectors, opts.eps, opts.minPoints);
  const noise: number[] = dbscan.noise;

  const out: ClusterResult[] = clusters.map((memberIdx, clusterId) => ({
    clusterId,
    members: memberIdx.map((i) => phrases[i]),
  }));
  if (noise.length > 0) {
    out.push({ clusterId: -1, members: noise.map((i) => phrases[i]) });
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd app && npx vitest run tests/concepts/cluster.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/concepts/lib/cluster.ts app/tests/concepts/cluster.test.ts
git commit -m "feat(concepts): DBSCAN cluster wrapper for embedding vectors"
```

---

## Task 10: Script 03 — Cluster

**Files:**
- Create: `app/scripts/concepts/03-cluster.ts`

- [ ] **Step 1: Write the script**

```ts
// app/scripts/concepts/03-cluster.ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { dbscanCluster } from "./lib/cluster";
import type { ConceptVector, ClusterResult } from "./lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = resolve(__dirname, "../../build");
const IN = resolve(BUILD_DIR, "concept-vectors.json");
const OUT = resolve(BUILD_DIR, "clusters.json");

// Tunables. These produce ~80-150 clusters in our typical run; bump eps lower
// for tighter clusters or minPoints higher to demand more support per cluster.
const EPS = 0.4;
const MIN_POINTS = 3;

function main() {
  const vectors = JSON.parse(readFileSync(IN, "utf8")) as ConceptVector[];
  const phrases = vectors.map((v) => v.phrase);
  const embeddings = vectors.map((v) => v.embedding);

  const clusters: ClusterResult[] = dbscanCluster(phrases, embeddings, {
    eps: EPS,
    minPoints: MIN_POINTS,
  });

  const real = clusters.filter((c) => c.clusterId !== -1);
  const noise = clusters.find((c) => c.clusterId === -1);
  console.log(
    `clustered ${vectors.length} phrases → ${real.length} clusters, ` +
    `${noise?.members.length ?? 0} noise points (eps=${EPS}, minPoints=${MIN_POINTS})`,
  );

  writeFileSync(OUT, JSON.stringify(clusters, null, 2));
  console.log(`wrote ${OUT}`);
}

main();
```

- [ ] **Step 2: Add `concepts:cluster` script to `package.json`**

```json
    "concepts:cluster": "tsx scripts/concepts/03-cluster.ts",
```

- [ ] **Step 3: Run it**

```bash
cd app && npm run concepts:cluster
```

Expected output: `clustered ~4000 phrases → ~80-150 clusters, ~500-1500 noise points`. Wall clock ~30 seconds.

If you get fewer than 50 clusters or more than 250, adjust `EPS` in the script (try 0.35 or 0.45) and re-run. This is a one-time tuning exercise.

- [ ] **Step 4: Commit**

```bash
git add app/scripts/concepts/03-cluster.ts app/package.json
git commit -m "feat(concepts): script 03 — DBSCAN cluster phrases"
```

---

## Task 11: Script 04 — Label clusters and propose categories

Two passes inside one script:

1. **Category proposal:** show Claude a sample of 12 random clusters (3-5 phrases each) and ask it to propose 5-8 parent categories.
2. **Per-cluster labeling:** for each cluster, given the cluster's phrases AND the locked category list, ask Claude for a canonical label and a category assignment.

Both calls use the cached `claude.askJson` wrapper.

**Files:**
- Create: `app/scripts/concepts/04-label.ts`

- [ ] **Step 1: Write the script**

```ts
// app/scripts/concepts/04-label.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
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

const SAMPLE_SIZE = 12;

function sample<T>(arr: T[], n: number, seed = 1): T[] {
  // deterministic LCG-based shuffle so reruns are stable
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

const SYSTEM_CATS = `You design taxonomies for a research consortium. \
Given clusters of related concepts, propose 5-8 parent categories that \
would cover the field. Return ONLY JSON: {"categories": [{"id": "kebab-case", "label": "Title Case"}, ...]}`;

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

  // Pass 1: propose parent categories from a deterministic sample
  const samp = sample(allClusters, SAMPLE_SIZE);
  const sampleText = samp
    .map((c, i) => `Cluster ${i + 1}: ${c.members.slice(0, 5).join(", ")}`)
    .join("\n");

  console.log(`proposing categories from ${samp.length} sample clusters…`);
  const catResp = await claude.askJson<{ categories: CategoryProposal[] }>({
    system: SYSTEM_CATS,
    user: `Sample clusters:\n${sampleText}\n\nReturn JSON.`,
  });
  const categories = catResp.categories;
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
        return {
          clusterId: c.clusterId,
          suggestedLabel: r.label,
          suggestedCategory: r.categoryId,
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
```

- [ ] **Step 2: Add `concepts:label` to `package.json`**

```json
    "concepts:label": "tsx --env-file=.env scripts/concepts/04-label.ts",
```

- [ ] **Step 3: Run it**

```bash
cd app && npm run concepts:label
```

Expected: ~2-3 min wall clock, output `wrote .../concept-candidates.json`.

Visually inspect:

```bash
cat build/concept-candidates.json | head -60
```

Sanity check: the categories should look like a reasonable taxonomy (e.g. "AI/ML Methods", "Materials Science", "Compute Infrastructure"). Each candidate should have a sensible label.

- [ ] **Step 4: Commit**

```bash
git add app/scripts/concepts/04-label.ts app/package.json
git commit -m "feat(concepts): script 04 — propose categories and label clusters"
```

---

## Task 12: Curation UI (Node http server + vanilla JS page)

A single-page UI that loads `concept-candidates.json`, lets you for each cluster: rename, change category, drop, or merge into another cluster. State auto-saves to `app/data-source/concepts.json` on every edit.

**Files:**
- Create: `app/scripts/concepts/curate.ts`
- Create: `app/scripts/concepts/curate.html`

- [ ] **Step 1: Write the HTML page**

```html
<!-- app/scripts/concepts/curate.html -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Concept Curation</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
  header { background: #1e293b; color: #f1f5f9; padding: 12px 20px; display: flex; align-items: center; gap: 16px; }
  header h1 { font-size: 16px; margin: 0; }
  header .stat { font-size: 12px; color: #94a3b8; margin-left: auto; }
  main { padding: 16px 20px; max-width: 1100px; }
  .row { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; display: grid; grid-template-columns: 1fr 200px 110px; gap: 12px; align-items: center; }
  .row.dropped { opacity: 0.4; }
  .row .label-input { font-weight: 600; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; }
  .row select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; }
  .row .actions { display: flex; gap: 6px; justify-content: flex-end; }
  .row button { padding: 4px 10px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; cursor: pointer; font-size: 12px; }
  .row button.drop { color: #b91c1c; }
  .row .members { grid-column: 1 / -1; font-size: 12px; color: #64748b; padding-top: 4px; }
  .merge-pick { background: #fef3c7; border-color: #f59e0b !important; }
  .saved-pulse { animation: pulse 0.5s ease-out; }
  @keyframes pulse { from { background: #dcfce7; } to { background: #fff; } }
</style>
</head>
<body>
<header>
  <h1>Concept Curation</h1>
  <span class="stat" id="stat">…</span>
</header>
<main id="rows"></main>
<script>
async function load() {
  const r = await fetch("/state");
  return r.json();
}
async function save(state) {
  await fetch("/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
}
let state;          // { categories: [...], concepts: [{id, label, categoryId, dropped, members}] }
let mergeSource = null;

function render() {
  const main = document.getElementById("rows");
  main.innerHTML = "";
  const live = state.concepts.filter((c) => !c.dropped).length;
  document.getElementById("stat").textContent = `${live} live · ${state.concepts.length - live} dropped · ${state.categories.length} categories`;
  for (const c of state.concepts) {
    const row = document.createElement("div");
    row.className = "row" + (c.dropped ? " dropped" : "") + (mergeSource === c.id ? " merge-pick" : "");
    row.dataset.id = c.id;

    const label = document.createElement("input");
    label.className = "label-input";
    label.value = c.label;
    label.oninput = () => { c.label = label.value; persist(row); };

    const cat = document.createElement("select");
    for (const k of state.categories) {
      const opt = document.createElement("option");
      opt.value = k.id; opt.textContent = k.label;
      if (k.id === c.categoryId) opt.selected = true;
      cat.appendChild(opt);
    }
    cat.onchange = () => { c.categoryId = cat.value; persist(row); };

    const actions = document.createElement("div");
    actions.className = "actions";

    const dropBtn = document.createElement("button");
    dropBtn.className = "drop";
    dropBtn.textContent = c.dropped ? "Restore" : "Drop";
    dropBtn.onclick = () => { c.dropped = !c.dropped; persist(); render(); };

    const mergeBtn = document.createElement("button");
    mergeBtn.textContent = mergeSource === c.id ? "Cancel merge" : (mergeSource ? `Merge into this` : "Merge…");
    mergeBtn.onclick = () => {
      if (mergeSource === c.id) { mergeSource = null; render(); return; }
      if (mergeSource) {
        const src = state.concepts.find((x) => x.id === mergeSource);
        c.members = [...new Set([...c.members, ...src.members])];
        src.dropped = true;
        mergeSource = null;
        persist(); render();
      } else {
        mergeSource = c.id; render();
      }
    };

    actions.appendChild(dropBtn);
    actions.appendChild(mergeBtn);

    const members = document.createElement("div");
    members.className = "members";
    members.textContent = `members (${c.members.length}): ${c.members.slice(0, 12).join(", ")}${c.members.length > 12 ? "…" : ""}`;

    row.appendChild(label);
    row.appendChild(cat);
    row.appendChild(actions);
    row.appendChild(members);
    main.appendChild(row);
  }
}

let saveTimer = null;
function persist(highlightRow) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await save(state);
    if (highlightRow) {
      highlightRow.classList.add("saved-pulse");
      setTimeout(() => highlightRow.classList.remove("saved-pulse"), 500);
    }
  }, 250);
}

(async () => {
  state = await load();
  render();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Write the server**

```ts
// app/scripts/concepts/curate.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Concept, ConceptCandidate, ConceptCategory, ConceptsArtifact } from "./lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, "curate.html");
const CANDIDATES_PATH = resolve(__dirname, "../../build/concept-candidates.json");
const OUT_PATH = resolve(__dirname, "../../data-source/concepts.json");
const PORT = 5180;

interface CurationState {
  categories: ConceptCategory[];
  concepts: (Concept & { dropped?: boolean })[];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function loadInitialState(): CurationState {
  if (existsSync(OUT_PATH)) {
    const existing = JSON.parse(readFileSync(OUT_PATH, "utf8")) as ConceptsArtifact & { dropped?: string[] };
    return { categories: existing.categories, concepts: existing.concepts };
  }
  const cand = JSON.parse(readFileSync(CANDIDATES_PATH, "utf8")) as {
    categories: ConceptCategory[];
    candidates: ConceptCandidate[];
  };
  // Build initial concepts; ensure unique IDs per label
  const used = new Set<string>();
  const concepts: Concept[] = cand.candidates.map((c) => {
    let id = slugify(c.suggestedLabel);
    let n = 2;
    while (used.has(id)) id = `${slugify(c.suggestedLabel)}-${n++}`;
    used.add(id);
    return {
      id,
      label: c.suggestedLabel,
      categoryId: c.suggestedCategory,
      memberPhrases: c.members,
    };
  });
  return { categories: cand.categories, concepts };
}

function saveState(state: CurationState): void {
  // Strip dropped concepts; rename memberPhrases for the persisted shape
  const live = state.concepts.filter((c) => !c.dropped);
  const out: ConceptsArtifact = {
    generatedAt: new Date().toISOString(),
    categories: state.categories,
    concepts: live.map((c) => ({
      id: c.id,
      label: c.label,
      categoryId: c.categoryId,
      memberPhrases: c.memberPhrases ?? (c as unknown as { members?: string[] }).members ?? [],
    })),
  };
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
}

let state = loadInitialState();
// Map members -> memberPhrases for the in-memory state served to the UI
const stateForUi = () => ({
  categories: state.categories,
  concepts: state.concepts.map((c) => ({
    id: c.id,
    label: c.label,
    categoryId: c.categoryId,
    members: c.memberPhrases,
    dropped: !!c.dropped,
  })),
});

const server = createServer(async (req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync(HTML_PATH, "utf8"));
    return;
  }
  if (req.url === "/state" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(stateForUi()));
    return;
  }
  if (req.url === "/save" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const ui = JSON.parse(body) as { categories: ConceptCategory[]; concepts: (Concept & { members: string[]; dropped?: boolean })[] };
    state = {
      categories: ui.categories,
      concepts: ui.concepts.map((c) => ({
        id: c.id,
        label: c.label,
        categoryId: c.categoryId,
        memberPhrases: c.members,
        dropped: c.dropped,
      })),
    };
    saveState(state);
    res.writeHead(200, { "content-type": "application/json" });
    res.end('{"ok":true}');
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`curation UI: http://localhost:${PORT}`);
  console.log(`output: ${OUT_PATH}`);
  console.log(`(Ctrl-C when done — every edit auto-saves)`);
});
```

- [ ] **Step 3: Add `curate` to `package.json`**

```json
    "curate": "tsx scripts/concepts/curate.ts",
```

- [ ] **Step 4: Manual smoke test**

```bash
cd app && npm run curate
```

Open `http://localhost:5180`. You should see one row per cluster with editable label, category dropdown, drop/restore button, and merge button. Edit a label — see the "saved" pulse. Drop one — see `app/data-source/concepts.json` shrink. Merge two — verify the source disappears and the target absorbs the members.

This is the primary curation step from the spec — plan to spend ~2 hours here merging synonyms, dropping noise, and renaming. When done, Ctrl-C the server.

- [ ] **Step 5: Commit (script + html, not the curated output yet)**

```bash
git add app/scripts/concepts/curate.ts app/scripts/concepts/curate.html app/package.json
git commit -m "feat(concepts): local curation UI for concept layer"
```

- [ ] **Step 6: After your curation pass, commit the curated artifact**

```bash
git add app/data-source/concepts.json
git commit -m "data(concepts): curated concept layer (~80-150 nodes)"
```

---

## Task 13: Script 05 — Retag profiles with curated vocab

Final pass: for each profile, give Claude the curated concept list (just `id` + `label` + member phrases) and ask which apply.

**Files:**
- Create: `app/scripts/concepts/05-retag.ts`

- [ ] **Step 1: Write the script**

```ts
// app/scripts/concepts/05-retag.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
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
          return [p.slug, []] as const;
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
```

- [ ] **Step 2: Add `concepts:retag` to `package.json`**

```json
    "concepts:retag": "tsx --env-file=.env scripts/concepts/05-retag.ts",
```

- [ ] **Step 3: Run it**

```bash
cd app && npm run concepts:retag
```

Expected: ~3-5 min wall clock, output `wrote .../profile-concepts.json: ~480 profiles, ~3500-5000 total tags`.

Sanity-check a few entries:

```bash
node -e "const m=require('./app/data-source/profile-concepts.json'); console.log(Object.entries(m).slice(0,5))"
```

- [ ] **Step 4: Commit (script + curated tagging)**

```bash
git add app/scripts/concepts/05-retag.ts app/package.json app/data-source/profile-concepts.json
git commit -m "feat(concepts): script 05 — re-tag profiles with curated vocabulary"
```

---

## Task 14: Merge concepts into parse output (TDD)

The runtime app loads everything from `app/public/data/`. The parse step needs to (a) attach `conceptIds` to each profile, and (b) copy `concepts.json` to `public/data/concepts.json` for the new categories/labels lookup.

**Files:**
- Create: `app/scripts/concepts/lib/merge.ts`
- Create: `app/tests/concepts/merge.test.ts`
- Modify: `app/scripts/parse.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/concepts/merge.test.ts
import { describe, expect, it } from "vitest";
import { attachConceptIds } from "../../scripts/concepts/lib/merge";
import type { Profile } from "../../src/types";

const baseProfile = (slug: string): Profile => ({
  slug,
  name: slug,
  kind: "organization",
  challengeAreas: [],
  partnerTypeSeeking: [],
  rawHtmlPath: `detail-pages/${slug}.html`,
});

describe("attachConceptIds", () => {
  it("adds conceptIds to profiles that have a mapping", () => {
    const profiles = [baseProfile("alpha"), baseProfile("beta")];
    const map = { alpha: ["c1", "c2"] };
    const out = attachConceptIds(profiles, map);
    expect(out[0].conceptIds).toEqual(["c1", "c2"]);
    expect(out[1].conceptIds).toEqual([]);
  });

  it("returns new objects rather than mutating inputs", () => {
    const profiles = [baseProfile("alpha")];
    const map = { alpha: ["c1"] };
    const out = attachConceptIds(profiles, map);
    expect(out[0]).not.toBe(profiles[0]);
    expect(profiles[0].conceptIds).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
cd app && npx vitest run tests/concepts/merge.test.ts
```

Expected: FAIL — `Cannot find module '.../merge'`.

- [ ] **Step 3: Implement `merge.ts`**

```ts
// app/scripts/concepts/lib/merge.ts
import type { Profile, ProfileConceptMap } from "../../../src/types";

export function attachConceptIds(
  profiles: Profile[],
  map: ProfileConceptMap,
): Profile[] {
  return profiles.map((p) => ({
    ...p,
    conceptIds: map[p.slug] ?? [],
  }));
}
```

- [ ] **Step 4: Run, verify pass**

```bash
cd app && npx vitest run tests/concepts/merge.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Wire into `parse.ts`**

Open `app/scripts/parse.ts`. Add these imports near the top (after the existing `buildSearchIndex` import):

```ts
import { attachConceptIds } from "./concepts/lib/merge";
import type { ConceptsArtifact, ProfileConceptMap } from "../src/types";
import { existsSync } from "node:fs";
```

(`existsSync` may already be imported via `node:fs` — check; the import block already pulls many things from `node:fs`, just add `existsSync` to that destructured list rather than a second import.)

Inside `main()`, after the line `const profiles: Profile[] = [];` and the loop that fills it (after the `for (const file of files) {...}` block ends at the line that sets `errors`), and BEFORE `const neighbors = topNeighbors(...)`, add:

```ts
  // Merge curated concept layer if available (Plan 1 output)
  const CONCEPTS_PATH = resolve(__dirname, "../data-source/concepts.json");
  const PROFILE_CONCEPTS_PATH = resolve(__dirname, "../data-source/profile-concepts.json");
  let mergedProfiles = profiles;
  if (existsSync(CONCEPTS_PATH) && existsSync(PROFILE_CONCEPTS_PATH)) {
    const map = JSON.parse(readFileSync(PROFILE_CONCEPTS_PATH, "utf8")) as ProfileConceptMap;
    mergedProfiles = attachConceptIds(profiles, map);
    const concepts = JSON.parse(readFileSync(CONCEPTS_PATH, "utf8")) as ConceptsArtifact;
    writeFileSync(join(OUT_DIR, "concepts.json"), JSON.stringify(concepts));
    console.log(`merged ${concepts.concepts.length} concepts, tagged ${Object.keys(map).length} profiles`);
  } else {
    console.log("no concepts.json found — skipping concept merge (run npm run concepts first)");
  }
```

Then change the existing line that uses `profiles` for downstream consumption:

```ts
  const neighbors = topNeighbors(profiles, 6);
  const edges: NetworkEdge[] = buildEdges(profiles);
  const nodes: NetworkNode[] = profiles.map((p) => ({
```

…to use `mergedProfiles`:

```ts
  const neighbors = topNeighbors(mergedProfiles, 6);
  const edges: NetworkEdge[] = buildEdges(mergedProfiles);
  const nodes: NetworkNode[] = mergedProfiles.map((p) => ({
```

And the line that writes profiles.json:

```ts
  writeFileSync(join(OUT_DIR, "profiles.json"), JSON.stringify(profiles));
```

…to:

```ts
  writeFileSync(join(OUT_DIR, "profiles.json"), JSON.stringify(mergedProfiles));
```

- [ ] **Step 6: Run parse and verify the merge happens**

```bash
cd app && npm run parse
```

Expected log: `parsed 486 profiles, ... merged ~100 concepts, tagged ~480 profiles`. Then:

```bash
node -e "const p=require('./app/public/data/profiles.json'); const c=require('./app/public/data/concepts.json'); console.log('first profile conceptIds:', p[0].conceptIds, '\\ntotal concepts in file:', c.concepts.length)"
```

Expected: a non-empty `conceptIds` array on the first profile, and the total concept count matches your curated artifact.

- [ ] **Step 7: Commit**

```bash
git add app/scripts/concepts/lib/merge.ts app/tests/concepts/merge.test.ts app/scripts/parse.ts
git commit -m "feat(concepts): merge curated concepts into parse output"
```

---

## Task 15: Convenience `concepts` script + README

Adds a single `npm run concepts` that chains all five steps (extract → embed → cluster → label → retag), skipping curation (which is interactive). Also documents the workflow.

**Files:**
- Modify: `app/package.json`
- Modify: `app/README.md`

- [ ] **Step 1: Add the chained script to `package.json`**

In the `"scripts"` block, add (after `concepts:retag`):

```json
    "concepts": "npm run concepts:extract && npm run concepts:embed && npm run concepts:cluster && npm run concepts:label && echo '\\nNext: run \"npm run curate\" to curate the concept layer, then \"npm run concepts:retag\".'",
```

- [ ] **Step 2: Add a section to `app/README.md`**

After the existing "Build" section, before "Deploy to Vercel", insert:

````markdown
## Concept extraction pipeline (one-shot, offline)

The Canvas UI (Plan 1+ of the knowledge-graph redesign) needs a curated
concept layer. This is a manual one-shot pipeline; the resulting JSON files
in `app/data-source/` are committed and the production build never calls
LLMs.

```bash
# 1. Set ANTHROPIC_API_KEY in app/.env (see app/.env.example)

# 2. Pre-curation pipeline (runs automatically end-to-end)
npm run concepts                    # extract → embed → cluster → label
                                    # ~10-15 min, ~$3-5 in Haiku calls

# 3. Manual curation (~2 hours, single sitting)
npm run curate                      # opens http://localhost:5180
                                    # rename, merge, drop, recategorize
                                    # autosaves to app/data-source/concepts.json

# 4. Re-tag profiles against the curated vocabulary
npm run concepts:retag              # ~3-5 min, ~$1-2 in Haiku calls
                                    # writes app/data-source/profile-concepts.json

# 5. Commit the artifacts
git add app/data-source/concepts.json app/data-source/profile-concepts.json
git commit -m "data(concepts): refresh concept layer"
```

LLM responses are cached in `app/build/llm-cache/` (gitignored) keyed by
input SHA — partial failures and reruns are free.

The committed artifacts are picked up automatically by `npm run parse`.
Vercel's build never needs `ANTHROPIC_API_KEY`.
````

- [ ] **Step 3: Verify README renders sanely**

```bash
cd app && cat README.md | head -90
```

Spot-check: the new section reads correctly, no markdown syntax issues.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/README.md
git commit -m "docs(concepts): chained pipeline script and README workflow"
```

---

## Task 16: Verify build still works end-to-end

A safety net — run the full production build to make sure the new concept-merge step in `parse.ts` doesn't break anything when the artifacts are present.

**Files:** none

- [ ] **Step 1: Clean and rebuild**

```bash
cd app && rm -rf dist public/data && npm run build
```

Expected: `parse` runs (with the "merged N concepts" log line), then `tsc -b` and `vite build` succeed. `dist/` is produced.

- [ ] **Step 2: Verify the new public/data/concepts.json shipped**

```bash
ls -la dist/data/ | grep -E "(concepts|profiles|network|search)"
```

Expected: all four `.json` files present in `dist/data/`.

- [ ] **Step 3: Run all tests**

```bash
cd app && npm test
```

Expected: all existing tests pass + the 4 new concepts test files pass (cache, profiles, claude, cluster, merge).

- [ ] **Step 4: No commit needed if everything passed**

If the build modified anything tracked, investigate before committing. (`public/data/` is gitignored, so a clean rebuild should not change the working tree.)

---

## Definition of Done for Plan 1

- `npm run concepts` runs the four-step pre-curation pipeline end-to-end without errors.
- `npm run curate` opens a usable web UI; edits persist to `app/data-source/concepts.json`.
- `npm run concepts:retag` produces `app/data-source/profile-concepts.json`.
- `app/data-source/concepts.json` and `app/data-source/profile-concepts.json` are committed to git.
- `npm run parse` merges them into `app/public/data/profiles.json` (each profile gets `conceptIds`) and writes `app/public/data/concepts.json`.
- `npm test` passes including 5 new test files in `app/tests/concepts/`.
- `npm run build` succeeds without `ANTHROPIC_API_KEY` set.
- Plan 2 (matches) can proceed using `data-source/profile-concepts.json` as input.
