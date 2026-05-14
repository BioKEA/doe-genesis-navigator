# DOE Genesis Mission Partner Navigator

End-to-end pipeline for scraping the
[DOE Genesis Mission Partnership Exchange](https://partnerships.genesismissionconsortium.org/),
extracting a curated concept layer from the resulting partner profiles, scoring
directional offer→seek matches between partners, and rendering everything as an
interactive knowledge graph in the browser.

The corpus is **frozen** at 486 partners — heavy LLM passes run once offline,
the artifacts are committed, and the deployed site never calls an LLM at runtime.

## What's here

| Area | Path | What it does |
|---|---|---|
| Web app | [`app/`](app/) | React + Vite + sigma.js single-canvas knowledge-graph navigator. **Start here** — see [`app/README.md`](app/README.md). |
| Scraper | `app/scripts/scrape.ts` | Drives a logged-in Chrome session via CDP to fetch each partner's detail page. |
| Raw HTML | `detail-pages/` | One HTML file per partner — input to the parser. |
| Parser | `app/scripts/parse.ts` | Cheerio-based extraction → `app/public/data/profiles.json` (and a few other JSON bundles the runtime loads). |
| Concept pipeline | `app/scripts/concepts/` | LLM extract → local embed → DBSCAN cluster → LLM label → human curate → LLM re-tag. Emits `concepts.json` + `profile-concepts.json`. |
| Match pipeline | `app/scripts/matches/` | Per-field re-tag → candidate generation (concept-overlap pre-filter) → Claude Haiku scoring with one-sentence rationales → reciprocity finalize. Emits `matches.json` (29,443 scored edges). |
| Specs + plans | `docs/superpowers/` | Design specs and plan documents that drove the build. |

## Quick start

The app is the front door. From a fresh clone:

```bash
cd app
npm install
npm run parse    # build the JSON dataset from ../detail-pages/
npm run dev      # http://localhost:5173
```

Open the URL — the bipartite partner↔concept graph renders immediately.
Toggle "Show offer→seek matches" in the left rail to see the C-overlay
of pink match edges.

## The data flow

```
   site            scraper          parser         offline LLM passes
 ┌──────┐  CDP   ┌────────┐  HTML ┌────────┐ JSON ┌───────────────────┐
 │ DOE  │ ─────▶ │ scrape │ ────▶ │ parse  │ ───▶ │ concepts/ matches │
 │ site │        └────────┘       └────────┘      └─────────┬─────────┘
 └──────┘                                                   │
                                                  committed │ JSON
                                                            ▼
                                              ┌─────────────────────┐
                                              │ React + sigma canvas│
                                              └─────────────────────┘
```

- **Scraping** is manual and rare (the corpus is frozen).
- **Parsing** runs at every `npm run dev` / `npm run build` — it's pure
  HTML→JSON and merges in the curated concept layer + match edges.
- **Concept and match pipelines** are one-shot offline. Their outputs
  (`app/data-source/*.json`) are committed; production builds never call
  an LLM. See `app/README.md` for the run instructions and cost notes.

## Deploy

Vercel monorepo deploy from `app/`. The root [`vercel.json`](vercel.json)
points the build at the app subdirectory; SPA routing falls back to
`app/index.html`. See `app/README.md` for both the GitHub-integration
flow and the one-shot CLI deploy.

## License

[MIT](LICENSE), © 2026 BioKEA. The license covers the code and the curated
artifacts produced by the offline pipelines (concepts, matches). Raw scraped
HTML in `detail-pages/` is the property of the original profile authors and
the DOE Genesis program operators — it is included only for build
reproducibility. The BioKEA logo and brand assets are not licensed for
derivative use. See [LICENSE](LICENSE) for the full scope.

## Status

Three plans shipped on `main`:

- **Plan 1** — concept extraction pipeline + manual curation UI (126 curated concepts across 12 categories)
- **Plan 2** — match scoring pipeline (29,443 directional matches, 7,836 reciprocal)
- **Plan 3** — Canvas MVP: bipartite graph + match overlay, single-route app

Plans 4+ (project-centered "D lens", onboarding overlay, multi-select compare,
edge-styling polish) are scoped in the design spec at
`docs/superpowers/specs/2026-05-02-knowledge-graph-redesign-design.md`.
