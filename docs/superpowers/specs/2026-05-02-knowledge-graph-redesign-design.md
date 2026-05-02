# Knowledge-Graph Redesign — Design Spec

**Date:** 2026-05-02
**Status:** Approved (brainstorming complete, awaiting implementation plan)
**Supersedes:** [`2026-04-18-genesis-partners-navigator-design.md`](2026-04-18-genesis-partners-navigator-design.md)

## 1. Context

The Genesis Partners Navigator (`app/`) currently exposes 486 scraped partner profiles through four sibling tabs: Browse (searchable list), Composer (RFA proposal builder), Matchmaker (force-directed network), Compare (side-by-side table). The data model captures rich per-profile text (Introduction, Offerings, Seeking, Project Idea) but the current UI surfaces it primarily as filterable cards — the structure of the consortium itself is not legible.

The corpus is **frozen**: 486 partners, no future growth expected. This unlocks heavier one-shot offline processing.

## 2. Goals

1. **Birds-eye terrain mapping.** Make the shape of the consortium visible — clusters, hubs, whitespace, capability gaps — at a glance.
2. **Credibility surface for BioKEA.** The app should communicate that BioKEA has read every profile and understands the field. Visual polish and surfaced rationales matter.

Navigation ease is downstream of these two goals: the redesign reduces the number of top-level surfaces and makes the most-used capability (exploring the consortium) the default.

## 3. Decisions Summary

| Question | Decision |
|---|---|
| Graph topology | Bipartite partners ↔ concepts (default), with offer→seek match overlay (toggleable), and project-centered lens (swap-in) |
| Information architecture | Graph-first single canvas, no top-level tabs |
| Concept extraction | LLM extract → local embed → cluster → human curate → LLM re-tag (one-shot, frozen) |
| Match scoring | Concept-overlap pre-filter → Claude Haiku per-pair scoring with 1-sentence rationale (one-shot, frozen) |
| Match knobs | Reciprocity highlight enabled by default; top-K matches per partner with slider (3–20, default 8) |
| Embeddings | Local sentence-transformers (`@xenova/transformers`), no API key |
| Curation UI | Local-only Vite page (`npm run curate`), not deployed |
| Parent categories | LLM-proposed, then locked during curation |
| D lens linkage | Inferred via embedding similarity, marked with a confidence indicator |
| Legacy code | Deleted in this redesign (git history is the reference) |

## 4. Information Architecture

Single canvas, three regions, one floating action rail.

```
┌──────────────────────────────────────────────────────────────┐
│  GENESIS · PARTNERS    [search ........]   [Lens switcher]   │
├──────────┬──────────────────────────────────────┬────────────┤
│          │                                      │            │
│  LEFT    │            CANVAS (graph)            │   RIGHT    │
│  filters │                                      │   context  │
│  + lens  │                                      │   pane     │
│  controls│                                      │            │
│          │      [floating action rail]          │            │
└──────────┴──────────────────────────────────────┴────────────┘
```

**Top bar:**
- Brand
- Persistent search input (searches partners, concepts, projects; `/` shortcut)
- Lens switcher (segmented control): "People + Topics" (default) ⇄ "Projects"
- Compact stat: "486 partners · 112 concepts · updated 2026-05-02"

**Left pane (~200 px):**
- **Lens overlay group:** "Show offer→seek matches" toggle (default ON), top-K slider (3–20, default 8), "Highlight reciprocal matches" toggle (default ON)
- **Filter partners group:** challenge area chips, "Has project idea" toggle, organization/person toggles
- **Filter concepts group:** parent-category chips (multi-select; categories are LLM-proposed and locked during curation)

**Canvas (center, fluid):**
- Force-directed layout via D3-force (worker-computed, cached in `localStorage` keyed by data-version hash so reloads are instant)
- Rendered with `sigma.js` (WebGL) for performance at ~600 nodes / ~4k visible edges
- Dark canvas background (research-instrument feel)

**Right pane (~240 px):**
- When a **partner** is selected: name, affiliation, concept list, top-K matches with scores + reciprocal indicator, expandable rationale text per match
- When a **concept** is selected: parent category, member count, top partners offering it, top partners seeking it
- When a **project** is selected (D lens only): project text, ranked partners, "Open in Composer with these partners pre-loaded" button
- Clicking a name in any list re-anchors the graph and right pane on that target (continuous browsing)

