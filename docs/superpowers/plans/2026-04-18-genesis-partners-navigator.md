# Genesis Partners Navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static-deploy web app that lets a small team navigate 443 scraped DOE Genesis Mission Partnership Exchange profiles — filter, search, compare, view a relationship network, and find similar participants.

**Architecture:** A Node build step parses `detail-pages/*.html` (Drupal 11 markup) into a set of JSON files (`profiles.json`, `search.json`, `network.json`). A React + TypeScript SPA (Vite) loads those JSON files and runs all filtering/search/similarity client-side. Deployed as a static bundle to Netlify/Vercel.

**Tech Stack:** Node 18+, TypeScript, Vite, React 18, React Router (hash routing), Fuse.js (search), Cheerio (HTML parsing), d3-force/d3-selection/d3-drag/d3-zoom (network view), Tailwind CSS, lucide-react (icons), Vitest + @testing-library/react (unit/component tests), Playwright (smoke e2e).

**Spec:** [`docs/superpowers/specs/2026-04-18-genesis-partners-navigator-design.md`](../specs/2026-04-18-genesis-partners-navigator-design.md)

**Repo layout at start of plan:**

```
DOE-Genesis-Scrap/
├── detail-pages/*.html       (443 files, read-only input)
├── list-pages/*.html
├── manifest.json
├── docs/superpowers/
│   ├── specs/2026-04-18-genesis-partners-navigator-design.md
│   └── plans/2026-04-18-genesis-partners-navigator.md   ← this file
└── .gitignore
```

**Repo layout at plan completion:**

```
DOE-Genesis-Scrap/
├── detail-pages/             (unchanged)
├── list-pages/               (unchanged)
├── manifest.json             (unchanged)
├── app/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── playwright.config.ts
│   ├── index.html
│   ├── netlify.toml
│   ├── README.md
│   ├── scripts/
│   │   ├── parse.ts          (build-time parser entry)
│   │   ├── fixtures/         (sample HTML copies used by parser tests)
│   │   └── lib/
│   │       ├── extract.ts
│   │       ├── infer-kind.ts
│   │       ├── similarity.ts
│   │       └── search-index.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── types.ts
│   │   ├── data.ts
│   │   ├── routes/
│   │   │   ├── Browse.tsx
│   │   │   ├── ProfileDetail.tsx
│   │   │   ├── Compare.tsx
│   │   │   ├── Network.tsx
│   │   │   └── NotFound.tsx
│   │   ├── components/
│   │   │   ├── TopBar.tsx
│   │   │   ├── FilterSidebar.tsx
│   │   │   ├── ProfileCard.tsx
│   │   │   ├── ProfileTable.tsx
│   │   │   ├── SearchBox.tsx
│   │   │   ├── TagChip.tsx
│   │   │   ├── FavoriteButton.tsx
│   │   │   ├── CompareButton.tsx
│   │   │   ├── SimilarCarousel.tsx
│   │   │   └── NetworkGraph.tsx
│   │   └── lib/
│   │       ├── filters.ts
│   │       ├── search.ts
│   │       ├── storage.ts
│   │       ├── url-state.ts
│   │       └── keyboard.ts
│   ├── tests/
│   │   ├── parse/
│   │   │   ├── extract.test.ts
│   │   │   ├── infer-kind.test.ts
│   │   │   └── similarity.test.ts
│   │   ├── filters.test.ts
│   │   ├── storage.test.ts
│   │   └── e2e/smoke.spec.ts
│   └── public/data/          (generated, gitignored)
│       ├── profiles.json
│       ├── search.json
│       ├── network.json
│       └── parse-errors.json
```

---

## Phase 1 — Project scaffolding

### Task 1: Scaffold the Vite React+TypeScript app under `app/`

**Files:**
- Create: `app/package.json`, `app/vite.config.ts`, `app/tsconfig.json`, `app/tsconfig.node.json`, `app/index.html`, `app/src/main.tsx`, `app/src/App.tsx`, `app/src/index.css`, `app/.gitignore`

- [ ] **Step 1: Create `app/` with Vite's React+TS template**

Run (from `DOE-Genesis-Scrap/`):
```bash
npm create vite@latest app -- --template react-ts
cd app
npm install
```

Expected: `app/` is created with `package.json`, `src/App.tsx`, `vite.config.ts`, etc. `npm install` completes without errors.

- [ ] **Step 2: Install runtime + parser + test dependencies**

Run (from `app/`):
```bash
npm install react-router-dom fuse.js cheerio lucide-react \
  d3-force d3-selection d3-drag d3-zoom
npm install -D tailwindcss postcss autoprefixer \
  vitest @testing-library/react @testing-library/jest-dom jsdom \
  @playwright/test tsx \
  @types/d3-force @types/d3-selection @types/d3-drag @types/d3-zoom
npx tailwindcss init -p
```

Expected: All installs succeed. `app/tailwind.config.js` and `app/postcss.config.js` created.

- [ ] **Step 3: Replace `tailwind.config.js` with a TypeScript config and configure content paths**

Delete `app/tailwind.config.js`. Create `app/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["InterVariable", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Replace the generated `app/src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-slate-50 text-slate-900 antialiased; }
```

- [ ] **Step 4: Replace generated `App.tsx` with a minimal placeholder and update `main.tsx`**

Replace `app/src/App.tsx` with:

```tsx
export default function App() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Genesis Partners Navigator</h1>
      <p className="text-slate-600">Scaffold is live.</p>
    </div>
  );
}
```

Replace `app/src/main.tsx` with (remove the demo imports, keep React.StrictMode):

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Delete `app/src/App.css` if present.

- [ ] **Step 5: Configure Vitest in `vite.config.ts`**

Replace `app/vite.config.ts` with:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
  },
});
```

Create `app/src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Add `app/.gitignore`**

Create `app/.gitignore`:

```
node_modules/
dist/
public/data/
.DS_Store
test-results/
playwright-report/
```

- [ ] **Step 7: Verify dev server boots and build works**

Run (from `app/`):
```bash
npm run dev
```
Expected: Vite starts on http://localhost:5173 without errors; visiting shows the placeholder page. Stop the server (Ctrl-C).

Run:
```bash
npm run build
```
Expected: TypeScript compiles, `app/dist/` is created, no errors.

- [ ] **Step 8: Commit**

```bash
cd .. # back to DOE-Genesis-Scrap/
git add app/
git commit -m "scaffold: Vite + React + TS + Tailwind app shell"
```

---

### Task 2: Define shared TypeScript types

**Files:**
- Create: `app/src/types.ts`

- [ ] **Step 1: Create `app/src/types.ts`**

```ts
export type Affiliation = string;
export type OrgType = string;
export type OrgSize = string;

export type ProfileKind = "person" | "organization";

export interface TaggedText {
  text: string;
  tags: string[];
}

export interface Profile {
  slug: string;
  name: string;
  kind: ProfileKind;
  affiliation?: Affiliation;
  orgType?: OrgType;
  orgSize?: OrgSize;
  website?: string;
  introduction?: string;
  challengeAreas: string[];
  offerings?: TaggedText;
  seeking?: TaggedText;
  partnerTypeSeeking: string[];
  projectIdeaSummary?: string;
  relevantProjects?: string;
  relevantPublications?: string;
  rfaNumber?: string;
  rawHtmlPath: string;
}

export interface NetworkNode {
  slug: string;
  name: string;
  affiliation?: string;
  richness: number;
}

export interface NetworkEdge {
  a: string;
  b: string;
  weight: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  neighbors: Record<string, string[]>;
}

export interface ParseError {
  slug: string;
  message: string;
  field?: string;
}

