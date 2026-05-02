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

## Build

```bash
npm run build   # runs the parser + Vite build, output in dist/
```

`dist/` is ~25 MB: ~12 MB `data/` (JSON bundle), ~13 MB `detail-pages/`
(raw scraped HTML used by the "View original" links), plus the ~300 KB
app itself. All static, no runtime.

## Concept extraction pipeline (one-shot, offline)

The Canvas UI (Plan 1+ of the knowledge-graph redesign) needs a curated
concept layer. This is a manual one-shot pipeline; the resulting JSON
files in `app/data-source/` are committed and the production build never
calls LLMs.

```bash
# 1. Set ANTHROPIC_API_KEY in app/.env (see app/.env.example)

# 2. Pre-curation pipeline (extract → embed → cluster → label)
npm run concepts                    # ~10-15 min, ~$3-5 in Haiku calls

# 3. Manual curation (~1-2 hours, single sitting)
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

## Deploy to Vercel (Hobby / free tier)

Two options.

### Option A — GitHub integration (recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Import the repo: `BioKEA/doe-genesis-navigator`.
3. Override these project settings:
   - **Root Directory**: `app`
   - Framework preset, build command, output dir, install command — all
     auto-detected from `app/vercel.json`. Leave as detected.
4. Click **Deploy**. You get a `*.vercel.app` URL in ~30 seconds.

Future pushes to `main` auto-deploy. Every pull request gets its own
preview URL.

### Option B — one-shot CLI deploy

```bash
npm install -g vercel
cd app
vercel                # preview deploy (walks you through linking the project)
vercel --prod         # promote to production
```

The `app/vercel.json` in this repo pins the SPA-routing fallback, asset
caching, and build command.

## Routing + static assets

`src/App.tsx` uses `HashRouter`, so routes live in the URL fragment
(`#/profile/abel-souza`). Vercel serves `index.html` for any path that
isn't a static file under `data/`, `detail-pages/`, `assets/`, or
`favicon*`/`icons*`. That rule is in [`vercel.json`](vercel.json).