**Floating action rail (bottom-center, appears only when multi-select set is non-empty):**
- "n selected" count
- "Compare" button (max 4 in compare set; opens an inline `CompareOverlay` component — a side-by-side table of the selected partners' Introduction / Offerings / Seeking / Project Idea / matches. The legacy `/compare` route is gone; compare lives only as this overlay over the Canvas.)
- "Open in Composer →" button (passes selected slugs to `/composer?slugs=...`)

**Onboarding:** first-visit only, a small dismissable overlay over the canvas: "Drag to pan, scroll to zoom, click any node to focus, toggle matches in left pane." Dismissed state persists in `localStorage`. No separate landing page.

## 5. Routes

| Route | Purpose |
|---|---|
| `/` | Canvas (the new home) |
| `/profile/:slug` | Same Canvas, with the graph anchored on `slug` and right pane open. Required for shareable deep links. |
| `/composer` | Existing Composer, accepts `?slugs=a,b,c` for pre-loaded selection |

URL hash mirrors `{ lens, anchorSlug }` on Canvas so any view is shareable.

Removed routes: `/network`, `/compare`. The capabilities they served are subsumed by Canvas + action rail.

## 6. Concept Extraction Pipeline (E)

One-shot offline build. Run from `app/scripts/concepts/`. Output is two committed JSON files. Production never calls an LLM.

**Inputs:** parsed Profiles with `introduction`, `offerings.text`, `seeking.text`, `projectIdeaSummary`.

**Steps:**

1. `01-extract.ts` — for each profile, concatenate the four fields. Claude Haiku batch call (parallelized 10-wide). Prompt requests 5–15 short canonical concept phrases. Cache responses by SHA(profile_text) so reruns are free. Output: `build/raw-concepts.json` (~5000 raw phrases).
2. `02-embed.ts` — embed each unique phrase locally with `@xenova/transformers` (sentence-transformers, no API). Model downloaded once into `node_modules`. Output: `build/concept-vectors.json`.
3. `03-cluster.ts` — HDBSCAN over embeddings (`density-clustering` npm), `minClusterSize=3`. Output: `build/clusters.json` (~80–150 clusters + a noise bucket).
4. `04-label.ts` — for each cluster, one Haiku call: given the member phrases, propose a canonical short label and a parent category. The set of parent categories is itself LLM-proposed (the model sees a sample of clusters and emits a category vocabulary first). Output: `build/concept-candidates.json`.
5. **Manual curation** — `npm run curate` opens a local-only Vite page. For each cluster: shows label + member phrases + parent category. User can rename, merge clusters, drop noise, reassign category. State persists incrementally to `app/data-source/concepts.json`. ~2 hours of work, single sitting.
6. `05-retag.ts` — second Haiku pass. For each profile, given the **curated** vocabulary as a fixed list, emit which concepts apply. Forces normalization, no synonym drift. Output: `app/data-source/profile-concepts.json` (slug → concept_ids).

**Cost / time:** ~$3–5 in Haiku, ~10 min wall-clock pipeline + ~2 h curation. Run once.

**Build dependencies:** `@anthropic-ai/sdk`, `@xenova/transformers`, `density-clustering`. `ANTHROPIC_API_KEY` required only for steps 1, 4, 6 (locally; never in production).

## 7. Match Scoring Pipeline (C)

Same one-shot offline pattern. Output is one committed JSON file.

**Inputs:** `profile-concepts.json` from § 6 + raw `offerings.text` / `seeking.text` per profile.

**Steps:**

1. `scripts/matches/01-candidates.ts` — generate ordered candidate pairs `(A, B)` where A ≠ B and A's *offer concepts* ∩ B's *seek concepts* is non-empty. Bidirectional: `(A→B)` and `(B→A)` are independent candidates with independent shared sets. Expected count: ~5k–15k pairs.
2. `scripts/matches/02-score.ts` — for each candidate, one Haiku call returning `{ score: 0.0–1.0, rationale: <one sentence> }`. Asymmetric prompt ("would A's offer plausibly satisfy B's seek"). Parallelized 20-wide. Cached by SHA(from_text + to_text). Pairs scoring < 0.5 are dropped (noise floor).
3. `scripts/matches/03-finalize.ts` — sort by `from` then by `score` descending. Detect reciprocity: for each `(A→B)` in the kept set, mark both directions `reciprocal: true` if `(B→A)` is also kept. Output: `app/data-source/matches.json`.

**Schema:**

```ts
type Match = {
  from: string;          // partner slug
  to: string;            // partner slug
  score: number;         // 0.5..1.0
  rationale: string;     // one sentence
  sharedConcepts: string[];  // concept ids
  reciprocal: boolean;
}
```

**Top-K:** applied at *render time* in the app (slider 3–20, default 8). Stored data is not truncated — changing K does not require a rebuild.

**Cost / time:** ~$5–15 in Haiku, ~10 min wall clock. Run once after § 6.

## 8. Graph Rendering & Interaction

**Layout:** D3-force in a Web Worker. Concept nodes get higher repulsion than partner nodes so cluster centers spread out and stay readable. Layout runs once at app load (~1–2 s for 600 nodes), then positions are cached in `localStorage` keyed by data-version hash. Subsequent loads skip layout entirely.

**Renderer:** `sigma.js` (WebGL). Required because SVG would not stay smooth at ~600 nodes + ~4k visible edges + zoom/pan.

**Interaction grammar:**

- **Hover a node:** node + 1-hop neighborhood brighten; everything else fades to ~25% opacity. Tooltip with name, type, degree.
- **Click a partner:** anchor the right pane to that partner; graph re-centers softly.
- **Click a concept:** right pane swaps to "concept card".
- **Click a match name in the right pane:** re-anchors the graph and right pane on that partner.
- **Shift-click** (or click a `+` badge on hover): adds the partner to the selection set. Bottom action rail appears.
- **Drag** = pan; **scroll** = zoom; **double-click empty space** = reset view.
- `/` focuses the search input.

**Edge rendering rules:**

- Bipartite edges (partner ↔ concept): faint gray, opacity 0.25.
- Match edges (offer → seek, the C overlay): pink. Drawn only when "Show matches" is on. Clipped to top-K per partner per the slider.
- Reciprocal match edges: thicker, slightly brighter, with a small `⇄` glyph at the midpoint visible on hover.

## 9. D Lens (Project-Centered)

The lens switcher animates the same dataset into a different topology:

- Concept nodes vanish.
- Project ideas become large pink hubs.
- Partners orbit the projects they're linked to.
- Partners shared between projects sit between the two hubs.
- Partners with no project linkage drift to the canvas edge (visible but demoted).

**Linkage method:** **inferred** via embedding similarity between a partner's full concept set and a project's text, with a confidence threshold. Inferred edges carry a small `?` indicator on hover so the user knows the link is computed, not stated. This is the deliberate choice over "explicit only" linkage (which would leave ~70% of partners disconnected and make the lens nearly empty).

**Right pane on a project hub:** project text + ranked partner list + "Open in Composer with these partners pre-loaded" button. This is the natural Composer entry point in the D lens.

**Lens transition:** nodes that exist in both views slide to their new positions; others fade in/out. Implemented via sigma's animation primitives.

## 10. Components & State

**New components:**
- `GraphCanvas` — sigma.js + D3-force orchestration
- `LensSwitcher` — top-right segmented control
- `LeftPane` — filters, lens controls, concept categories
- `RightPane` — selected-entity context (partner / concept / project cards)
- `ActionRail` — floating bottom selection actions
- `CompareOverlay` — side-by-side table for the multi-select set, opened from the action rail
- `OnboardingOverlay` — first-visit dismissable hint

**Refactored:** `TopBar` (no tabs); `ProfileDetail` (slimmed — its content moves into `RightPane`; the route just renders `<Canvas anchorSlug={slug}/>`).

**Kept:** `Composer.tsx` (now accepts `?slugs=` query param), `SearchBox`, `TagChip`, `FavoriteButton`, `CompareButton` (repurposed into Canvas chrome).

**Deleted:** `Browse.tsx`, `Compare.tsx`, `Network.tsx`, `ProfileCard`, `ProfileTable`, `CoverageMatrix`, `SimilarCarousel`, `FilterSidebar` (replaced by `LeftPane`).

**State:** lightweight Zustand store `useCanvasStore` holding `{ selectedNode, multiSelect[], lens, filters, matchOverlay, topK, onboardingDismissed }`. URL hash mirrors `{ lens, anchorSlug }` for shareability.

## 11. Build Pipeline

| Script | When | Output |
|---|---|---|
| `scrape` | Manual, when site updates (rare) | `detail-pages/*.html`, `manifest.json` |
| `parse` | Build-time, automatic | `app/data-source/profiles.json`; merges `concepts.json`, `profile-concepts.json`, `matches.json` into the dataset the app loads |
| `concepts:extract` → `concepts:embed` → `concepts:cluster` → `concepts:label` → `curate` → `concepts:retag` | Manual, **once**, after major data change | `app/data-source/concepts.json`, `profile-concepts.json` (committed) |
| `matches` (chains the matches/ scripts) | Manual, **once**, after concepts | `app/data-source/matches.json` (committed) |
| `build` | Vercel | `parse` + `tsc -b` + `vite build`. Does **not** re-run concepts/matches. |

This keeps the production build hermetic — no LLM API keys required at deploy time.

**Bundle budget:**

- `concepts.json` ~50 KB (initial bundle)
- `profile-concepts.json` ~80 KB (initial bundle)
- `matches.json` ~500 KB – 2 MB (lazy-loaded after first paint)
- `profiles.json` ~12 MB (existing, already lazy-loaded)

## 12. Testing

- **Vitest unit tests** for deterministic transforms: `buildCandidatePairs`, `computeReciprocity`, `topKPerPartner`, `inferProjectLinkage`. The LLM-call layers are not unit-tested — they are scripts, run manually, output committed to git, and visually validated through the curation UI.
- **Component tests:** `GraphCanvas` (mock data, node click → store update), `RightPane`, `ActionRail`.
- **Playwright e2e:** one smoke test — load app, see graph, search "BioKEA", confirm right pane shows BioKEA's matches with rationale text. Drop existing e2e tests for Browse/Compare.

## 13. Deployment

Same Vercel config. The route-fallback list in `app/vercel.json` already covers what the new app needs (`data/`, `detail-pages/`, `assets/`). No infrastructure changes.

## 14. Out of Scope

- Visual polish pass beyond the dark-canvas direction (typography, animation timing, exact color values) — refine after structure works.
- Mobile / tablet responsive layout — current app isn't responsive; not in this redesign.
- Keyboard navigation beyond `/` for search — accessibility is a separate effort.
- Analytics / instrumentation.
- Re-running concepts or matches on a schedule (corpus is frozen by assumption).
