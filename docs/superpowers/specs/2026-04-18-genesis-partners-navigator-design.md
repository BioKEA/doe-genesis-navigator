# Genesis Partners Navigator — Design

## Purpose

A web app for navigating the 443 participant profiles scraped from the DOE
Genesis Mission Partnership Exchange. Primary goal: **discovery / matchmaking**
("who offers X and is seeking Y in challenge area Z"). Supporting goals:
landscape analysis (network overlap view), deep browsing/reading, and
compare/shortlist workflows.

Audience: the author and a small number of colleagues, accessed via a shared
link on a static host.

## Input data

Source directory (read-only): `/Users/seanjungbluth/Desktop/DOE-Genesis-Scrap/`

- `detail-pages/*.html` — 443 profile pages (Drupal 11 markup)
- `list-pages/*.html` — 23 paginated list pages (not parsed — profiles are the
  unit of work)
- `manifest.json` — enumerates all slugs and counts
- `genesis-partners-dump.zip` — archive of the scrape (not used by the app)

Per-profile fields observed across pages (9–15 fields each):

- Institution / person name (page title)
- Affiliation (e.g. "Academic institution", "Industry")
- Organization Type, Organization Size
- Website Address
- Introduction (rich text)
- National Science and Technology Challenges (1–4 tags)
- Offerings (rich text + tagged checkbox-notes)
- Capabilities Seeking (rich text + tagged checkbox-notes)
- Partner Type Seeking (list)
- Project Idea Summary
- Relevant Projects, Relevant Publications
- RFA # (some profiles)

The markup is stable Drupal: rows of `.fieldRow` with `.col-md-3.profileField`
labels and `.col-md-9.fieldValue` values, plus named classes like
`field--name-field-challenge-areas` for tag groups.

## Architecture

Static single-page application built with Vite + React + TypeScript. All data
is parsed at build time into JSON that ships with the app.

```
┌───────────────────────┐      build time      ┌──────────────────┐
│ detail-pages/*.html   │ ─── npm run build ─▶│ data/profiles.json│
│ manifest.json         │     (Node parser)   │ data/search.json  │
└───────────────────────┘                     │ data/network.json │
                                              └────────┬─────────┘
                                                       │ bundled
                                                       ▼
                                              ┌──────────────────┐
                                              │ React SPA (Vite) │
                                              │ static deploy    │
                                              └──────────────────┘
```

### Project layout

A new top-level `app/` directory, isolated from the scraped data:

```
DOE-Genesis-Scrap/
├── detail-pages/      ← existing raw data (read-only input)
├── list-pages/        ← existing
├── manifest.json      ← existing
└── app/               ← the navigator
    ├── scripts/parse.ts      HTML → JSON parser (Cheerio)
    ├── scripts/fixtures/     sample HTML for parser tests
    ├── src/                  React app source
    │   ├── routes/           route components
    │   ├── components/       shared UI components
    │   ├── lib/              filters, search, similarity, storage
    │   └── types.ts
    ├── public/data/          generated JSON (gitignored)
    ├── tests/                parser + app tests
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json
```

### Parser (`app/scripts/parse.ts`)

Node script, runs before `vite build`. Uses Cheerio for HTML parsing.

Outputs:

- `public/data/profiles.json` — array of `Profile` records
- `public/data/search.json` — Fuse.js prebuilt index
- `public/data/network.json` — adjacency list for the network view
  (`{ nodes: [{slug, name, affiliation}], edges: [{a, b, weight}] }`)
- `public/data/parse-errors.json` — per-file errors for triage (never fatal)

Malformed pages are logged and skipped; the build does not fail on them.

### `Profile` schema

```ts
type Profile = {
  slug: string;                         // "acceleration-consortium"
  name: string;
  kind: "person" | "organization";      // inferred from fields present
  affiliation?: string;
  orgType?: string;
  orgSize?: string;
  website?: string;
  introduction?: string;                // plain text, HTML-stripped
  challengeAreas: string[];
  offerings?: { text: string; tags: string[] };
  seeking?:   { text: string; tags: string[] };
  partnerTypeSeeking: string[];
  projectIdeaSummary?: string;
  relevantProjects?: string;
  relevantPublications?: string;
  rfaNumber?: string;
  rawHtmlPath: string;                  // relative path to original HTML
};
```

`kind` is inferred by which fields are present (e.g. an "Institution Name"
section vs. a person-style profile). If ambiguous, default to `"organization"`
and log to `parse-errors.json`.

## Routes and views

React Router (hash routing, for static-host friendliness).

| Route                | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `/`                  | Browse — filters + cards/table toggle       |
| `/profile/:slug`     | Profile detail page                         |
| `/compare`           | Side-by-side comparison of pinned profiles  |
| `/network`           | Force-directed overlap graph                |

### Browse page (`/`)

Layout: 240px filter sidebar + main pane. Main pane has a view toggle
(`[▦ Cards] [▤ Table]`) persisted in the URL (`?view=cards` | `?view=table`).

- **Cards view** — ~3-column grid. Each card: name, affiliation · org size,
  challenge-area chips, truncated offerings/seeking snippets, ⭐ favorite.
- **Table view** — dense rows: Name · Type · Size · Challenges · Offers ·
  Seeks · ⭐. Sortable by name, affiliation, richness.
