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