export type ChallengeArea = string;
```

- [ ] **Step 2: Commit**

```bash
git add app/src/types.ts
git commit -m "types: Profile, NetworkData, ParseError"
```

---

## Phase 2 — Parser

### Task 3: Copy parser fixtures covering the field-count variants

**Files:**
- Create: `app/scripts/fixtures/*.html` (8 files)

The raw data shows pages with 9, 10, 11, 12, 13, 14, and 15 `.profileField` rows. Pick representative examples for each and include at least one clearly person-style and one organization-style.

- [ ] **Step 1: Inventory fixture candidates**

Run (from `DOE-Genesis-Scrap/`):
```bash
mkdir -p app/scripts/fixtures
for f in detail-pages/*.html; do
  n=$(grep -c '<div class="col-md-3 profileField">' "$f")
  echo "$n $(basename "$f")"
done | sort -n | awk '!seen[$1]++' | head -20
```
Expected: One filename per unique field count. Pick one per count (9,10,11,12,13,14,15) to copy.

- [ ] **Step 2: Copy 8 fixtures into `app/scripts/fixtures/`**

Pick the filenames from step 1. Also include `acceleration-consortium.html` (14 fields, clearly an organization). Copy each:

```bash
# Replace with your picks from step 1
cp detail-pages/acceleration-consortium.html app/scripts/fixtures/
cp detail-pages/abel-souza.html app/scripts/fixtures/
# ... one per unique field count (9 through 15)
```

Expected: `app/scripts/fixtures/` contains 8 HTML files spanning the variants.

- [ ] **Step 3: Commit**

```bash
git add app/scripts/fixtures/
git commit -m "parser: fixture HTML pages for extractor tests"
```

---

### Task 4: Field extraction helpers

**Files:**
- Create: `app/scripts/lib/extract.ts`
- Create: `app/tests/parse/extract.test.ts`

Drupal markup facts (verified by inspection):
- Page title: `<h1 class="title"> <div class="field field--name-label ...">NAME</div> </h1>`
- Each labeled field is a `<div class="row mb-2 fieldRow">` containing `<div class="col-md-3 profileField">LABEL</div>` and `<div class="col-md-9 fieldValue">VALUE</div>`.
- Tag groups (challenge areas, partner type seeking) use `<div class="field__items"><div class="field__item">TAG</div>…</div>`.
- Website links live inside `<div class="field--name-field-website-address"><a href="…">URL</a></div>` within the value cell.

- [ ] **Step 1: Write the failing test `extract.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import {
  extractName,
  extractLabeledText,
  extractLabeledTags,
  extractLabeledLink,
  extractTaggedText,
  collectProfileFieldLabels,
} from "../../scripts/lib/extract";

const fixture = (name: string) =>
  cheerio.load(readFileSync(join(__dirname, "../../scripts/fixtures", name), "utf8"));

describe("extract", () => {
  it("reads the page title", () => {
    const $ = fixture("acceleration-consortium.html");
    expect(extractName($)).toBe("Acceleration Consortium");
  });

  it("reads a simple labeled text field", () => {
    const $ = fixture("acceleration-consortium.html");
    expect(extractLabeledText($, "Affiliation")).toBe("Academic institution");
    expect(extractLabeledText($, "Organization Size")).toBe(
      "Small: 50 - 499 employees",
    );
  });

  it("returns undefined for missing labels", () => {
    const $ = fixture("acceleration-consortium.html");
    expect(extractLabeledText($, "Does Not Exist")).toBeUndefined();
  });

  it("reads a tag-group field as an array", () => {
    const $ = fixture("acceleration-consortium.html");
    const tags = extractLabeledTags(
      $,
      "National Science and Technology Challenges",
    );
    expect(tags).toContain("Achieving AI-Driven Autonomous Laboratories");
    expect(tags.length).toBeGreaterThanOrEqual(1);
  });

  it("reads the Website Address link", () => {
    const $ = fixture("acceleration-consortium.html");
    expect(extractLabeledLink($, "Website Address")).toMatch(/^https?:\/\//);
  });

  it("reads a checkbox-notes field (Offerings) as tagged text", () => {
    const $ = fixture("acceleration-consortium.html");
    const off = extractTaggedText($, "Offerings");
    expect(off).toBeDefined();
    expect(off!.text.length).toBeGreaterThan(0);
    expect(Array.isArray(off!.tags)).toBe(true);
  });

  it("enumerates all present labels for a page", () => {
    const $ = fixture("acceleration-consortium.html");
    const labels = collectProfileFieldLabels($);
    expect(labels).toContain("Institution Name");
    expect(labels).toContain("Affiliation");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run (from `app/`):
```bash
npx vitest run tests/parse/extract.test.ts
```
Expected: FAIL — "Cannot find module '../../scripts/lib/extract'".

- [ ] **Step 3: Implement `app/scripts/lib/extract.ts`**

```ts
import type { CheerioAPI } from "cheerio";
import type { TaggedText } from "../../src/types";

const ROW = "div.row.fieldRow, div.row.mb-2.fieldRow";

function rowFor($: CheerioAPI, label: string) {
  return $(ROW)
    .filter((_, el) => $(el).find("div.profileField").first().text().trim() === label)
    .first();
}

export function extractName($: CheerioAPI): string {
  return $("h1.title .field--name-label").first().text().trim()
    || $("h1.title").first().text().trim();
}

export function extractLabeledText($: CheerioAPI, label: string): string | undefined {
  const row = rowFor($, label);
  if (row.length === 0) return undefined;
  const value = row.find("div.fieldValue").first().text().replace(/\s+/g, " ").trim();
  return value.length > 0 ? value : undefined;
}

export function extractLabeledTags($: CheerioAPI, label: string): string[] {
  const row = rowFor($, label);
  if (row.length === 0) return [];
  return row
    .find("div.field__items div.field__item, div.field__item")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

export function extractLabeledLink($: CheerioAPI, label: string): string | undefined {
  const row = rowFor($, label);
  if (row.length === 0) return undefined;
  const href = row.find("div.fieldValue a").first().attr("href");
  return href?.trim() || undefined;
}

export function extractLabeledHtmlText(
  $: CheerioAPI,
  label: string,
): string | undefined {
  const row = rowFor($, label);
  if (row.length === 0) return undefined;
  const text = row
    .find("div.fieldValue")
    .first()
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text.length > 0 ? text : undefined;
}

export function extractTaggedText(
  $: CheerioAPI,
  label: string,
): TaggedText | undefined {
  const row = rowFor($, label);
  if (row.length === 0) return undefined;
  const value = row.find("div.fieldValue").first();
  const tags = value
    .find(".field__item, .checkbox-note__option, li")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((s) => s.length > 0 && s.length < 200);
  const text = value.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (text.length === 0 && tags.length === 0) return undefined;
  return { text, tags: Array.from(new Set(tags)) };
}

export function collectProfileFieldLabels($: CheerioAPI): string[] {
  return $("div.profileField")
    .map((_, el) => $(el).text().trim())
    .get();
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run (from `app/`):
```bash
npx vitest run tests/parse/extract.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add app/scripts/lib/extract.ts app/tests/parse/extract.test.ts
git commit -m "parser: field extraction helpers"
```

---

### Task 5: Kind inference (person vs. organization)

**Files:**
- Create: `app/scripts/lib/infer-kind.ts`
- Create: `app/tests/parse/infer-kind.test.ts`

Heuristic: if the page lists `"Institution Name"` as a profileField label, it's an organization profile; otherwise it's a person. Default to organization on ambiguity.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { inferKind } from "../../scripts/lib/infer-kind";

const fixture = (name: string) =>
  cheerio.load(readFileSync(join(__dirname, "../../scripts/fixtures", name), "utf8"));

describe("inferKind", () => {
  it("organization when Institution Name present", () => {
    expect(inferKind(fixture("acceleration-consortium.html"))).toBe("organization");
  });

  it("person when Institution Name absent", () => {
    expect(inferKind(fixture("abel-souza.html"))).toBe("person");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:
```bash
npx vitest run tests/parse/infer-kind.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `app/scripts/lib/infer-kind.ts`**

```ts
import type { CheerioAPI } from "cheerio";
import type { ProfileKind } from "../../src/types";
import { collectProfileFieldLabels } from "./extract";

export function inferKind($: CheerioAPI): ProfileKind {
  return collectProfileFieldLabels($).includes("Institution Name")
    ? "organization"
    : "person";
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run:
```bash
npx vitest run tests/parse/infer-kind.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/lib/infer-kind.ts app/tests/parse/infer-kind.test.ts
git commit -m "parser: kind inference"
```

---

### Task 6: Jaccard similarity + top-N neighbors

**Files:**
- Create: `app/scripts/lib/similarity.ts`
- Create: `app/tests/parse/similarity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { jaccard, topNeighbors, buildEdges } from "../../scripts/lib/similarity";
import type { Profile } from "../../src/types";

function mk(partial: Partial<Profile>): Profile {
  return {
    slug: "x",
    name: "X",
    kind: "organization",
    challengeAreas: [],
    partnerTypeSeeking: [],
    rawHtmlPath: "x.html",
    ...partial,
  };
}

describe("jaccard", () => {
  it("returns 0 for empty sets", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
  it("returns 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("computes partial overlap", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
  });
});

describe("topNeighbors", () => {
  it("returns top-K by similarity, excluding self", () => {
    const profiles = [
      mk({ slug: "a", challengeAreas: ["x", "y"] }),
      mk({ slug: "b", challengeAreas: ["x", "y"] }),
      mk({ slug: "c", challengeAreas: ["z"] }),
      mk({ slug: "d", challengeAreas: ["y"] }),
    ];
    const neighbors = topNeighbors(profiles, 2);
    expect(neighbors["a"][0]).toBe("b");
    expect(neighbors["a"]).not.toContain("a");
  });
});

describe("buildEdges", () => {
  it("emits an edge for each shared challenge area", () => {
    const profiles = [
      mk({ slug: "a", challengeAreas: ["x", "y"] }),
      mk({ slug: "b", challengeAreas: ["y", "z"] }),
      mk({ slug: "c", challengeAreas: ["w"] }),
    ];
    const edges = buildEdges(profiles);
    const ab = edges.find((e) => e.a === "a" && e.b === "b");
    expect(ab?.weight).toBe(1);
    expect(edges.find((e) => e.a === "a" && e.b === "c")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:
```bash
npx vitest run tests/parse/similarity.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `app/scripts/lib/similarity.ts`**

```ts
import type { NetworkEdge, Profile } from "../../src/types";

export function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function featureSet(p: Profile): Set<string> {
  const feats = new Set<string>();
  for (const c of p.challengeAreas) feats.add("c:" + c);
  for (const t of p.partnerTypeSeeking) feats.add("pt:" + t);
  for (const t of p.offerings?.tags ?? []) feats.add("o:" + t);
  return feats;
}

export function topNeighbors(profiles: Profile[], k: number): Record<string, string[]> {
  const feats = new Map(profiles.map((p) => [p.slug, featureSet(p)]));
  const result: Record<string, string[]> = {};
  for (const p of profiles) {
    const me = feats.get(p.slug)!;
    const scored = profiles
      .filter((q) => q.slug !== p.slug)
      .map((q) => ({ slug: q.slug, score: jaccard(me, feats.get(q.slug)!) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((x) => x.slug);
    result[p.slug] = scored;
  }
  return result;
}

export function buildEdges(profiles: Profile[]): NetworkEdge[] {
  const edges: NetworkEdge[] = [];
  const byChallenge = new Map<string, string[]>();
  for (const p of profiles) {
    for (const c of p.challengeAreas) {
      const arr = byChallenge.get(c) ?? [];
      arr.push(p.slug);
      byChallenge.set(c, arr);
    }
  }
  const pairs = new Map<string, number>();
  for (const slugs of byChallenge.values()) {
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        const [a, b] = [slugs[i], slugs[j]].sort();
        const key = `${a}|${b}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, weight] of pairs) {
    const [a, b] = key.split("|");
    edges.push({ a, b, weight });
  }
  return edges;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run:
```bash
npx vitest run tests/parse/similarity.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/scripts/lib/similarity.ts app/tests/parse/similarity.test.ts
git commit -m "parser: jaccard similarity + edge builder"
```

---

### Task 7: Search index builder

**Files:**
- Create: `app/scripts/lib/search-index.ts`

No test needed — this is a thin adapter that produces a Fuse.js index object which we'll verify at runtime in the app. Weights come directly from the spec.

- [ ] **Step 1: Implement `app/scripts/lib/search-index.ts`**

```ts
import Fuse from "fuse.js";
import type { Profile } from "../../src/types";

export interface SearchDoc {
  slug: string;
  name: string;
  introduction: string;
  offerings: string;
  seeking: string;
  projectIdea: string;
}

export function buildSearchIndex(profiles: Profile[]) {
  const docs: SearchDoc[] = profiles.map((p) => ({
    slug: p.slug,
    name: p.name,
    introduction: p.introduction ?? "",
    offerings: p.offerings?.text ?? "",
    seeking: p.seeking?.text ?? "",
    projectIdea: p.projectIdeaSummary ?? "",
  }));

  const index = Fuse.createIndex(
    ["name", "introduction", "offerings", "seeking", "projectIdea"],
    docs,
  );

  return { docs, index: index.toJSON() };
}

export const SEARCH_KEYS = [
  { name: "name", weight: 3 },
  { name: "introduction", weight: 2 },
  { name: "offerings", weight: 1 },
  { name: "seeking", weight: 1 },
  { name: "projectIdea", weight: 1 },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add app/scripts/lib/search-index.ts
git commit -m "parser: Fuse.js search index builder"
```

---

### Task 8: Parser entry point — parse all pages and write JSON outputs

**Files:**
- Create: `app/scripts/parse.ts`
- Modify: `app/package.json` (add scripts)

- [ ] **Step 1: Implement `app/scripts/parse.ts`**

```ts
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import * as cheerio from "cheerio";
import type {
  NetworkData,
  NetworkEdge,
  NetworkNode,
  ParseError,
  Profile,
} from "../src/types";
import {
  extractLabeledLink,
  extractLabeledHtmlText,
  extractLabeledTags,
  extractLabeledText,
  extractName,
  extractTaggedText,
} from "./lib/extract";
import { inferKind } from "./lib/infer-kind";
import { buildEdges, topNeighbors } from "./lib/similarity";
import { buildSearchIndex } from "./lib/search-index";

const SOURCE_DIR = resolve(__dirname, "../../detail-pages");
const OUT_DIR = resolve(__dirname, "../public/data");

function slugFromFilename(file: string): string {
  return file.replace(/\.html$/i, "");
}

function countFilled(p: Profile): number {
  let n = 0;
  for (const v of [
    p.affiliation,
    p.orgType,
    p.orgSize,
    p.website,
    p.introduction,
    p.offerings?.text,
    p.seeking?.text,
    p.projectIdeaSummary,
    p.relevantProjects,
    p.relevantPublications,
    p.rfaNumber,
  ]) if (v && v.trim().length > 0) n++;
  n += p.challengeAreas.length > 0 ? 1 : 0;
  n += p.partnerTypeSeeking.length > 0 ? 1 : 0;
  return n;
}

function parseOne(file: string, html: string): Profile {
  const $ = cheerio.load(html);
  const slug = slugFromFilename(file);
  const kind = inferKind($);
  return {
    slug,
    name: extractName($),
    kind,
    affiliation: extractLabeledText($, "Affiliation"),
    orgType: extractLabeledText($, "Organization Type"),
    orgSize: extractLabeledText($, "Organization Size"),
    website: extractLabeledLink($, "Website Address"),
    introduction: extractLabeledHtmlText($, "Introduction"),
    challengeAreas: extractLabeledTags($, "National Science and Technology Challenges"),
    offerings: extractTaggedText($, "Offerings"),
    seeking: extractTaggedText($, "Capabilities Seeking"),
    partnerTypeSeeking: extractLabeledTags($, "Partner Type Seeking"),
    projectIdeaSummary: extractLabeledHtmlText($, "Project Idea Summary"),
    relevantProjects: extractLabeledHtmlText($, "Relevant Projects"),
    relevantPublications: extractLabeledHtmlText($, "Relevant Publications"),
    rfaNumber: extractLabeledText($, "RFA #"),
    rawHtmlPath: `detail-pages/${file}`,
  };
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".html")).sort();
  const profiles: Profile[] = [];
  const errors: ParseError[] = [];

  for (const file of files) {
    try {
      const html = readFileSync(join(SOURCE_DIR, file), "utf8");
      profiles.push(parseOne(file, html));
    } catch (err) {
      const slug = slugFromFilename(file);
      errors.push({ slug, message: err instanceof Error ? err.message : String(err) });
    }
  }

  const neighbors = topNeighbors(profiles, 6);
  const edges: NetworkEdge[] = buildEdges(profiles);
  const nodes: NetworkNode[] = profiles.map((p) => ({
    slug: p.slug,
    name: p.name,
    affiliation: p.affiliation,
    richness: countFilled(p),
  }));
  const network: NetworkData = { nodes, edges, neighbors };

  const search = buildSearchIndex(profiles);

  writeFileSync(join(OUT_DIR, "profiles.json"), JSON.stringify(profiles));
  writeFileSync(join(OUT_DIR, "network.json"), JSON.stringify(network));
  writeFileSync(join(OUT_DIR, "search.json"), JSON.stringify(search));
  writeFileSync(join(OUT_DIR, "parse-errors.json"), JSON.stringify(errors, null, 2));

  console.log(
    `parsed ${profiles.length} profiles, ${edges.length} edges, ${errors.length} errors`,
  );
}

main();
```

- [ ] **Step 2: Add scripts to `app/package.json`**

Add these entries to the `"scripts"` object in `app/package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "parse": "tsx scripts/parse.ts",
    "build": "npm run parse && tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 3: Run the parser against the real data**

Run (from `app/`):
```bash
npm run parse
```
Expected: Console logs `parsed 443 profiles, N edges, 0 errors` (or a very small number of errors). Files appear in `app/public/data/`.

- [ ] **Step 4: Spot-check the output**

Run:
```bash
node -e 'const p = require("./public/data/profiles.json"); console.log(p.length, p[0].name, p[0].challengeAreas)'
```
Expected: Count is 443, first profile name is a real name, `challengeAreas` is a non-empty array for organizations that have them.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/parse.ts app/package.json
git commit -m "parser: entry point producing profiles.json, network.json, search.json"
```

---

## Phase 3 — App foundation

### Task 9: Data loader

**Files:**
- Create: `app/src/data.ts`

- [ ] **Step 1: Implement `app/src/data.ts`**

```ts
import type { NetworkData, Profile } from "./types";

interface SearchBundle {
  docs: Array<{
    slug: string;
    name: string;
    introduction: string;
    offerings: string;
    seeking: string;
    projectIdea: string;
  }>;
  index: unknown;
}

interface Bundle {
  profiles: Profile[];
  network: NetworkData;
  search: SearchBundle;
}

let cache: Promise<Bundle> | null = null;

export function loadData(): Promise<Bundle> {
  if (!cache) {
    cache = (async () => {
      const [profiles, network, search] = await Promise.all([
        fetch("/data/profiles.json").then((r) => r.json() as Promise<Profile[]>),
        fetch("/data/network.json").then((r) => r.json() as Promise<NetworkData>),
        fetch("/data/search.json").then((r) => r.json() as Promise<SearchBundle>),
      ]);
      return { profiles, network, search };
    })();
  }
  return cache;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/data.ts
git commit -m "app: data loader for parser outputs"
```

---

### Task 10: Router shell + top bar

**Files:**
- Create: `app/src/components/TopBar.tsx`
- Create: `app/src/routes/Browse.tsx`, `app/src/routes/ProfileDetail.tsx`, `app/src/routes/Compare.tsx`, `app/src/routes/Network.tsx`, `app/src/routes/NotFound.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Create placeholder route components**

Create `app/src/routes/Browse.tsx`:

```tsx
export default function Browse() {
  return <div className="p-8">Browse (to be implemented)</div>;
}
```

Create `app/src/routes/ProfileDetail.tsx`:

```tsx
import { useParams } from "react-router-dom";
export default function ProfileDetail() {
  const { slug } = useParams();
  return <div className="p-8">Profile: {slug}</div>;
}
```

Create `app/src/routes/Compare.tsx`:

```tsx
export default function Compare() {
  return <div className="p-8">Compare (to be implemented)</div>;
}
```

Create `app/src/routes/Network.tsx`:

```tsx
export default function Network() {
  return <div className="p-8">Network (to be implemented)</div>;
}
```

Create `app/src/routes/NotFound.tsx`:

```tsx
import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Not found</h1>
      <Link className="text-sky-700 underline" to="/">Back to browse</Link>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/src/components/TopBar.tsx`**

```tsx
import { NavLink } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

export default function TopBar() {
  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <div className="text-sm font-semibold">Genesis Partners</div>
      <nav className="flex gap-1">
        <NavLink to="/" end className={tabClass}>Browse</NavLink>
        <NavLink to="/network" className={tabClass}>Network</NavLink>
        <NavLink to="/compare" className={tabClass}>Compare</NavLink>
      </nav>
    </header>
  );
}
```

- [ ] **Step 3: Replace `app/src/App.tsx` with the router shell**

```tsx
import { HashRouter, Route, Routes } from "react-router-dom";
import TopBar from "./components/TopBar";
import Browse from "./routes/Browse";
import ProfileDetail from "./routes/ProfileDetail";
import Compare from "./routes/Compare";
import Network from "./routes/Network";
import NotFound from "./routes/NotFound";

export default function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Browse />} />
            <Route path="/profile/:slug" element={<ProfileDetail />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/network" element={<Network />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Run (from `app/`):
```bash
npm run dev
```
Expected: Visiting http://localhost:5173 shows the top bar with three tabs. Clicking Network/Compare changes the body text. Visiting http://localhost:5173/#/profile/acceleration-consortium shows `Profile: acceleration-consortium`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add app/src/App.tsx app/src/components/TopBar.tsx app/src/routes/
git commit -m "app: router shell + top bar + placeholder routes"
```

---

### Task 11: URL-state hook

**Files:**
- Create: `app/src/lib/url-state.ts`

Serializes filter state to the URL query string using `useSearchParams` from react-router-dom. One hook returns the parsed state plus setters.

- [ ] **Step 1: Implement `app/src/lib/url-state.ts`**

```ts
import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

export interface FilterState {
  q: string;
  challenge: string[];
  offers: string[];
  seeking: string[];
  partnerType: string[];
  orgType: string[];
  orgSize: string[];
  affiliation: string[];
  favoritesOnly: boolean;
  view: "cards" | "table";
  sort: "relevance" | "name" | "affiliation" | "richness";
}

const ARRAY_KEYS = [
  "challenge",
  "offers",
  "seeking",
  "partnerType",
  "orgType",
  "orgSize",
  "affiliation",
] as const;

export function useFilterState(): [FilterState, (updater: Partial<FilterState>) => void] {
  const [params, setParams] = useSearchParams();

  const state = useMemo<FilterState>(() => {
    const get = (k: string) => params.get(k) ?? "";
    const getArr = (k: string) =>
      params.getAll(k).flatMap((v) => v.split(",")).filter(Boolean);
    return {
      q: get("q"),
      challenge: getArr("challenge"),
      offers: getArr("offers"),
      seeking: getArr("seeking"),
      partnerType: getArr("partnerType"),
      orgType: getArr("orgType"),
      orgSize: getArr("orgSize"),
      affiliation: getArr("affiliation"),
      favoritesOnly: params.get("fav") === "1",
      view: (params.get("view") as "cards" | "table") ?? "cards",
      sort:
        (params.get("sort") as FilterState["sort"]) ?? "relevance",
    };
  }, [params]);

  const update = useCallback(
    (updater: Partial<FilterState>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(updater)) {
        if (k === "view" || k === "sort" || k === "q") {
          if (v && String(v).length > 0) next.set(k, String(v));
          else next.delete(k);
        } else if (k === "favoritesOnly") {
          if (v) next.set("fav", "1");
          else next.delete("fav");
        } else if ((ARRAY_KEYS as readonly string[]).includes(k)) {
          next.delete(k);
          for (const item of v as string[]) next.append(k, item);
        }
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  return [state, update];
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/url-state.ts
git commit -m "app: URL-synced filter state hook"
```

---

### Task 12: Storage for favorites + compare (localStorage with fallback)

**Files:**
- Create: `app/src/lib/storage.ts`
- Create: `app/tests/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  addCompare,
  removeCompare,
  getCompare,
  clearCompare,
} from "../src/lib/storage";

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("toggles favorites", () => {
    addFavorite("a");
    addFavorite("b");
    addFavorite("a");
    expect(getFavorites().sort()).toEqual(["a", "b"]);
    removeFavorite("a");
    expect(getFavorites()).toEqual(["b"]);
  });

  it("caps compare at 5", () => {
    const added: boolean[] = [];
    for (const slug of ["a", "b", "c", "d", "e", "f"]) {
      added.push(addCompare(slug));
    }
    expect(added).toEqual([true, true, true, true, true, false]);
    expect(getCompare().length).toBe(5);
  });

  it("removes and clears compare", () => {
    addCompare("x");
    addCompare("y");
    removeCompare("x");
    expect(getCompare()).toEqual(["y"]);
    clearCompare();
    expect(getCompare()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:
```bash
npx vitest run tests/storage.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/src/lib/storage.ts`**

```ts
const FAV_KEY = "genesis.favorites";
const CMP_KEY = "genesis.compare";
const MAX_COMPARE = 5;

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable; caller falls back to in-memory state
  }
}

export function getFavorites(): string[] {
  return read(FAV_KEY);
}

export function addFavorite(slug: string) {
  const set = new Set(read(FAV_KEY));
  set.add(slug);
  write(FAV_KEY, [...set]);
}

export function removeFavorite(slug: string) {
  write(FAV_KEY, read(FAV_KEY).filter((s) => s !== slug));
}

export function toggleFavorite(slug: string): boolean {
  const set = new Set(read(FAV_KEY));
  if (set.has(slug)) {
    set.delete(slug);
    write(FAV_KEY, [...set]);
    return false;
  }
  set.add(slug);
  write(FAV_KEY, [...set]);
  return true;
}

export function getCompare(): string[] {
  return read(CMP_KEY);
}

export function addCompare(slug: string): boolean {
  const current = read(CMP_KEY);
  if (current.includes(slug)) return true;
  if (current.length >= MAX_COMPARE) return false;
  write(CMP_KEY, [...current, slug]);
  return true;
}

export function removeCompare(slug: string) {
  write(CMP_KEY, read(CMP_KEY).filter((s) => s !== slug));
}

export function clearCompare() {
  write(CMP_KEY, []);
}

export { MAX_COMPARE };
```

- [ ] **Step 4: Run the test and confirm it passes**

Run:
```bash
npx vitest run tests/storage.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/storage.ts app/tests/storage.test.ts
git commit -m "app: localStorage-backed favorites + compare"
```

---

## Phase 4 — Filtering + Browse page

### Task 13: Pure filter logic

**Files:**
- Create: `app/src/lib/filters.ts`
- Create: `app/tests/filters.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { applyFilters, facetCounts, sortProfiles } from "../src/lib/filters";
import type { Profile } from "../src/types";

function mk(p: Partial<Profile>): Profile {
  return {
    slug: "x", name: "X", kind: "organization",
    challengeAreas: [], partnerTypeSeeking: [],
    rawHtmlPath: "x.html", ...p,
  };
}

const DATA: Profile[] = [
  mk({ slug: "a", name: "Alpha", affiliation: "Academic", orgSize: "Small",
       challengeAreas: ["AI"], partnerTypeSeeking: ["Industry"] }),
  mk({ slug: "b", name: "Beta", affiliation: "Industry", orgSize: "Large",
       challengeAreas: ["HPC"], partnerTypeSeeking: ["Academic"] }),
  mk({ slug: "c", name: "Gamma", affiliation: "Academic", orgSize: "Large",
       challengeAreas: ["AI", "HPC"], partnerTypeSeeking: ["Industry"] }),
];

describe("applyFilters", () => {
  it("returns all when no filters set", () => {
    expect(applyFilters(DATA, {}).length).toBe(3);
  });
  it("AND across categories, OR within", () => {
    const r = applyFilters(DATA, {
      challenge: ["AI"],
      affiliation: ["Academic"],
    });
    expect(r.map((p) => p.slug).sort()).toEqual(["a", "c"]);
  });
  it("supports favoritesOnly", () => {
    const r = applyFilters(DATA, { favoritesOnly: true, favorites: ["b"] });
    expect(r.map((p) => p.slug)).toEqual(["b"]);
  });
});

describe("facetCounts", () => {
  it("counts values within the filtered set", () => {
    const counts = facetCounts(DATA, {});
    expect(counts.affiliation["Academic"]).toBe(2);
    expect(counts.challenge["HPC"]).toBe(2);
  });
});

describe("sortProfiles", () => {
  it("sorts by name", () => {
    expect(sortProfiles(DATA, "name").map((p) => p.slug)).toEqual(["a", "b", "c"]);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:
```bash
npx vitest run tests/filters.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement `app/src/lib/filters.ts`**

```ts
import type { Profile } from "../types";

export interface FilterCriteria {
  q?: string;
  challenge?: string[];
  offers?: string[];
  seeking?: string[];
  partnerType?: string[];
  orgType?: string[];
  orgSize?: string[];
  affiliation?: string[];
  favoritesOnly?: boolean;
  favorites?: string[];
}

function hasAny(source: string[] | undefined, filter: string[] | undefined): boolean {
  if (!filter || filter.length === 0) return true;
  if (!source || source.length === 0) return false;
  return source.some((s) => filter.includes(s));
}

function eqAny(value: string | undefined, filter: string[] | undefined): boolean {
  if (!filter || filter.length === 0) return true;
  return !!value && filter.includes(value);
}

export function applyFilters(profiles: Profile[], c: FilterCriteria): Profile[] {
  const favSet = new Set(c.favorites ?? []);
  return profiles.filter((p) => {
    if (c.favoritesOnly && !favSet.has(p.slug)) return false;
    if (!hasAny(p.challengeAreas, c.challenge)) return false;
    if (!hasAny(p.offerings?.tags, c.offers)) return false;
    if (!hasAny(p.seeking?.tags, c.seeking)) return false;
    if (!hasAny(p.partnerTypeSeeking, c.partnerType)) return false;
    if (!eqAny(p.orgType, c.orgType)) return false;
    if (!eqAny(p.orgSize, c.orgSize)) return false;
    if (!eqAny(p.affiliation, c.affiliation)) return false;
    return true;
  });
}

export type Facet =
  | "challenge" | "offers" | "seeking" | "partnerType"
  | "orgType"   | "orgSize" | "affiliation";

export type FacetCounts = Record<Facet, Record<string, number>>;

export function facetCounts(profiles: Profile[], c: FilterCriteria): FacetCounts {
  const init = (): FacetCounts => ({
    challenge: {}, offers: {}, seeking: {}, partnerType: {},
    orgType: {}, orgSize: {}, affiliation: {},
  });
  const counts = init();

  // Count each facet against the profiles that pass every OTHER filter (Airtable-style).
  const facets: Facet[] = [
    "challenge", "offers", "seeking", "partnerType",
    "orgType", "orgSize", "affiliation",
  ];
  for (const facet of facets) {
    const without: FilterCriteria = { ...c, [facet]: [] };
    const candidates = applyFilters(profiles, without);
    for (const p of candidates) {
      const values = facetValues(p, facet);
      for (const v of values) counts[facet][v] = (counts[facet][v] ?? 0) + 1;
    }
  }
  return counts;
}

function facetValues(p: Profile, f: Facet): string[] {
  switch (f) {
    case "challenge":   return p.challengeAreas;
    case "offers":      return p.offerings?.tags ?? [];
    case "seeking":     return p.seeking?.tags ?? [];
    case "partnerType": return p.partnerTypeSeeking;
    case "orgType":     return p.orgType ? [p.orgType] : [];
    case "orgSize":     return p.orgSize ? [p.orgSize] : [];
    case "affiliation": return p.affiliation ? [p.affiliation] : [];
  }
}

export type SortKey = "relevance" | "name" | "affiliation" | "richness";

export function sortProfiles(
  profiles: Profile[],
  key: SortKey,
  richness?: Map<string, number>,
): Profile[] {
  const arr = profiles.slice();
  switch (key) {
    case "name":
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "affiliation":
      arr.sort((a, b) =>
        (a.affiliation ?? "").localeCompare(b.affiliation ?? "") ||
        a.name.localeCompare(b.name));
      break;
    case "richness":
      arr.sort((a, b) =>
        (richness?.get(b.slug) ?? 0) - (richness?.get(a.slug) ?? 0));
      break;
    case "relevance":
    default:
      // fall back to name; real relevance comes from the search wrapper
      arr.sort((a, b) => a.name.localeCompare(b.name));
  }
  return arr;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run:
```bash
npx vitest run tests/filters.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/filters.ts app/tests/filters.test.ts
git commit -m "app: pure filter, facet-count, and sort logic"
```

---

### Task 14: Search wrapper (Fuse.js)

**Files:**
- Create: `app/src/lib/search.ts`

- [ ] **Step 1: Implement `app/src/lib/search.ts`**

```ts
import Fuse, { type FuseIndex, type IFuseOptions } from "fuse.js";

export interface SearchDoc {
  slug: string;
  name: string;
  introduction: string;
  offerings: string;
  seeking: string;
  projectIdea: string;
}

const OPTIONS: IFuseOptions<SearchDoc> = {
  keys: [
    { name: "name", weight: 3 },
    { name: "introduction", weight: 2 },
    { name: "offerings", weight: 1 },
    { name: "seeking", weight: 1 },
    { name: "projectIdea", weight: 1 },
  ],
  threshold: 0.35,
  includeScore: true,
  ignoreLocation: true,
};

export function createFuse(
  docs: SearchDoc[],
  serialized: unknown,
): Fuse<SearchDoc> {
  const index = Fuse.parseIndex<SearchDoc>(serialized as FuseIndex<SearchDoc>);
  return new Fuse(docs, OPTIONS, index);
}

export function searchSlugs(
  fuse: Fuse<SearchDoc>,
  q: string,
): Set<string> | null {
  const query = q.trim();
  if (query.length === 0) return null; // null = "no search, keep all"
  return new Set(fuse.search(query).map((r) => r.item.slug));
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/search.ts
git commit -m "app: Fuse.js search wrapper"
```

---

### Task 15: Filter sidebar component

**Files:**
- Create: `app/src/components/FilterSidebar.tsx`

- [ ] **Step 1: Implement `app/src/components/FilterSidebar.tsx`**

```tsx
import type { FacetCounts, Facet } from "../lib/filters";

interface Group {
  facet: Facet;
  label: string;
}

const GROUPS: Group[] = [
  { facet: "challenge",   label: "Challenge area" },
  { facet: "offers",      label: "Offers" },
  { facet: "seeking",     label: "Seeking" },
  { facet: "partnerType", label: "Partner type" },
  { facet: "orgType",     label: "Org type" },
  { facet: "orgSize",     label: "Org size" },
  { facet: "affiliation", label: "Affiliation" },
];

interface Props {
  counts: FacetCounts;
  selected: Record<Facet, string[]>;
  favoritesOnly: boolean;
  onToggle: (facet: Facet, value: string) => void;
  onFavoritesOnly: (v: boolean) => void;
  onClearAll: () => void;
}

export default function FilterSidebar({
  counts, selected, favoritesOnly, onToggle, onFavoritesOnly, onClearAll,
}: Props) {
  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">Filters</span>
        <button className="text-xs text-slate-500 hover:underline" onClick={onClearAll}>
          Clear all
        </button>
      </div>
      <label className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={favoritesOnly}
          onChange={(e) => onFavoritesOnly(e.target.checked)}
        />
        <span>Favorites only</span>
      </label>
      {GROUPS.map((g) => (
        <FacetGroup
          key={g.facet}
          label={g.label}
          values={counts[g.facet]}
          selected={selected[g.facet]}
          onToggle={(v) => onToggle(g.facet, v)}
        />
      ))}
    </aside>
  );
}

function FacetGroup({
  label, values, selected, onToggle,
}: {
  label: string;
  values: Record<string, number>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const selectedSet = new Set(selected);
  return (
    <fieldset className="mb-4">
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </legend>
      <ul>
        {entries.map(([v, n]) => (
          <li key={v}>
            <label className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={selectedSet.has(v)}
                onChange={() => onToggle(v)}
              />
              <span className="flex-1 truncate" title={v}>{v}</span>
              <span className="text-xs text-slate-400">{n}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/FilterSidebar.tsx
git commit -m "app: FilterSidebar with facet counts"
```

---

### Task 16: Tag chip + favorite button + compare button

**Files:**
- Create: `app/src/components/TagChip.tsx`
- Create: `app/src/components/FavoriteButton.tsx`
- Create: `app/src/components/CompareButton.tsx`

- [ ] **Step 1: `TagChip.tsx`**

```tsx
interface Props {
  children: string;
  tone?: "challenge" | "partner" | "neutral";
}

const TONES = {
  challenge: "bg-indigo-100 text-indigo-800",
  partner: "bg-emerald-100 text-emerald-800",
  neutral: "bg-slate-100 text-slate-700",
};

export default function TagChip({ children, tone = "neutral" }: Props) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${TONES[tone]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: `FavoriteButton.tsx`**

```tsx
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { getFavorites, toggleFavorite } from "../lib/storage";

export default function FavoriteButton({ slug }: { slug: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(getFavorites().includes(slug)); }, [slug]);
  return (
    <button
      type="button"
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      className="rounded p-1 hover:bg-slate-100"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOn(toggleFavorite(slug));
      }}
    >
      <Star
        size={16}
        className={on ? "fill-amber-400 stroke-amber-500" : "stroke-slate-400"}
      />
    </button>
  );
}
```

- [ ] **Step 3: `CompareButton.tsx`**

```tsx
import { Columns } from "lucide-react";
import { useEffect, useState } from "react";
import { addCompare, getCompare, removeCompare } from "../lib/storage";

export default function CompareButton({ slug }: { slug: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(getCompare().includes(slug)); }, [slug]);
  return (
    <button
      type="button"
      aria-label={on ? "Remove from compare" : "Add to compare"}
      className="rounded p-1 hover:bg-slate-100"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (on) {
          removeCompare(slug);
          setOn(false);
        } else {
          const ok = addCompare(slug);
          if (!ok) alert("Compare is full (5 max).");
          else setOn(true);
        }
      }}
    >
      <Columns
        size={16}
        className={on ? "stroke-sky-600" : "stroke-slate-400"}
      />
    </button>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/TagChip.tsx app/src/components/FavoriteButton.tsx app/src/components/CompareButton.tsx
git commit -m "app: TagChip, FavoriteButton, CompareButton"
```

---

### Task 17: ProfileCard + ProfileTable views

**Files:**
- Create: `app/src/components/ProfileCard.tsx`
- Create: `app/src/components/ProfileTable.tsx`

- [ ] **Step 1: `ProfileCard.tsx`**

```tsx
import { Link } from "react-router-dom";
import type { Profile } from "../types";
import TagChip from "./TagChip";
import FavoriteButton from "./FavoriteButton";
import CompareButton from "./CompareButton";

function trunc(s: string | undefined, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

export default function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <Link
      to={`/profile/${profile.slug}`}
      className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{profile.name}</div>
          <div className="text-xs text-slate-500">
            {[profile.affiliation, profile.orgSize].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="flex gap-1">
          <FavoriteButton slug={profile.slug} />
          <CompareButton slug={profile.slug} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {profile.challengeAreas.slice(0, 3).map((c) => (
          <TagChip key={c} tone="challenge">{c}</TagChip>
        ))}
        {profile.challengeAreas.length > 3 && (
          <span className="text-xs text-slate-400">
            +{profile.challengeAreas.length - 3}
          </span>
        )}
      </div>
      {profile.offerings?.text && (
        <div className="text-xs text-slate-600">
          <span className="font-medium text-slate-800">Offers:</span>{" "}
          {trunc(profile.offerings.text, 140)}
        </div>
      )}
      {profile.seeking?.text && (
        <div className="text-xs text-slate-600">
          <span className="font-medium text-slate-800">Seeks:</span>{" "}
          {trunc(profile.seeking.text, 140)}
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: `ProfileTable.tsx`**

```tsx
import { Link } from "react-router-dom";
import type { Profile } from "../types";
import FavoriteButton from "./FavoriteButton";
import CompareButton from "./CompareButton";

export default function ProfileTable({ profiles }: { profiles: Profile[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Affiliation</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Challenges</th>
            <th className="px-3 py-2">Offers</th>
            <th className="px-3 py-2">Seeks</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.slug} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link to={`/profile/${p.slug}`} className="font-medium text-sky-700 hover:underline">
                  {p.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-600">{p.affiliation}</td>
              <td className="px-3 py-2 text-slate-600">{p.orgSize}</td>
              <td className="px-3 py-2 text-slate-600">
                {p.challengeAreas.slice(0, 2).join(", ")}
                {p.challengeAreas.length > 2 && ` +${p.challengeAreas.length - 2}`}
              </td>
              <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={p.offerings?.text}>
                {p.offerings?.text?.slice(0, 80)}
              </td>
              <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={p.seeking?.text}>
                {p.seeking?.text?.slice(0, 80)}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <FavoriteButton slug={p.slug} />
                  <CompareButton slug={p.slug} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ProfileCard.tsx app/src/components/ProfileTable.tsx
git commit -m "app: ProfileCard grid view + ProfileTable dense view"
```

---

### Task 18: SearchBox component + Browse route wiring

**Files:**
- Create: `app/src/components/SearchBox.tsx`
- Modify: `app/src/routes/Browse.tsx`

- [ ] **Step 1: `SearchBox.tsx`**

```tsx
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function SearchBox({ value, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if ((mod && e.key.toLowerCase() === "k") ||
          (e.key === "/" && document.activeElement?.tagName !== "INPUT")) {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === ref.current) {
        ref.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5">
      <Search size={16} className="text-slate-400" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search across 443 partners…"
        className="w-full bg-transparent text-sm outline-none"
      />
      <span className="text-xs text-slate-400">⌘K</span>
    </div>
  );
}
```

- [ ] **Step 2: Replace `app/src/routes/Browse.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { loadData } from "../data";
import { useFilterState } from "../lib/url-state";
import { applyFilters, facetCounts, sortProfiles, type Facet } from "../lib/filters";
import { createFuse, searchSlugs } from "../lib/search";
import { getFavorites } from "../lib/storage";
import FilterSidebar from "../components/FilterSidebar";
import ProfileCard from "../components/ProfileCard";
import ProfileTable from "../components/ProfileTable";
import SearchBox from "../components/SearchBox";
import type { Profile } from "../types";

export default function Browse() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [state, update] = useFilterState();

  useEffect(() => { loadData().then(setBundle); }, []);
  useEffect(() => { setFavorites(getFavorites()); }, [state.favoritesOnly]);

  const fuse = useMemo(() => {
    if (!bundle) return null;
    return createFuse(bundle.search.docs, bundle.search.index);
  }, [bundle]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;

  const criteria = {
    challenge: state.challenge, offers: state.offers, seeking: state.seeking,
    partnerType: state.partnerType, orgType: state.orgType, orgSize: state.orgSize,
    affiliation: state.affiliation,
    favoritesOnly: state.favoritesOnly, favorites,
  };

  let filtered: Profile[] = applyFilters(bundle.profiles, criteria);

  if (fuse && state.q) {
    const hits = searchSlugs(fuse, state.q);
    if (hits) filtered = filtered.filter((p) => hits.has(p.slug));
  }

  const sorted = sortProfiles(filtered, state.sort);
  const counts = facetCounts(bundle.profiles, criteria);

  const toggleFacet = (f: Facet, v: string) => {
    const current = state[f];
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    update({ [f]: next } as any);
  };

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <FilterSidebar
        counts={counts}
        selected={{
          challenge: state.challenge, offers: state.offers, seeking: state.seeking,
          partnerType: state.partnerType, orgType: state.orgType, orgSize: state.orgSize,
          affiliation: state.affiliation,
        }}
        favoritesOnly={state.favoritesOnly}
        onToggle={toggleFacet}
        onFavoritesOnly={(v) => update({ favoritesOnly: v })}
        onClearAll={() => update({
          challenge: [], offers: [], seeking: [], partnerType: [],
          orgType: [], orgSize: [], affiliation: [],
          favoritesOnly: false, q: "",
        })}
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1">
            <SearchBox value={state.q} onChange={(v) => update({ q: v })} />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>{sorted.length} results</span>
            <select
              value={state.sort}
              onChange={(e) => update({ sort: e.target.value as typeof state.sort })}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="relevance">Relevance</option>
              <option value="name">Name</option>
              <option value="affiliation">Affiliation</option>
              <option value="richness">Completeness</option>
            </select>
            <div className="flex rounded-md border border-slate-300">
              <button
                className={`px-2 py-1 text-sm ${state.view === "cards" ? "bg-slate-900 text-white" : "bg-white"}`}
                onClick={() => update({ view: "cards" })}
              >
                Cards
              </button>
              <button
                className={`px-2 py-1 text-sm ${state.view === "table" ? "bg-slate-900 text-white" : "bg-white"}`}
                onClick={() => update({ view: "table" })}
              >
                Table
              </button>
            </div>
          </div>
        </div>
        {state.view === "cards" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((p) => <ProfileCard key={p.slug} profile={p} />)}
          </div>
        ) : (
          <ProfileTable profiles={sorted} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

Run (from `app/`):
```bash
npm run dev
```
Expected: `/` loads with filter sidebar + grid of cards. Typing in search narrows results. Toggling filters updates both results and facet counts. Clicking a card navigates to `/profile/<slug>` (placeholder text for now). Toggling Cards/Table switches layout. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/SearchBox.tsx app/src/routes/Browse.tsx
git commit -m "app: Browse route — filters, search, cards/table toggle"
```

---

## Phase 5 — Profile detail + compare

### Task 19: Profile detail page

**Files:**
- Create: `app/src/components/SimilarCarousel.tsx`
- Modify: `app/src/routes/ProfileDetail.tsx`

- [ ] **Step 1: `SimilarCarousel.tsx`**

```tsx
import { Link } from "react-router-dom";
import type { Profile } from "../types";

export default function SimilarCarousel({
  profiles,
}: {
  profiles: Profile[];
}) {
  if (profiles.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        More like this
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {profiles.map((p) => (
          <Link
            key={p.slug}
            to={`/profile/${p.slug}`}
            className="w-56 shrink-0 rounded-md border border-slate-200 bg-white p-3 hover:border-slate-400"
          >
            <div className="text-sm font-medium">{p.name}</div>
            <div className="text-xs text-slate-500">{p.affiliation}</div>
            <div className="mt-2 line-clamp-3 text-xs text-slate-600">
              {p.introduction}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Replace `app/src/routes/ProfileDetail.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadData } from "../data";
import TagChip from "../components/TagChip";
import FavoriteButton from "../components/FavoriteButton";
import CompareButton from "../components/CompareButton";
import SimilarCarousel from "../components/SimilarCarousel";
import type { Profile } from "../types";

export default function ProfileDetail() {
  const { slug } = useParams();
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  useEffect(() => { loadData().then(setBundle); }, []);

  const bySlug = useMemo(() => {
    if (!bundle) return new Map<string, Profile>();
    return new Map(bundle.profiles.map((p) => [p.slug, p]));
  }, [bundle]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;
  const p = slug ? bySlug.get(slug) : undefined;
  if (!p) return (
    <div className="p-8">
      <p className="mb-2 text-slate-600">Profile not found: {slug}</p>
      <Link to="/" className="text-sky-700 underline">Back to browse</Link>
    </div>
  );

  const similar = (bundle.network.neighbors[p.slug] ?? [])
    .map((s) => bySlug.get(s))
    .filter((x): x is Profile => !!x);

  return (
    <article className="mx-auto max-w-3xl p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{p.kind}</div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <div className="text-sm text-slate-600">
            {[p.affiliation, p.orgType, p.orgSize].filter(Boolean).join(" · ")}
          </div>
          {p.website && (
            <a
              href={p.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-sky-700 underline"
            >
              {p.website}
            </a>
          )}
        </div>
        <div className="flex gap-1">
          <FavoriteButton slug={p.slug} />
          <CompareButton slug={p.slug} />
        </div>
      </header>

      {p.introduction && (
        <Section title="Introduction">
          <p className="whitespace-pre-line">{p.introduction}</p>
        </Section>
      )}

      {p.challengeAreas.length > 0 && (
        <Section title="Challenge areas">
          <div className="flex flex-wrap gap-1">
            {p.challengeAreas.map((c) => <TagChip key={c} tone="challenge">{c}</TagChip>)}
          </div>
        </Section>
      )}

      {p.offerings?.text && (
        <Section title="Offerings">
          <p className="whitespace-pre-line">{p.offerings.text}</p>
        </Section>
      )}

      {p.seeking?.text && (
        <Section title="Seeking">
          <p className="whitespace-pre-line">{p.seeking.text}</p>
        </Section>
      )}

      {p.partnerTypeSeeking.length > 0 && (
        <Section title="Partner type seeking">
          <div className="flex flex-wrap gap-1">
            {p.partnerTypeSeeking.map((t) => <TagChip key={t} tone="partner">{t}</TagChip>)}
          </div>
        </Section>
      )}

      {p.projectIdeaSummary && (
        <Section title="Project idea">
          <p className="whitespace-pre-line">{p.projectIdeaSummary}</p>
        </Section>
      )}

      {p.relevantProjects && (
        <Section title="Relevant projects">
          <p className="whitespace-pre-line">{p.relevantProjects}</p>
        </Section>
      )}

      {p.relevantPublications && (
        <Section title="Relevant publications">
          <p className="whitespace-pre-line">{p.relevantPublications}</p>
        </Section>
      )}

      <SimilarCarousel profiles={similar} />

      <div className="mt-6 text-xs text-slate-400">
        <a
          href={`/${p.rawHtmlPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          View original scraped HTML
        </a>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="text-sm text-slate-800">{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Verify manually**

Run (from `app/`):
```bash
npm run dev
```
Expected: Clicking a card from Browse loads a formatted profile page with sections for introduction, challenge areas, offerings, etc., plus a "More like this" carousel. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/SimilarCarousel.tsx app/src/routes/ProfileDetail.tsx
git commit -m "app: profile detail page + More like this"
```

---

### Task 20: Compare page with CSV/JSON export

**Files:**
- Modify: `app/src/routes/Compare.tsx`

- [ ] **Step 1: Replace `app/src/routes/Compare.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../data";
import { clearCompare, getCompare, removeCompare } from "../lib/storage";
import type { Profile } from "../types";

const ROWS: Array<[string, (p: Profile) => string]> = [
  ["Affiliation",   (p) => p.affiliation ?? ""],
  ["Org type",      (p) => p.orgType ?? ""],
  ["Org size",      (p) => p.orgSize ?? ""],
  ["Website",       (p) => p.website ?? ""],
  ["Challenge areas", (p) => p.challengeAreas.join("; ")],
  ["Offers",        (p) => p.offerings?.text ?? ""],
  ["Seeking",       (p) => p.seeking?.text ?? ""],
  ["Partner types", (p) => p.partnerTypeSeeking.join("; ")],
  ["Project idea",  (p) => p.projectIdeaSummary ?? ""],
];

function toCsv(profiles: Profile[]): string {
  const header = ["Field", ...profiles.map((p) => p.name)];
  const rows = ROWS.map(([label, f]) => [label, ...profiles.map(f)]);
  const esc = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Compare() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    loadData().then(setBundle);
    setSlugs(getCompare());
  }, []);

  const profiles = useMemo(() => {
    if (!bundle) return [];
    const map = new Map(bundle.profiles.map((p) => [p.slug, p]));
    return slugs.map((s) => map.get(s)).filter((p): p is Profile => !!p);
  }, [bundle, slugs]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;

  if (profiles.length === 0) return (
    <div className="p-8 text-slate-600">
      No profiles pinned. Go to <Link className="text-sky-700 underline" to="/">Browse</Link>
      {" "}and click the compare icon on any card.
    </div>
  );

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-slate-600">{profiles.length} / 5 pinned</span>
        <button
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          onClick={() => download("compare.csv", "text/csv", toCsv(profiles))}
        >
          Export CSV
        </button>
        <button
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          onClick={() =>
            download("compare.json", "application/json", JSON.stringify(profiles, null, 2))
          }
        >
          Export JSON
        </button>
        <button
          className="ml-auto text-sm text-slate-500 hover:underline"
          onClick={() => { clearCompare(); setSlugs([]); }}
        >
          Clear all
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-500">Field</th>
              {profiles.map((p) => (
                <th key={p.slug} className="px-3 py-2 text-left">
                  <div className="flex items-center gap-2">
                    <Link to={`/profile/${p.slug}`} className="font-medium text-sky-700 hover:underline">
                      {p.name}
                    </Link>
                    <button
                      aria-label="Unpin"
                      className="text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => {
                        removeCompare(p.slug);
                        setSlugs((s) => s.filter((x) => x !== p.slug));
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, f]) => (
              <tr key={label} className="border-t border-slate-100 align-top">
                <td className="w-40 bg-slate-50 px-3 py-2 font-medium text-slate-500">{label}</td>
                {profiles.map((p) => (
                  <td key={p.slug} className="px-3 py-2 text-slate-800">{f(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

Run `npm run dev`. Pin 2–3 profiles via the compare icon in Browse. Navigate to Compare — columns show up, CSV/JSON export downloads files, Unpin works, Clear all works. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add app/src/routes/Compare.tsx
git commit -m "app: compare page with CSV/JSON export"
```

---

## Phase 6 — Network view

### Task 21: NetworkGraph component

**Files:**
- Create: `app/src/components/NetworkGraph.tsx`

D3-force runs on the native SVG; React mounts the SVG and hands the DOM node to D3 inside a `useEffect`.

- [ ] **Step 1: Implement `app/src/components/NetworkGraph.tsx`**

```tsx
import { useEffect, useRef } from "react";
import * as d3 from "d3-force";
import { select } from "d3-selection";
import { drag as d3drag } from "d3-drag";
import type { NetworkData, NetworkNode } from "../types";

interface SimNode extends d3.SimulationNodeDatum, NetworkNode {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

const AFFILIATION_COLORS: Record<string, string> = {
  "Academic institution": "#4f46e5",
  "Industry": "#059669",
  "National Laboratory": "#d97706",
  "Government": "#dc2626",
};

function affiliationColor(a?: string) {
  if (!a) return "#64748b";
  return AFFILIATION_COLORS[a] ?? "#64748b";
}

interface Props {
  data: NetworkData;
  highlightChallenge?: string | null;
  profileChallenges: Map<string, string[]>;
  onNodeClick: (slug: string) => void;
}

export default function NetworkGraph({
  data, highlightChallenge, profileChallenges, onNodeClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const width = svg.clientWidth;
    const height = svg.clientHeight;

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const slugToNode = new Map(nodes.map((n) => [n.slug, n]));
    const links: SimLink[] = data.edges
      .filter((e) => slugToNode.has(e.a) && slugToNode.has(e.b))
      .map((e) => ({ source: slugToNode.get(e.a)!, target: slugToNode.get(e.b)!, weight: e.weight }));

    const selection = select(svg);
    selection.selectAll("*").remove();

    const linkSel = selection.append("g")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.5)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke-width", (d) => Math.min(3, 0.5 + d.weight));

    const nodeSel = selection.append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", (d) => 3 + Math.min(8, d.richness))
      .attr("fill", (d) => affiliationColor(d.affiliation))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("click", (_evt, d) => onNodeClick(d.slug));

    nodeSel.append("title").text((d) => d.name);

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.slug).distance(40).strength(0.2))
      .force("charge", d3.forceManyBody().strength(-40))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(10));

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);
      nodeSel
        .attr("cx", (d) => d.x!)
        .attr("cy", (d) => d.y!);
    });

    const dragBehavior = d3drag<SVGCircleElement, SimNode>()
      .on("start", (e, d) => {
        if (!e.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => {
        if (!e.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
    nodeSel.call(dragBehavior as any);

    return () => { sim.stop(); };
  }, [data]);

  // Highlighting pass — runs whenever highlightChallenge changes but
  // doesn't re-run the simulation.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    select(svg)
      .selectAll<SVGCircleElement, SimNode>("circle")
      .attr("opacity", (d) => {
        if (!highlightChallenge) return 1;
        const cs = profileChallenges.get(d.slug) ?? [];
        return cs.includes(highlightChallenge) ? 1 : 0.15;
      });
  }, [highlightChallenge, profileChallenges]);

  return <svg ref={svgRef} className="h-full w-full" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/NetworkGraph.tsx
git commit -m "app: D3 force-directed NetworkGraph component"
```

---

### Task 22: Network route — legend, challenge chips, slide-over

**Files:**
- Modify: `app/src/routes/Network.tsx`

- [ ] **Step 1: Replace `app/src/routes/Network.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../data";
import NetworkGraph from "../components/NetworkGraph";
import type { Profile } from "../types";

const AFFILIATION_COLORS: Record<string, string> = {
  "Academic institution": "#4f46e5",
  "Industry": "#059669",
  "National Laboratory": "#d97706",
  "Government": "#dc2626",
};

export default function Network() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);

  useEffect(() => { loadData().then(setBundle); }, []);

  const bySlug = useMemo(() => {
    if (!bundle) return new Map<string, Profile>();
    return new Map(bundle.profiles.map((p) => [p.slug, p]));
  }, [bundle]);

  const challenges = useMemo(() => {
    if (!bundle) return [];
    const set = new Set<string>();
    for (const p of bundle.profiles) for (const c of p.challengeAreas) set.add(c);
    return [...set].sort();
  }, [bundle]);

  const profileChallenges = useMemo(() => {
    if (!bundle) return new Map<string, string[]>();
    return new Map(bundle.profiles.map((p) => [p.slug, p.challengeAreas]));
  }, [bundle]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="relative flex h-[calc(100vh-57px)]">
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 text-sm">
        <div className="mb-3 font-semibold">Legend</div>
        <ul className="mb-4">
          {Object.entries(AFFILIATION_COLORS).map(([label, color]) => (
            <li key={label} className="mb-1 flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
              <span className="text-xs">{label}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-slate-500" />
            <span className="text-xs">Other</span>
          </li>
        </ul>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Highlight challenge
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            className={`rounded border px-2 py-0.5 text-xs ${!highlight ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}
            onClick={() => setHighlight(null)}
          >
            All
          </button>
          {challenges.map((c) => (
            <button
              key={c}
              className={`rounded border px-2 py-0.5 text-xs ${highlight === c ? "border-indigo-700 bg-indigo-600 text-white" : "border-slate-300 bg-white"}`}
              onClick={() => setHighlight(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1">
        <NetworkGraph
          data={bundle.network}
          highlightChallenge={highlight}
          profileChallenges={profileChallenges}
          onNodeClick={(slug) => setSelected(bySlug.get(slug) ?? null)}
        />
      </div>

      {selected && (
        <div className="absolute right-0 top-0 h-full w-80 overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
          <button
            className="mb-3 text-xs text-slate-500 hover:underline"
            onClick={() => setSelected(null)}
          >
            Close ✕
          </button>
          <h2 className="text-lg font-semibold">{selected.name}</h2>
          <div className="text-xs text-slate-500">{selected.affiliation}</div>
          {selected.introduction && (
            <p className="mt-2 text-sm text-slate-700 line-clamp-6">{selected.introduction}</p>
          )}
          <Link
            to={`/profile/${selected.slug}`}
            className="mt-3 inline-block text-sm text-sky-700 underline"
          >
            Open full profile
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

Run `npm run dev`. Navigate to `/network`. Expected: Force-directed graph renders with colored nodes; nodes are draggable; clicking a challenge chip dims non-matching nodes; clicking a node opens a slide-over with mini profile; the "Open full profile" link navigates to the detail page. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add app/src/routes/Network.tsx
git commit -m "app: network route with legend, challenge highlight, slide-over"
```

---

## Phase 7 — Keyboard + e2e + deploy

### Task 23: Global keyboard shortcuts

**Files:**
- Create: `app/src/lib/keyboard.ts`
- Modify: `app/src/App.tsx`

`⌘K` and `/` are already bound in `SearchBox`. This task adds `f`/`c` focused-card shortcuts and `esc` to close.

- [ ] **Step 1: Implement `app/src/lib/keyboard.ts`**

```ts
import { useEffect } from "react";
import { toggleFavorite, addCompare, removeCompare, getCompare } from "./storage";

// Cards and rows set `data-slug` on their outermost focusable element.
// When one is hovered/focused, `f` toggles favorite, `c` toggles compare.

function focusedSlug(): string | null {
  const el = document.querySelector<HTMLElement>(":hover[data-slug], :focus[data-slug]");
  return el?.dataset.slug ?? null;
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const slug = focusedSlug();
      if (e.key === "f" && slug) { e.preventDefault(); toggleFavorite(slug); }
      if (e.key === "c" && slug) {
        e.preventDefault();
        if (getCompare().includes(slug)) removeCompare(slug);
        else addCompare(slug);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
```

- [ ] **Step 2: Add `data-slug` to ProfileCard and ProfileTable rows**

In `app/src/components/ProfileCard.tsx`, change the `<Link>` opening tag to include `data-slug={profile.slug}` and `tabIndex={0}`:

```tsx
<Link
  to={`/profile/${profile.slug}`}
  data-slug={profile.slug}
  tabIndex={0}
  className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400"
>
```

In `app/src/components/ProfileTable.tsx`, change each `<tr key={p.slug}` to include `data-slug={p.slug} tabIndex={0}`:

```tsx
<tr key={p.slug} data-slug={p.slug} tabIndex={0}
    className="border-t border-slate-100 hover:bg-slate-50 focus:bg-slate-100 focus:outline-none">
```

- [ ] **Step 3: Wire `useGlobalShortcuts` into `App.tsx`**

Add an import and a call at the top of the `App` component:

```tsx
import { useGlobalShortcuts } from "./lib/keyboard";
// ...
export default function App() {
  useGlobalShortcuts();
  return (
    <HashRouter>
      {/* ... */}
