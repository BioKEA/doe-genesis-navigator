# Plan 3 — Canvas MVP + Match Overlay

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 4-tab app with a single graph-first Canvas that renders the bipartite partner↔concept graph plus the offer→seek match overlay (pink edges, top-K slider, reciprocity highlight). D lens, onboarding, and compare overlay defer to later plans.

**Architecture:** A single `/` Canvas route composing `<LeftPane>` (filters + match controls) + `<GraphCanvas>` (sigma.js WebGL renderer over a graphology graph) + `<RightPane>` (selected-entity card). Layout is computed once with D3-force in a Web Worker and cached in `localStorage` keyed by a hash of the input data. State lives in a Zustand store. The `/profile/:slug` deep link renders the same Canvas with the right pane anchored on `slug`. Legacy `/browse`, `/network`, `/compare`, plus the standalone `ProfileDetail` route, are deleted.

**Tech Stack:** React 19, TypeScript, Vite, sigma.js, graphology, d3-force (in a Worker), Zustand, Tailwind. Existing Vitest + React Testing Library + Playwright stack.

**Spec source:** `docs/superpowers/specs/2026-05-02-knowledge-graph-redesign-design.md` §§ 4, 8, 10.

---

## File Structure

**Create:**
- `app/src/canvas/GraphCanvas.tsx` — sigma renderer + interaction handlers
- `app/src/canvas/LeftPane.tsx` — concept-category chips, match toggle, top-K slider, reciprocity toggle
- `app/src/canvas/RightPane.tsx` — partner card / concept card
- `app/src/canvas/lib/types.ts` — `CanvasData`, `NodeKind`, `NodeAttrs`, `EdgeKind`, `EdgeAttrs`
- `app/src/canvas/lib/load-canvas-data.ts` — fetch + parse `concepts.json`, `profile-concepts.json`, `matches.json`, `profiles.json`
- `app/src/canvas/lib/build-graph.ts` — pure: data → graphology graph (bipartite only)
- `app/src/canvas/lib/match-edges.ts` — pure: apply top-K cap to matches, return edges to add
- `app/src/canvas/lib/data-version.ts` — pure: deterministic hash of the four data artifacts
- `app/src/canvas/lib/layout-cache.ts` — `localStorage` get/set keyed by data-version
- `app/src/canvas/lib/layout.ts` — pure D3-force runner (used inside the worker)
- `app/src/canvas/lib/layout-worker.ts` — Web Worker entrypoint
- `app/src/canvas/lib/run-layout.ts` — main-thread orchestration around the worker
- `app/src/canvas/lib/store.ts` — Zustand `useCanvasStore`
- `app/src/routes/Canvas.tsx` — route component (composes the three panes)
- `app/tests/canvas/build-graph.test.ts`
- `app/tests/canvas/match-edges.test.ts`
- `app/tests/canvas/data-version.test.ts`
- `app/tests/canvas/layout-cache.test.ts`
- `app/tests/canvas/layout.test.ts`
- `app/tests/canvas/store.test.ts`
- `app/tests/canvas/LeftPane.test.tsx`
- `app/tests/canvas/RightPane.test.tsx`
- `app/tests/canvas/GraphCanvas.test.tsx`

**Modify:**
- `app/package.json` — add `sigma`, `graphology`, `graphology-types`, `zustand` deps
- `app/src/App.tsx` — collapse to `/`, `/profile/:slug`, `/composer`, `*`
- `app/src/components/TopBar.tsx` — drop tab nav, keep brand + search + stat strip
- `app/src/types.ts` — re-export `Concept`, `ConceptsArtifact`, `ProfileConceptMap`, `Match` together so `canvas/` imports are tidy (already exist; just ensure they remain exported)
- `app/tests/e2e/playwright.config.ts` (path may differ; locate during T14) — adjust to one Canvas smoke test
- `app/tests/e2e/*.spec.ts` — replace Browse/Compare e2e with a single Canvas smoke test

**Delete:**
- `app/src/routes/Browse.tsx`, `Compare.tsx`, `Network.tsx`, `ProfileDetail.tsx`
- `app/src/components/ProfileCard.tsx`, `ProfileTable.tsx`, `CoverageMatrix.tsx`, `SimilarCarousel.tsx`, `FilterSidebar.tsx`
- Any tests that exclusively cover the deleted components/routes

---

## Task 1: Install dependencies

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd app
npm install sigma graphology graphology-types zustand
```

- [ ] **Step 2: Verify versions installed**

Run: `cd app && npm ls sigma graphology zustand --depth=0`
Expected: three lines, each printing a resolved version.

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "feat(canvas): install sigma + graphology + zustand"
```

---

## Task 2: Canvas data types

**Files:**
- Create: `app/src/canvas/lib/types.ts`

- [ ] **Step 1: Write the file**

```ts
import type { Concept, Match, Profile, ProfileConceptMap } from "../../types";

export type NodeKind = "partner" | "concept";
export type EdgeKind = "bipartite" | "match";

export interface NodeAttrs {
  kind: NodeKind;
  label: string;
  // Bipartite: degree (used for sizing). Concepts: member count.
  size?: number;
  // For partner nodes: original Profile slug. For concept nodes: concept id.
  refId: string;
  // For concept nodes: parent category id (for filter coloring).
  category?: string;
}

export interface EdgeAttrs {
  kind: EdgeKind;
  // Match-only fields:
  score?: number;
  reciprocal?: boolean;
  rationale?: string;
  sharedConcepts?: string[];
}

export interface CanvasData {
  profiles: Profile[];
  concepts: Concept[];
  profileConcepts: ProfileConceptMap;
  matches: Match[];
}
```

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/canvas/lib/types.ts
git commit -m "feat(canvas): shared canvas-graph types"
```

---

## Task 3: Pure `buildGraph` — bipartite partner↔concept

**Files:**
- Create: `app/src/canvas/lib/build-graph.ts`
- Test: `app/tests/canvas/build-graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/canvas/lib/build-graph";
import type { CanvasData } from "../../src/canvas/lib/types";