- **Top bar** — app title, full-text search (⌘K), result count, active filter
  pills (click to remove).

All filter state (selected tags, search query, view mode, sort order) is
reflected in the URL so a filtered view is a shareable link.

### Filters (sidebar)

Every filter is multi-select, AND across categories, OR within a category,
with a count next to each value (count reflects the *other* filters applied).

- Challenge area
- Offers tag
- Seeking tag
- Partner type seeking
- Organization type
- Organization size
- Affiliation
- Favorites only (toggle)

### Profile detail (`/profile/:slug`)

Clean, readable rendering (not the raw Drupal layout). Sections:

1. Header — name, kind, affiliation, website, ⭐
2. Introduction
3. Challenge areas (chip row)
4. Offerings
5. Seeking
6. Partner type seeking
7. Project idea summary
8. Relevant projects, Relevant publications
9. "More like this" — carousel of 6 nearest neighbors
10. "View original" link → opens `rawHtmlPath` in a new tab as a fallback

### Compare (`/compare`)

Up to 5 pinned profiles shown as columns with aligned rows per field. Unpin
from column header. Export buttons: CSV and JSON. Pinned list stored in
`localStorage`, synced to URL when sharing.

### Network view (`/network`)

D3 force-directed graph:

- Nodes — profiles; size ∝ field richness (how many fields are filled)
- Edges — present if two profiles share ≥1 challenge area; weight = # shared
- Node color — by `affiliation` group (Academic / Industry / National Lab /
  Other)
- Legend + challenge-area chip filter. Chip clicks *highlight* a subset (dim
  the rest, preserve layout) rather than re-layout the graph.
- Click node → right-side slide-over with the mini profile preview + "Open
  full profile" link.

## Features

### Full-text search

Fuse.js with a prebuilt index. Weighted fields:

- `name` × 3
- `introduction` × 2
- `offerings.text`, `seeking.text`, `projectIdeaSummary` × 1

Invoked via `⌘K` (or the top-bar input). Returns ranked results; highlights
matched substrings. Typing narrows the currently filtered set rather than
replacing it.

### "More like this" / similarity

Pre-computed at build time. For each profile, rank all others by Jaccard
similarity over the union set:

```
{ challengeAreas } ∪ { partnerTypeSeeking } ∪ { offerings.tags }
```

Store top-6 neighbors per profile in `network.json` (or a sidecar). Rendered
as a carousel on every profile detail page.

### Favorites / shortlist

- ⭐ button on every card, table row, and profile detail header
- Stored in `localStorage` under a single key (`genesis.favorites`)
- "Favorites only" toggle in the filter sidebar
- Keyboard: `f` on hover/focus toggles favorite

### Compare / export

- `c` keyboard shortcut toggles compare for the focused profile
- Compare pane holds up to 5 profiles; warns on attempting a 6th
- Export: CSV (one row per profile, canonical columns) and JSON (raw
  `Profile` records)

### Keyboard

| Key    | Action                                   |
| ------ | ---------------------------------------- |
| `⌘K`   | Focus search                             |
| `f`    | Toggle favorite on focused card          |
| `c`    | Toggle compare on focused card / profile |
| `esc`  | Close slide-overs, clear search          |
| `/`    | Alternate search focus                   |

## Non-goals (explicit)

- No authentication — the deploy URL is the access control
- No backend, API, or database
- No data editing — the app is strictly read-only
- No re-scraping inside the app — data refresh is an out-of-band re-run of
  the scraper plus `npm run build`
- No PDF / print view
- No mobile-first polish (responsive layout only down to tablet width)

## Error handling

- **Parser** — per-file try/catch; record errors to `parse-errors.json` with
  slug + message + field hint; never fail the build
- **Missing fields** — render as nothing (no "N/A" placeholders)
- **External links** — `target="_blank" rel="noopener noreferrer"`
- **Unknown route / slug** — 404 page with link back to `/`
- **localStorage unavailable** (rare) — favorites and compare fall back to
  in-memory state; show a small notice on the first write failure

## Testing

Follows `superpowers:test-driven-development` during implementation.

- **Parser** — Vitest unit tests against ~8 fixture HTML files (picked to
  cover the 9/10/11/12/13/14/15-field variants observed, plus at least one
  person-style profile and one organization-style profile). Assert `Profile`
  shape and field extraction for each fixture.
- **App** — Vitest + React Testing Library for pure logic (filters,
  similarity, search wrapper, storage). Component tests for the filter
  sidebar, card, and compare column.
- **End-to-end** — one Playwright smoke test: load → apply a filter → click a
  profile → add to compare → verify compare page.

## Deployment

- Build: `cd app && npm run build` — runs parser then Vite build → `app/dist/`
- Target: Netlify or Vercel (drag-and-drop or CLI deploy)
- SPA routing fallback to `/index.html` (`netlify.toml` / `vercel.json`)
- Generated `public/data/` is gitignored; `.superpowers/` is also gitignored
  (or add to the existing `.gitignore`)

## Open questions / future work

None blocking. Possible v2 extensions (not in scope for this spec):

- A small Python script to re-scrape the source site and re-run the parser
- Personal notes on profiles (would require persistence beyond
  `localStorage`)
- Share-a-filtered-view by short code instead of raw URL