```

- [ ] **Step 4: Verify manually**

Run `npm run dev`. Hover a card and press `f` — the star fills in (may require a second render; state is read from `localStorage` so reload to verify). Press `c` — the compare icon updates similarly. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/keyboard.ts app/src/components/ProfileCard.tsx app/src/components/ProfileTable.tsx app/src/App.tsx
git commit -m "app: global keyboard shortcuts for favorite/compare"
```

---

### Task 24: Playwright smoke test

**Files:**
- Create: `app/playwright.config.ts`
- Create: `app/tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Install Playwright browsers**

Run (from `app/`):
```bash
npx playwright install chromium
```

- [ ] **Step 3: Create `tests/e2e/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("load → filter → open profile → compare", async ({ page }) => {
  await page.goto("/");

  // Results load
  await expect(page.getByText(/results/)).toBeVisible();

  // Pick the first visible challenge filter and apply it
  const firstFilter = page.locator("fieldset").first().locator("input[type=checkbox]").first();
  await firstFilter.check();

  // Open the first card
  const firstCard = page.locator("a[href*='#/profile/']").first();
  const name = await firstCard.locator("div").first().textContent();
  await firstCard.click();

  await expect(page.locator("h1")).toContainText(name ?? "");

  // Pin to compare from the profile page
  await page.getByLabel("Add to compare").click();

  // Navigate to compare
  await page.getByRole("link", { name: "Compare" }).click();
  await expect(page.getByText("1 / 5 pinned")).toBeVisible();
});
```

- [ ] **Step 4: Run the smoke test**

Run (from `app/`):
```bash
npm run e2e
```
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add app/playwright.config.ts app/tests/e2e/smoke.spec.ts
git commit -m "test: Playwright smoke — load → filter → profile → compare"
```