const data: CanvasData = {
  profiles: [
    { slug: "alice", name: "Alice", kind: "person", challengeAreas: [], partnerTypeSeeking: [], rawHtmlPath: "" } as never,
    { slug: "bob", name: "Bob", kind: "org", challengeAreas: [], partnerTypeSeeking: [], rawHtmlPath: "" } as never,
  ],
  concepts: [
    { id: "c1", label: "AI", category: "tech", memberCount: 2 },
    { id: "c2", label: "Bio", category: "science", memberCount: 1 },
  ] as never,
  profileConcepts: { alice: ["c1", "c2"], bob: ["c1"] },
  matches: [],
};

describe("buildGraph", () => {
  it("creates a node per partner and per concept", () => {
    const g = buildGraph(data);
    expect(g.hasNode("partner:alice")).toBe(true);
    expect(g.hasNode("partner:bob")).toBe(true);
    expect(g.hasNode("concept:c1")).toBe(true);
    expect(g.hasNode("concept:c2")).toBe(true);
    expect(g.order).toBe(4);
  });

  it("creates a bipartite edge for each (profile, concept) link", () => {
    const g = buildGraph(data);
    expect(g.hasEdge("partner:alice", "concept:c1")).toBe(true);
    expect(g.hasEdge("partner:alice", "concept:c2")).toBe(true);
    expect(g.hasEdge("partner:bob", "concept:c1")).toBe(true);
    expect(g.size).toBe(3);
  });

  it("annotates partner nodes with kind=partner and concept nodes with kind=concept + category", () => {
    const g = buildGraph(data);
    expect(g.getNodeAttribute("partner:alice", "kind")).toBe("partner");
    expect(g.getNodeAttribute("concept:c1", "kind")).toBe("concept");
    expect(g.getNodeAttribute("concept:c1", "category")).toBe("tech");
  });

  it("skips concept ids in profileConcepts that don't exist in the concept list", () => {
    const data2: CanvasData = {
      ...data,
      profileConcepts: { alice: ["c1", "MISSING"] },
    };
    const g = buildGraph(data2);
    expect(g.hasNode("concept:MISSING")).toBe(false);
    expect(g.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/canvas/build-graph.test.ts`
Expected: FAIL with "Cannot find module ... build-graph".

- [ ] **Step 3: Write the implementation**

```ts
import Graph from "graphology";
import type { CanvasData, EdgeAttrs, NodeAttrs } from "./types";

export function buildGraph(data: CanvasData): Graph<NodeAttrs, EdgeAttrs> {
  const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected", multi: false });
  const conceptIds = new Set(data.concepts.map((c) => c.id));

  for (const p of data.profiles) {
    g.addNode(`partner:${p.slug}`, {
      kind: "partner",
      label: p.name,
      refId: p.slug,
    });
  }
  for (const c of data.concepts) {
    g.addNode(`concept:${c.id}`, {
      kind: "concept",
      label: c.label,
      refId: c.id,
      category: c.category,
      size: c.memberCount,
    });
  }
  for (const [slug, ids] of Object.entries(data.profileConcepts)) {
    if (!g.hasNode(`partner:${slug}`)) continue;
    for (const id of ids) {
      if (!conceptIds.has(id)) continue;
      g.addEdge(`partner:${slug}`, `concept:${id}`, { kind: "bipartite" });
    }
  }
  return g;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/canvas/build-graph.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/canvas/lib/build-graph.ts app/tests/canvas/build-graph.test.ts
git commit -m "feat(canvas): bipartite partner↔concept graph builder (TDD)"
```

---

## Task 4: Pure match-edges helper (top-K cap)

**Files:**
- Create: `app/src/canvas/lib/match-edges.ts`
- Test: `app/tests/canvas/match-edges.test.ts`

The cap mirrors `topKMatchesPerPartner` from the matches pipeline but groups by `from` so the same partner contributes at most `k` outbound match edges to the rendered graph. Bidirectional reciprocity is preserved as an attribute on each edge; the renderer paints reciprocal edges thicker.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { selectTopKMatchEdges } from "../../src/canvas/lib/match-edges";
import type { Match } from "../../src/types";

const m = (from: string, to: string, score: number, reciprocal = false): Match => ({
  from, to, score, reciprocal,
  rationale: "x", sharedConcepts: ["c1"],
});

describe("selectTopKMatchEdges", () => {
  it("keeps top-K per `from` partner", () => {
    const matches = [
      m("a", "b", 0.9), m("a", "c", 0.8), m("a", "d", 0.7), m("a", "e", 0.6),
      m("b", "a", 0.85),
    ];
    const out = selectTopKMatchEdges(matches, 2);
    const aEdges = out.filter((x) => x.from === "a");
    expect(aEdges.map((e) => e.to)).toEqual(["b", "c"]);
    expect(out.filter((x) => x.from === "b")).toHaveLength(1);
  });

  it("returns empty when k is 0", () => {
    expect(selectTopKMatchEdges([m("a", "b", 0.9)], 0)).toEqual([]);
  });

  it("preserves reciprocal flag and sharedConcepts on returned edges", () => {
    const out = selectTopKMatchEdges([m("a", "b", 0.9, true)], 5);
    expect(out[0].reciprocal).toBe(true);
    expect(out[0].sharedConcepts).toEqual(["c1"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/canvas/match-edges.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

```ts
import type { Match } from "../../types";

export function selectTopKMatchEdges(matches: Match[], k: number): Match[] {
  if (k <= 0) return [];
  const byFrom = new Map<string, Match[]>();
  for (const m of matches) {
    const list = byFrom.get(m.from) ?? [];
    list.push(m);
    byFrom.set(m.from, list);
  }
  const out: Match[] = [];
  for (const list of byFrom.values()) {
    list.sort((a, b) => b.score - a.score);
    out.push(...list.slice(0, k));
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/canvas/match-edges.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/canvas/lib/match-edges.ts app/tests/canvas/match-edges.test.ts
git commit -m "feat(canvas): top-K-per-partner match-edge selector (TDD)"
```

---

## Task 5: Data-version hash (cache key)

**Files:**
- Create: `app/src/canvas/lib/data-version.ts`
- Test: `app/tests/canvas/data-version.test.ts`

Hash needs to be stable across reloads but change whenever any of the four artifacts change. Use the cardinality + a few sentinels — full SHA isn't worth the dependency. Order-insensitive over arrays.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { dataVersion } from "../../src/canvas/lib/data-version";

const base = {
  profileCount: 486,
  conceptCount: 126,
  matchCount: 7892,
  bipartiteEdgeCount: 5121,
};

describe("dataVersion", () => {
  it("returns the same string for the same input", () => {
    expect(dataVersion(base)).toBe(dataVersion(base));
  });
  it("returns a different string when any field changes", () => {
    expect(dataVersion(base)).not.toBe(dataVersion({ ...base, matchCount: 7893 }));
    expect(dataVersion(base)).not.toBe(dataVersion({ ...base, profileCount: 487 }));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/canvas/data-version.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

```ts
export interface DataShape {
  profileCount: number;
  conceptCount: number;
  matchCount: number;
  bipartiteEdgeCount: number;
}

export function dataVersion(s: DataShape): string {
  return `v1:${s.profileCount}:${s.conceptCount}:${s.matchCount}:${s.bipartiteEdgeCount}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/canvas/data-version.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/canvas/lib/data-version.ts app/tests/canvas/data-version.test.ts
git commit -m "feat(canvas): stable data-version key for layout cache (TDD)"
```

---

## Task 6: Layout cache (localStorage)

**Files:**
- Create: `app/src/canvas/lib/layout-cache.ts`
- Test: `app/tests/canvas/layout-cache.test.ts`

`vitest.config` in this repo already uses `jsdom`, so `localStorage` is available in tests.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { loadLayout, saveLayout } from "../../src/canvas/lib/layout-cache";

afterEach(() => localStorage.clear());

describe("layout-cache", () => {
  it("saves and round-trips positions for a given version", () => {
    const positions = new Map([["a", { x: 1, y: 2 }], ["b", { x: 3, y: 4 }]]);
    saveLayout("v1:1:1:1:1", positions);
    const read = loadLayout("v1:1:1:1:1");
    expect(read).not.toBeNull();
    expect(read!.get("a")).toEqual({ x: 1, y: 2 });
    expect(read!.get("b")).toEqual({ x: 3, y: 4 });
  });

  it("returns null when the version key is unknown", () => {
    expect(loadLayout("v1:nothing")).toBeNull();
  });

  it("returns null when the cached version doesn't match", () => {
    saveLayout("v1:a", new Map([["x", { x: 0, y: 0 }]]));
    expect(loadLayout("v1:b")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/canvas/layout-cache.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

```ts
export type Positions = Map<string, { x: number; y: number }>;

const STORAGE_KEY = "canvas:layout";

interface Cached {
  version: string;
  positions: Record<string, { x: number; y: number }>;
}

export function saveLayout(version: string, positions: Positions): void {
  const obj: Cached = {
    version,
    positions: Object.fromEntries(positions),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Quota or disabled storage — silently no-op; layout will recompute on reload.
  }
}

export function loadLayout(version: string): Positions | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Cached;
    if (parsed.version !== version) return null;
    return new Map(Object.entries(parsed.positions));
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/canvas/layout-cache.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/canvas/lib/layout-cache.ts app/tests/canvas/layout-cache.test.ts
git commit -m "feat(canvas): localStorage layout cache keyed by data-version (TDD)"
```

---

## Task 7: Pure D3-force layout function

**Files:**
- Create: `app/src/canvas/lib/layout.ts`
- Test: `app/tests/canvas/layout.test.ts`

Higher repulsion for concept nodes so cluster centers spread (per spec § 8). Keeps the test deterministic by accepting a tick count — no random seeding needed since d3-force initializes positions from `Math.random` which jsdom provides; test asserts only that all nodes get finite coordinates and that concept nodes cluster looser than partner nodes.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import Graph from "graphology";
import { computeLayout } from "../../src/canvas/lib/layout";
import type { EdgeAttrs, NodeAttrs } from "../../src/canvas/lib/types";

function smallGraph(): Graph<NodeAttrs, EdgeAttrs> {
  const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected" });
  g.addNode("partner:a", { kind: "partner", label: "A", refId: "a" });
  g.addNode("partner:b", { kind: "partner", label: "B", refId: "b" });
  g.addNode("concept:c", { kind: "concept", label: "C", refId: "c" });
  g.addEdge("partner:a", "concept:c", { kind: "bipartite" });
  g.addEdge("partner:b", "concept:c", { kind: "bipartite" });
  return g;
}

describe("computeLayout", () => {
  it("returns a finite (x, y) for every node", () => {
    const positions = computeLayout(smallGraph(), { ticks: 30 });
    expect(positions.size).toBe(3);
    for (const p of positions.values()) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("converges (positions don't change drastically with one extra tick)", () => {
    const a = computeLayout(smallGraph(), { ticks: 50 });
    const b = computeLayout(smallGraph(), { ticks: 51 });
    // Positions are randomized initial; just check shape is the same.
    expect(b.size).toBe(a.size);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/canvas/layout.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write the implementation**

```ts
import { forceLink, forceManyBody, forceSimulation, forceCenter } from "d3-force";
import type Graph from "graphology";
import type { EdgeAttrs, NodeAttrs } from "./types";
import type { Positions } from "./layout-cache";

interface SimNode {
  id: string;
  kind: "partner" | "concept";
  x?: number;
  y?: number;
}

interface SimLink { source: string; target: string }

export function computeLayout(
  graph: Graph<NodeAttrs, EdgeAttrs>,
  opts: { ticks?: number } = {},
): Positions {
  const ticks = opts.ticks ?? 200;
  const nodes: SimNode[] = graph.mapNodes((id, attrs) => ({ id, kind: attrs.kind }));
  const links: SimLink[] = graph.mapEdges((_id, _attrs, source, target) => ({ source, target }));

  const sim = forceSimulation(nodes as never)
    .force("link", forceLink(links).id((d: SimNode) => d.id).distance(40).strength(0.6))
    // Concept nodes get stronger repulsion than partners (spec § 8).
    .force(
      "charge",
      forceManyBody<SimNode>().strength((d) => (d.kind === "concept" ? -150 : -60)),
    )
    .force("center", forceCenter(0, 0))
    .stop();

  for (let i = 0; i < ticks; i++) sim.tick();

  const positions: Positions = new Map();
  for (const n of nodes) positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  return positions;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/canvas/layout.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/canvas/lib/layout.ts app/tests/canvas/layout.test.ts
git commit -m "feat(canvas): D3-force layout (concept nodes repulse harder) (TDD)"
```

---

## Task 8: Worker-based layout orchestration

**Files:**
- Create: `app/src/canvas/lib/layout-worker.ts`
- Create: `app/src/canvas/lib/run-layout.ts`

No new test (the pure layout is already tested; the worker is glue). The worker accepts a serialized graph (nodes + edges) and posts back positions. Vite supports worker imports via `new Worker(new URL(..., import.meta.url), { type: "module" })`.

- [ ] **Step 1: Write the worker entrypoint**

```ts
// app/src/canvas/lib/layout-worker.ts
import Graph from "graphology";
import type { EdgeAttrs, NodeAttrs } from "./types";
import { computeLayout } from "./layout";

interface Message {
  nodes: { id: string; attrs: NodeAttrs }[];
  edges: { source: string; target: string; attrs: EdgeAttrs }[];
}

self.addEventListener("message", (e: MessageEvent<Message>) => {
  const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected" });
  for (const n of e.data.nodes) g.addNode(n.id, n.attrs);
  for (const ed of e.data.edges) g.addEdge(ed.source, ed.target, ed.attrs);
  const positions = computeLayout(g);
  const payload = Array.from(positions.entries()).map(([id, p]) => ({ id, x: p.x, y: p.y }));
  (self as unknown as Worker).postMessage(payload);
});
```

- [ ] **Step 2: Write the main-thread orchestrator**

```ts
// app/src/canvas/lib/run-layout.ts
import type Graph from "graphology";
import type { EdgeAttrs, NodeAttrs } from "./types";
import type { Positions } from "./layout-cache";

export function runLayoutInWorker(
  graph: Graph<NodeAttrs, EdgeAttrs>,
): Promise<Positions> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./layout-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<{ id: string; x: number; y: number }[]>) => {
      const out: Positions = new Map();
      for (const p of e.data) out.set(p.id, { x: p.x, y: p.y });
      worker.terminate();
      resolve(out);
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({
      nodes: graph.mapNodes((id, attrs) => ({ id, attrs })),
      edges: graph.mapEdges((_id, attrs, source, target) => ({ source, target, attrs })),
    });
  });
}
```

- [ ] **Step 3: Type check**

Run: `cd app && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/canvas/lib/layout-worker.ts app/src/canvas/lib/run-layout.ts
git commit -m "feat(canvas): D3-force layout in a Web Worker"
```

---

## Task 9: Zustand canvas store

**Files:**
- Create: `app/src/canvas/lib/store.ts`
- Test: `app/tests/canvas/store.test.ts`

State: `{ selectedNode, hoverNode, matchOverlayOn, topK, reciprocityHighlight, conceptCategoryFilter }`. URL-hash sync stays out of the store — Canvas route reads/writes the hash directly.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "../../src/canvas/lib/store";

describe("useCanvasStore", () => {
  beforeEach(() => {
    useCanvasStore.setState({
      selectedNode: null,
      hoverNode: null,
      matchOverlayOn: true,
      topK: 8,
      reciprocityHighlight: true,
      conceptCategoryFilter: new Set(),
    });
  });

  it("starts with sensible defaults", () => {
    const s = useCanvasStore.getState();
    expect(s.selectedNode).toBeNull();
    expect(s.matchOverlayOn).toBe(true);
    expect(s.topK).toBe(8);
    expect(s.reciprocityHighlight).toBe(true);
  });

  it("setSelectedNode updates state", () => {
    useCanvasStore.getState().setSelectedNode("partner:alice");
    expect(useCanvasStore.getState().selectedNode).toBe("partner:alice");
  });

  it("setTopK clamps to [3, 20]", () => {
    useCanvasStore.getState().setTopK(2);
    expect(useCanvasStore.getState().topK).toBe(3);
    useCanvasStore.getState().setTopK(50);
    expect(useCanvasStore.getState().topK).toBe(20);
    useCanvasStore.getState().setTopK(12);
    expect(useCanvasStore.getState().topK).toBe(12);
  });

  it("toggleConceptCategory adds and removes a category id", () => {
    const s = useCanvasStore.getState();
    s.toggleConceptCategory("tech");
    expect(useCanvasStore.getState().conceptCategoryFilter.has("tech")).toBe(true);
    useCanvasStore.getState().toggleConceptCategory("tech");
    expect(useCanvasStore.getState().conceptCategoryFilter.has("tech")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/canvas/store.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```ts
import { create } from "zustand";

interface CanvasState {
  selectedNode: string | null;
  hoverNode: string | null;
  matchOverlayOn: boolean;
  topK: number;
  reciprocityHighlight: boolean;
  conceptCategoryFilter: Set<string>;

  setSelectedNode: (id: string | null) => void;
  setHoverNode: (id: string | null) => void;
  setMatchOverlayOn: (on: boolean) => void;
  setTopK: (k: number) => void;
  setReciprocityHighlight: (on: boolean) => void;
  toggleConceptCategory: (id: string) => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const useCanvasStore = create<CanvasState>((set) => ({
  selectedNode: null,
  hoverNode: null,
  matchOverlayOn: true,
  topK: 8,
  reciprocityHighlight: true,
  conceptCategoryFilter: new Set(),

  setSelectedNode: (id) => set({ selectedNode: id }),
  setHoverNode: (id) => set({ hoverNode: id }),
  setMatchOverlayOn: (on) => set({ matchOverlayOn: on }),
  setTopK: (k) => set({ topK: clamp(Math.round(k), 3, 20) }),
  setReciprocityHighlight: (on) => set({ reciprocityHighlight: on }),
  toggleConceptCategory: (id) =>
    set((s) => {
      const next = new Set(s.conceptCategoryFilter);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { conceptCategoryFilter: next };
    }),
}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/canvas/store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/canvas/lib/store.ts app/tests/canvas/store.test.ts
git commit -m "feat(canvas): Zustand canvas store (selection + match controls) (TDD)"
```

---

## Task 10: Canvas data loader

**Files:**
- Create: `app/src/canvas/lib/load-canvas-data.ts`

Wraps the existing `data.ts` patterns. No test — it's a thin `fetch` shim and the underlying JSON is tested via parse tests already.

- [ ] **Step 1: Read the existing data loader**

Run: `head -50 app/src/data.ts`
This shows the established fetch convention (relative paths under `data/`).

- [ ] **Step 2: Write the loader**

```ts
import type { Concept, ConceptsArtifact, Match, Profile, ProfileConceptMap } from "../../types";
import type { CanvasData } from "./types";

async function fetchJson<T>(path: string): Promise<T> {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`fetch ${path} failed: ${resp.status}`);
  return (await resp.json()) as T;
}

export async function loadCanvasData(): Promise<CanvasData> {
  const [profiles, conceptsArtifact, profileConcepts, matches] = await Promise.all([
    fetchJson<Profile[]>("data/profiles.json"),
    fetchJson<ConceptsArtifact>("data/concepts.json"),
    fetchJson<ProfileConceptMap>("data/profile-concepts.json").catch(() => ({})),
    fetchJson<Match[]>("data/matches.json").catch(() => []),
  ]);
  return {
    profiles,
    concepts: conceptsArtifact.concepts as Concept[],
    profileConcepts,
    matches,
  };
}
```

Note: `profile-concepts.json` is **not** currently shipped via parse — it's only in `app/data-source/`. T11 wires it through `parse.ts`.

- [ ] **Step 3: Type check**

Run: `cd app && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/canvas/lib/load-canvas-data.ts
git commit -m "feat(canvas): runtime data loader (profiles + concepts + matches)"
```

---

## Task 11: Ship `profile-concepts.json` to the runtime

**Files:**
- Modify: `app/scripts/parse.ts:106-114` (the conceptual block; locate the existing `merged ${concepts.concepts.length} concepts` log line)

Currently `parse.ts` writes `concepts.json` to `public/data/` but does **not** copy `profile-concepts.json`. The Canvas needs it.

- [ ] **Step 1: Add the copy**

Inside the existing `if (existsSync(CONCEPTS_PATH) && existsSync(PROFILE_CONCEPTS_PATH))` block in `app/scripts/parse.ts`, add:

```ts
writeFileSync(join(OUT_DIR, "profile-concepts.json"), JSON.stringify(map));
```

(Place it directly after the existing `writeFileSync(join(OUT_DIR, "concepts.json"), ...)` line.)

- [ ] **Step 2: Re-run parse and confirm the file lands**

Run: `cd app && npm run parse && ls -la public/data/profile-concepts.json`
Expected: file exists, ~80–250 KB.

- [ ] **Step 3: Commit**

```bash
git add app/scripts/parse.ts
git commit -m "feat(canvas): ship profile-concepts.json to runtime via parse"
```

---

## Task 12: GraphCanvas component

**Files:**
- Create: `app/src/canvas/GraphCanvas.tsx`
- Test: `app/tests/canvas/GraphCanvas.test.tsx`

Sigma needs a real DOM container with WebGL — jsdom doesn't supply WebGL. The component test therefore mocks `sigma` and asserts only that node-click events update the store. Visual behavior is verified by the e2e test in T16.

- [ ] **Step 1: Write the failing test**

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import Graph from "graphology";
import { useCanvasStore } from "../../src/canvas/lib/store";
import { GraphCanvas } from "../../src/canvas/GraphCanvas";
import type { EdgeAttrs, NodeAttrs } from "../../src/canvas/lib/types";

const sigmaInstances: { onClick?: (e: { node: string }) => void }[] = [];
vi.mock("sigma", () => ({
  default: class FakeSigma {
    private handlers: Record<string, (e: unknown) => void> = {};
    constructor() { sigmaInstances.push(this as never); }
    on(evt: string, fn: (e: unknown) => void) { this.handlers[evt] = fn; }
    kill() {}
    refresh() {}
    fire(evt: string, payload: unknown) { this.handlers[evt]?.(payload); }
  },
}));

afterEach(() => {
  sigmaInstances.length = 0;
  useCanvasStore.setState({ selectedNode: null });
});

describe("<GraphCanvas>", () => {
  it("forwards a node-click into the canvas store", () => {
    const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected" });
    g.addNode("partner:a", { kind: "partner", label: "A", refId: "a", size: 1 });
    g.setNodeAttribute("partner:a", "x" as never, 0);
    g.setNodeAttribute("partner:a", "y" as never, 0);

    render(<GraphCanvas graph={g} />);
    const sigma = sigmaInstances[0] as never as { fire: (e: string, p: unknown) => void };
    sigma.fire("clickNode", { node: "partner:a" });
    expect(useCanvasStore.getState().selectedNode).toBe("partner:a");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/canvas/GraphCanvas.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```tsx
import { useEffect, useRef } from "react";
import Sigma from "sigma";
import type Graph from "graphology";
import { useCanvasStore } from "./lib/store";
import type { EdgeAttrs, NodeAttrs } from "./lib/types";

interface Props {
  graph: Graph<NodeAttrs, EdgeAttrs>;
}

export function GraphCanvas({ graph }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      defaultEdgeColor: "rgba(150,150,150,0.25)",
      defaultNodeColor: "#888",
    });
    sigmaRef.current = sigma;
    const setSelected = useCanvasStore.getState().setSelectedNode;
    const setHover = useCanvasStore.getState().setHoverNode;
    sigma.on("clickNode", (e: { node: string }) => setSelected(e.node));
    sigma.on("enterNode", (e: { node: string }) => setHover(e.node));
    sigma.on("leaveNode", () => setHover(null));
    sigma.on("clickStage", () => setSelected(null));
    return () => {
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [graph]);

  return <div ref={containerRef} className="h-full w-full bg-neutral-950" />;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/canvas/GraphCanvas.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/canvas/GraphCanvas.tsx app/tests/canvas/GraphCanvas.test.tsx
git commit -m "feat(canvas): GraphCanvas (sigma + store wiring) (TDD)"
```

---

## Task 13: LeftPane (filters + match controls)

**Files:**
- Create: `app/src/canvas/LeftPane.tsx`
- Test: `app/tests/canvas/LeftPane.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { LeftPane } from "../../src/canvas/LeftPane";
import { useCanvasStore } from "../../src/canvas/lib/store";

const categories = [
  { id: "tech", label: "Technology", count: 30 },
  { id: "science", label: "Science", count: 25 },
];

afterEach(() => {
  useCanvasStore.setState({
    matchOverlayOn: true,
    topK: 8,
    reciprocityHighlight: true,
    conceptCategoryFilter: new Set(),
  });
});

describe("<LeftPane>", () => {
  it("toggles match overlay", () => {
    render(<LeftPane categories={categories} />);
    fireEvent.click(screen.getByLabelText(/show offer→seek matches/i));
    expect(useCanvasStore.getState().matchOverlayOn).toBe(false);
  });

  it("updates topK from the slider", () => {
    render(<LeftPane categories={categories} />);
    const slider = screen.getByLabelText(/top matches per partner/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "12" } });
    expect(useCanvasStore.getState().topK).toBe(12);
  });

  it("toggles a concept-category chip", () => {
    render(<LeftPane categories={categories} />);
    fireEvent.click(screen.getByText(/Technology/i));
    expect(useCanvasStore.getState().conceptCategoryFilter.has("tech")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/canvas/LeftPane.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```tsx
import { useCanvasStore } from "./lib/store";

interface Category { id: string; label: string; count: number }
interface Props { categories: Category[] }

export function LeftPane({ categories }: Props) {
  const matchOverlayOn = useCanvasStore((s) => s.matchOverlayOn);
  const topK = useCanvasStore((s) => s.topK);
  const reciprocityHighlight = useCanvasStore((s) => s.reciprocityHighlight);
  const conceptCategoryFilter = useCanvasStore((s) => s.conceptCategoryFilter);
  const { setMatchOverlayOn, setTopK, setReciprocityHighlight, toggleConceptCategory } =
    useCanvasStore.getState();

  return (
    <aside className="flex w-[220px] flex-col gap-6 border-r border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-200">
      <section>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Matches</h3>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={matchOverlayOn}
            onChange={(e) => setMatchOverlayOn(e.target.checked)}
          />
          Show offer→seek matches
        </label>
        <label className="mt-3 block">
          <span className="text-xs text-neutral-400">
            Top matches per partner: {topK}
          </span>
          <input
            aria-label="top matches per partner"
            type="range"
            min={3}
            max={20}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={reciprocityHighlight}
            onChange={(e) => setReciprocityHighlight(e.target.checked)}
          />
          Highlight reciprocal matches
        </label>
      </section>

      <section>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Concept categories</h3>
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => {
            const active = conceptCategoryFilter.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleConceptCategory(c.id)}
                className={
                  "rounded-full border px-2 py-0.5 text-xs " +
                  (active
                    ? "border-pink-500 bg-pink-500/20 text-pink-200"
                    : "border-neutral-700 text-neutral-300 hover:border-neutral-500")
                }
              >
                {c.label} <span className="opacity-60">({c.count})</span>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/canvas/LeftPane.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/canvas/LeftPane.tsx app/tests/canvas/LeftPane.test.tsx
git commit -m "feat(canvas): LeftPane filters + match controls (TDD)"
```

---

## Task 14: RightPane (partner / concept card)

**Files:**
- Create: `app/src/canvas/RightPane.tsx`
- Test: `app/tests/canvas/RightPane.test.tsx`

The pane reads `selectedNode` from the store and renders different content for `partner:*` vs. `concept:*`. Match cards include score + reciprocity glyph + rationale text.

- [ ] **Step 1: Write the failing test**

```tsx
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RightPane } from "../../src/canvas/RightPane";
import { useCanvasStore } from "../../src/canvas/lib/store";
import type { CanvasData } from "../../src/canvas/lib/types";

const data: CanvasData = {
  profiles: [
    { slug: "alice", name: "Alice", kind: "person", affiliation: "ACME", challengeAreas: [], partnerTypeSeeking: [], rawHtmlPath: "" } as never,
    { slug: "bob", name: "Bob", kind: "org", affiliation: "BCO", challengeAreas: [], partnerTypeSeeking: [], rawHtmlPath: "" } as never,
  ],
  concepts: [{ id: "c1", label: "AI", category: "tech", memberCount: 2 }] as never,
  profileConcepts: { alice: ["c1"], bob: ["c1"] },
  matches: [
    { from: "alice", to: "bob", score: 0.9, rationale: "perfect fit", sharedConcepts: ["c1"], reciprocal: true },
  ],
};

afterEach(() => useCanvasStore.setState({ selectedNode: null }));

describe("<RightPane>", () => {
  it("renders 'Nothing selected' when no node is selected", () => {
    render(<RightPane data={data} />);
    expect(screen.getByText(/nothing selected/i)).toBeInTheDocument();
  });

  it("renders a partner card with concepts and matches", () => {
    useCanvasStore.setState({ selectedNode: "partner:alice" });
    render(<RightPane data={data} />);
    expect(screen.getByText(/alice/i)).toBeInTheDocument();
    expect(screen.getByText(/ACME/)).toBeInTheDocument();
    expect(screen.getByText(/AI/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/perfect fit/i)).toBeInTheDocument();
  });

  it("renders a concept card with member count", () => {
    useCanvasStore.setState({ selectedNode: "concept:c1" });
    render(<RightPane data={data} />);
    expect(screen.getByText(/AI/)).toBeInTheDocument();
    expect(screen.getByText(/2 partners/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/canvas/RightPane.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```tsx
import { useMemo } from "react";
import { useCanvasStore } from "./lib/store";
import type { CanvasData } from "./lib/types";

interface Props { data: CanvasData }

export function RightPane({ data }: Props) {
  const selectedNode = useCanvasStore((s) => s.selectedNode);
  const setSelectedNode = useCanvasStore.getState().setSelectedNode;

  const conceptById = useMemo(
    () => new Map(data.concepts.map((c) => [c.id, c])),
    [data.concepts],
  );
  const profileBySlug = useMemo(
    () => new Map(data.profiles.map((p) => [p.slug, p])),
    [data.profiles],
  );

  if (!selectedNode) {
    return (
      <aside className="w-[260px] border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
        Nothing selected — click a node on the canvas.
      </aside>
    );
  }

  if (selectedNode.startsWith("partner:")) {
    const slug = selectedNode.slice("partner:".length);
    const profile = profileBySlug.get(slug);
    if (!profile) return null;
    const conceptIds = data.profileConcepts[slug] ?? [];
    const matches = data.matches
      .filter((m) => m.from === slug)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return (
      <aside className="flex w-[260px] flex-col gap-4 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-200">
        <header>
          <h2 className="text-base font-semibold">{profile.name}</h2>
          {profile.affiliation && <p className="text-xs text-neutral-400">{profile.affiliation}</p>}
        </header>
        <section>
          <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Concepts</h3>
          <ul className="flex flex-wrap gap-1">
            {conceptIds.map((id) => {
              const c = conceptById.get(id);
              if (!c) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(`concept:${id}`)}
                    className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs hover:border-pink-500"
                  >
                    {c.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-400">
            Top matches ({matches.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {matches.map((m) => {
              const target = profileBySlug.get(m.to);
              return (
                <li key={`${m.from}->${m.to}`} className="rounded border border-neutral-800 p-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNode(`partner:${m.to}`)}
                    className="flex items-center gap-2 text-left font-medium text-pink-300 hover:underline"
                  >
                    {target?.name ?? m.to}
                    {m.reciprocal && <span title="reciprocal" className="text-pink-500">⇄</span>}
                    <span className="ml-auto text-xs text-neutral-400">
                      {m.score.toFixed(2)}
                    </span>
                  </button>
                  <p className="mt-1 text-xs text-neutral-300">{m.rationale}</p>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    );
  }

  if (selectedNode.startsWith("concept:")) {
    const id = selectedNode.slice("concept:".length);
    const c = conceptById.get(id);
    if (!c) return null;
    const partners = Object.entries(data.profileConcepts)
      .filter(([_, ids]) => ids.includes(id))
      .map(([slug]) => profileBySlug.get(slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    return (
      <aside className="flex w-[260px] flex-col gap-3 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-200">
        <header>
          <h2 className="text-base font-semibold">{c.label}</h2>
          <p className="text-xs text-neutral-400">
            {c.category ?? "uncategorized"} · {partners.length} partners
          </p>
        </header>
        <ul className="flex flex-col gap-1">
          {partners.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => setSelectedNode(`partner:${p.slug}`)}
                className="text-left text-pink-300 hover:underline"
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    );
  }

  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/canvas/RightPane.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/canvas/RightPane.tsx app/tests/canvas/RightPane.test.tsx
git commit -m "feat(canvas): RightPane partner/concept cards (TDD)"
```

---

## Task 15: Canvas route — wire it all together

**Files:**
- Create: `app/src/routes/Canvas.tsx`

This is the integration point: load data, build graph, run worker layout (with cache), assign positions onto graph, add match edges based on store, render LeftPane + GraphCanvas + RightPane. Also reads `:slug` from `useParams` to pre-select a partner.

- [ ] **Step 1: Write the route component**

```tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { LeftPane } from "../canvas/LeftPane";
import { GraphCanvas } from "../canvas/GraphCanvas";
import { RightPane } from "../canvas/RightPane";
import { loadCanvasData } from "../canvas/lib/load-canvas-data";
import { buildGraph } from "../canvas/lib/build-graph";
import { selectTopKMatchEdges } from "../canvas/lib/match-edges";
import { dataVersion } from "../canvas/lib/data-version";
import { loadLayout, saveLayout } from "../canvas/lib/layout-cache";
import { runLayoutInWorker } from "../canvas/lib/run-layout";
import { useCanvasStore } from "../canvas/lib/store";
import type { CanvasData, EdgeAttrs, NodeAttrs } from "../canvas/lib/types";
import type Graph from "graphology";

export default function Canvas() {
  const { slug } = useParams<{ slug?: string }>();
  const [data, setData] = useState<CanvasData | null>(null);
  const [graph, setGraph] = useState<Graph<NodeAttrs, EdgeAttrs> | null>(null);
  const matchOverlayOn = useCanvasStore((s) => s.matchOverlayOn);
  const topK = useCanvasStore((s) => s.topK);

  useEffect(() => {
    void loadCanvasData().then(setData);
  }, []);

  // Build the bipartite graph + lay it out (worker + localStorage cache).
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      const g = buildGraph(data);
      const version = dataVersion({
        profileCount: data.profiles.length,
        conceptCount: data.concepts.length,
        matchCount: data.matches.length,
        bipartiteEdgeCount: g.size,
      });
      let positions = loadLayout(version);
      if (!positions) {
        positions = await runLayoutInWorker(g);
        saveLayout(version, positions);
      }
      if (cancelled) return;
      g.forEachNode((id) => {
        const p = positions!.get(id);
        if (p) {
          g.setNodeAttribute(id, "x" as never, p.x);
          g.setNodeAttribute(id, "y" as never, p.y);
        }
      });
      // Default size and color so sigma renders something visible.
      g.forEachNode((id, attrs) => {
        g.setNodeAttribute(id, "size" as never, attrs.kind === "concept" ? 6 : 3);
        g.setNodeAttribute(
          id, "color" as never,
          attrs.kind === "concept" ? "#f472b6" : "#a3a3a3",
        );
      });
      setGraph(g);
    })();
    return () => { cancelled = true; };
  }, [data]);

  // Apply the match overlay (add or replace edges with kind="match") whenever
  // the toggle, top-K, or data changes.
  useEffect(() => {
    if (!graph || !data) return;
    graph.forEachEdge((id, attrs) => {
      if (attrs.kind === "match") graph.dropEdge(id);
    });
    if (!matchOverlayOn) return;
    const edges = selectTopKMatchEdges(data.matches, topK);
    for (const m of edges) {
      const src = `partner:${m.from}`;
      const dst = `partner:${m.to}`;
      if (!graph.hasNode(src) || !graph.hasNode(dst)) continue;
      if (graph.hasEdge(src, dst)) continue;
      graph.addEdge(src, dst, {
        kind: "match",
        score: m.score,
        reciprocal: m.reciprocal,
        rationale: m.rationale,
        sharedConcepts: m.sharedConcepts,
      });
    }
  }, [graph, data, matchOverlayOn, topK]);

  // Pre-select partner from the URL.
  useEffect(() => {
    if (!slug) return;
    useCanvasStore.getState().setSelectedNode(`partner:${slug}`);
  }, [slug]);

  const categories = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const c of data.concepts) {
      const k = c.category ?? "uncategorized";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([id, count]) => ({ id, label: id, count }));
  }, [data]);

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <LeftPane categories={categories} />
      <div className="relative flex-1">
        {graph
          ? <GraphCanvas graph={graph} />
          : <div className="flex h-full items-center justify-center text-neutral-500">
              Loading canvas…
            </div>}
      </div>
      {data && <RightPane data={data} />}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/routes/Canvas.tsx
git commit -m "feat(canvas): Canvas route — wire LeftPane + GraphCanvas + RightPane"
```

---

## Task 16: App router rewrite + TopBar slim-down + delete legacy

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/TopBar.tsx`
- Delete: `app/src/routes/Browse.tsx`, `Compare.tsx`, `Network.tsx`, `ProfileDetail.tsx`
- Delete: `app/src/components/ProfileCard.tsx`, `ProfileTable.tsx`, `CoverageMatrix.tsx`, `SimilarCarousel.tsx`, `FilterSidebar.tsx`
- Delete: `app/tests/coverage.test.ts`, `app/tests/filters.test.ts`, `app/tests/team-builder.test.ts` only if those modules become unreferenced (verify with grep below before deleting)

This is the destructive task. Do all the deletes in one commit so review is contained.

- [ ] **Step 1: Rewrite `App.tsx`**

```tsx
import { HashRouter, Route, Routes } from "react-router-dom";
import TopBar from "./components/TopBar";
import Canvas from "./routes/Canvas";
import Composer from "./routes/Composer";
import NotFound from "./routes/NotFound";
import { useGlobalShortcuts } from "./lib/keyboard";

export default function App() {
  useGlobalShortcuts();
  return (
    <HashRouter>
      <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
        <TopBar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Canvas />} />
            <Route path="/profile/:slug" element={<Canvas />} />
            <Route path="/composer" element={<Composer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
```

- [ ] **Step 2: Slim `TopBar.tsx` — drop tab nav**

Open `app/src/components/TopBar.tsx`, remove the tab/nav section, keep brand + search. The end state should render: `[Genesis · Partners] [search box .....] [stat strip]`. Drop any imports for `NavLink` if no longer referenced.

- [ ] **Step 3: Verify legacy files are no longer imported**

Run:
```bash
cd app && grep -rE "from \"\\.\\./routes/(Browse|Compare|Network|ProfileDetail)\"" src tests
cd app && grep -rE "from \"\\.\\./components/(ProfileCard|ProfileTable|CoverageMatrix|SimilarCarousel|FilterSidebar)\"" src tests
```
Expected: both produce no output. If anything remains, fix the importer first.

- [ ] **Step 4: Delete the files**

```bash
cd app
rm src/routes/Browse.tsx src/routes/Compare.tsx src/routes/Network.tsx src/routes/ProfileDetail.tsx
rm src/components/ProfileCard.tsx src/components/ProfileTable.tsx src/components/CoverageMatrix.tsx src/components/SimilarCarousel.tsx src/components/FilterSidebar.tsx
```

- [ ] **Step 5: Drop tests for deleted modules**

For each of `coverage.test.ts`, `filters.test.ts`, `team-builder.test.ts`, run:
```bash
cd app && grep -rE "from \"\\.\\./(src/)?lib/(coverage|filters|team-builder)\"" src tests
```
If `src/lib/coverage.ts` (etc.) is *only* imported by its test (or not at all), delete both the lib and the test. If it's still used elsewhere (e.g. in Composer), keep both.

- [ ] **Step 6: Type check + tests**

```bash
cd app && npx tsc --noEmit -p . && npm test
```
Expected: clean type-check, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(canvas): switch app to single Canvas route + delete legacy screens"
```

---

## Task 17: Update e2e — single Canvas smoke test

**Files:**
- Modify (or replace): files under `app/tests/e2e/`

- [ ] **Step 1: Inventory current e2e tests**

```bash
cd app && ls tests/e2e/
```

- [ ] **Step 2: Replace with one Canvas smoke test**

Create/replace `app/tests/e2e/canvas.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("canvas loads and shows a partner card on selection", async ({ page }) => {
  await page.goto("/");
  // Wait for the canvas container to mount and at least one node element to render.
  await page.waitForSelector("canvas", { timeout: 15_000 });
  // Search for a known partner and follow the deep link.
  await page.goto("/#/profile/biokea");
  await expect(page.getByText(/biokea/i).first()).toBeVisible({ timeout: 10_000 });
  // Match list visible (≥ 1 rationale rendered)
  const rationale = page.locator("aside").filter({ hasText: /\d.\d{2}/ }).first();
  await expect(rationale).toBeVisible({ timeout: 10_000 });
});
```

Delete the old Browse/Compare e2e specs.

- [ ] **Step 3: Run the e2e**

```bash
cd app && npm run e2e
```
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(e2e): single Canvas smoke test (drops Browse/Compare specs)"
```

---

## Task 18: Final verification + ship

**Files:** none (verification only)

- [ ] **Step 1: Clean rebuild from scratch**

```bash
cd app && rm -rf dist public/data && npm run build
```
Expected: `dist/` created, no warnings about missing data files, build succeeds.

- [ ] **Step 2: Full test suite**

```bash
cd app && npm test
```
Expected: all tests pass (existing 73 + the new canvas tests, ~95+ total).

- [ ] **Step 3: Visual smoke test in dev**

```bash
cd app && npm run dev
```
Open http://localhost:5173/ in a browser. Verify:
- Bipartite graph renders (gray dots = partners, pink dots = concepts, faint gray edges).
- Toggling **Show offer→seek matches** in the LeftPane adds pink match edges.
- Slider changes the visible match-edge count.
- Clicking a partner node populates the RightPane with concepts + match list including rationales.
- Visiting `http://localhost:5173/#/profile/biokea` opens the Canvas with BioKEA selected.

- [ ] **Step 4: Commit any tiny fixes from the visual pass**

Anything you fix here goes in its own commit. If nothing needs fixing, skip this step.

---

## Self-review checklist (controller runs this before handing off)

- [ ] All spec § 4, § 8, § 10 requirements covered? (Bipartite default ✓, match overlay toggle ✓, top-K slider ✓, reciprocity highlight ✓, LeftPane filters ✓, RightPane partner+concept cards ✓, sigma + WebGL ✓, D3-force in worker ✓, layout cache ✓, Zustand store ✓, route collapse ✓, legacy deletions ✓.)
- [ ] No `TBD` / placeholder strings.
- [ ] Type names consistent (`NodeAttrs`, `EdgeAttrs`, `Positions`, `CanvasData`).
- [ ] D lens, onboarding, action rail, compare overlay are explicitly out of scope (handled in Plan 4+).

## Out of scope (deferred to Plan 4+)

- D lens (project-centered topology)
- Onboarding overlay
- Action rail + multi-select
- CompareOverlay
- Edge styling polish (reciprocal `⇄` glyph at midpoint, hover halos, etc.)
- Lens transition animations
- Layout-cache invalidation on a stale-version key (currently silently recomputes — fine)