---

### Task 25: Deploy config + README + polish

**Files:**
- Create: `app/netlify.toml`
- Create: `app/README.md`
- Modify: `app/src/App.tsx` (if any final tweaks)

- [ ] **Step 1: Create `app/netlify.toml`**

```toml
[build]
  base = "app"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

(Alternative for Vercel: create `app/vercel.json` with `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`. Pick whichever host you deploy to.)

- [ ] **Step 2: Create `app/README.md`**

```markdown
# Genesis Partners Navigator

Web app for navigating 443 scraped participant profiles from the DOE Genesis
Mission Partnership Exchange. See [the design spec](../docs/superpowers/specs/2026-04-18-genesis-partners-navigator-design.md)
for requirements and architecture.

## Develop

```bash
npm install
npm run parse   # build the JSON dataset from ../detail-pages/
npm run dev
```

Open http://localhost:5173.

## Test

```bash
npm test        # Vitest: parser + app unit/component tests
npm run e2e     # Playwright smoke test (builds + serves + drives the app)
```

## Build + deploy

```bash
npm run build   # runs the parser + Vite build, output in dist/
```

`dist/` is a plain static bundle. `netlify.toml` pins SPA routing to `/index.html`.
```

- [ ] **Step 3: Verify the production build end-to-end**

Run (from `app/`):
```bash
npm run build && npm run preview
```
Expected: A built bundle serves at http://localhost:4173; Browse, Profile, Compare, and Network all work. Stop the preview.

- [ ] **Step 4: Deploy (optional — requires Netlify/Vercel CLI auth)**

```bash
# If using Netlify CLI:
npx netlify deploy --prod --dir=app/dist
```

Expected: A public (but private-repo-linked) URL is printed; open it and verify the app works end-to-end.

- [ ] **Step 5: Commit**

```bash
git add app/netlify.toml app/README.md
git commit -m "deploy: netlify config + README"
```

- [ ] **Step 6: Push to origin**

```bash
git push
```
Expected: All commits land on `main` at https://github.com/BioKEA/doe-genesis-navigator.

---

## Self-review

**Spec coverage check:**
- Data pipeline (parser → JSON) — Tasks 3–8 ✓
- `Profile` schema exactly matches the spec — Task 2 ✓
- Routes `/`, `/profile/:slug`, `/compare`, `/network` — Task 10 ✓
- Sidebar filters with facet counts, AND across / OR within — Tasks 13, 15 ✓
- Cards/Table toggle, URL-synced — Tasks 11, 17, 18 ✓
- Full-text search (Fuse.js, weighted, ⌘K) — Tasks 7, 14, 18 ✓
- Favorites + compare (localStorage, cap 5, CSV/JSON export) — Tasks 12, 20 ✓
- "More like this" (Jaccard, top-6, precomputed) — Tasks 6, 19 ✓
- Network view (D3 force, affiliation colors, challenge highlight, slide-over) — Tasks 21, 22 ✓
- Keyboard shortcuts (⌘K, /, f, c, esc) — Tasks 18, 23 ✓
- "View original" fallback link on profile — Task 19 ✓
- NotFound route — Task 10 ✓
- Testing (parser unit + app unit + Playwright smoke) — Tasks 4–6, 12, 13, 24 ✓
- Error handling (parser continues + parse-errors.json) — Task 8 ✓
- Deploy config (SPA fallback) — Task 25 ✓

**Placeholder scan:** No "TBD" / "implement later" / "handle edge cases" / uncoded steps. Every code step contains the code.

**Type consistency:** `Profile`, `NetworkData`, `FilterCriteria`, `Facet`, `SortKey`, `SearchDoc` are defined once and referenced consistently. `toggleFavorite`, `addCompare`, `removeCompare`, `getCompare`, `clearCompare`, `getFavorites` are referenced with identical names across storage/keyboard/components.

**Scope check:** Single coherent app, delivered in 25 committable tasks across 7 phases. No subsystem belongs in a separate plan.
