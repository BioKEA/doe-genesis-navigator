import { chromium, type BrowserContext } from "@playwright/test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(__dirname, "..");
const ROOT = resolve(APP_DIR, "..");
const LIST_DIR = join(ROOT, "list-pages");
const DETAIL_DIR = join(ROOT, "detail-pages");
const MANIFEST = join(ROOT, "manifest.json");

const BASE = "https://partnerships.genesismissionconsortium.org";
const CHALLENGE = "33%2C25%2C16";
const searchUrl = (p: number) =>
  `${BASE}/search/partners?challenge=${CHALLENGE}&page=${p}`;
const participantUrl = (slug: string) => `${BASE}/participant/${slug}`;
const DASHBOARD = `${BASE}/my/dashboard`;

const CDP_URL = process.env.CHROME_CDP_URL || "http://localhost:9222";
const REQUEST_DELAY_MS = 400;
const MAX_LIST_PAGES = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function probeCdp(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/json/version`);
    return r.ok;
  } catch {
    return false;
  }
}

function printCdpHelp(): void {
  console.error(`
Could not reach Chrome DevTools at ${CDP_URL}.

To connect to your active Chrome window with your real profile:

  1. Fully quit Chrome (Cmd+Q in the Chrome menu — closing the window
     is not enough; the app must exit).

  2. Relaunch it with the debug port. Pick the form that matches your setup:

       # default profile
       open -na "Google Chrome" --args --remote-debugging-port=9222

       # specific profile (if you have multiple — check chrome://version)
       open -na "Google Chrome" --args \\
         --remote-debugging-port=9222 \\
         --profile-directory="Default"

     Your cookies, logins, and bookmarks are preserved — this is your
     normal Chrome with the debug port enabled.

  3. Confirm the partnerships site is logged in
     (${BASE}/my/dashboard should load without redirecting).

  4. Re-run \`npm run scrape\`.

If your Chrome lives somewhere non-standard or you use a different port,
set CHROME_CDP_URL, e.g. CHROME_CDP_URL=http://localhost:9333 npm run scrape.
`);
}

async function connectToActiveChrome(): Promise<{
  context: BrowserContext;
  disconnect: () => Promise<void>;
}> {
  if (!(await probeCdp(CDP_URL))) {
    printCdpHelp();
    process.exit(1);
  }
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.error(
      "Connected to Chrome but found no browser contexts. Is Chrome actually running with a window open?",
    );
    await browser.close();
    process.exit(1);
  }
  // The default context holds your real profile (cookies, storage, etc).
  const context = contexts[0];
  return {
    context,
    // close() over CDP disconnects Playwright; it does NOT close your Chrome.
    disconnect: async () => browser.close(),
  };
}

async function verifyAuth(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  try {
    const resp = await page.goto(DASHBOARD, { waitUntil: "domcontentloaded" });
    const finalUrl = page.url();
    const looksLoggedOut = /\/(login|signin|sign-in|auth)/i.test(finalUrl);
    if (!resp || resp.status() >= 400 || looksLoggedOut) {
      throw new Error(
        `auth check failed: status=${resp?.status()} url=${finalUrl} — log in to ${BASE} in your Chrome window first, then re-run`,
      );
    }
  } finally {
    await page.close();
  }
}

function extractSlugs(html: string): string[] {
  const matches = html.matchAll(/href="\/participant\/([^"#?]+)"/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

async function scrapeListPages(context: BrowserContext): Promise<string[]> {
  rmSync(LIST_DIR, { recursive: true, force: true });
  mkdirSync(LIST_DIR, { recursive: true });

  const allSlugs: string[] = [];
  const seen = new Set<string>();
  const page = await context.newPage();

  try {
    for (let i = 0; i < MAX_LIST_PAGES; i++) {
      const url = searchUrl(i);
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const html = await page.content();
      const slugs = extractSlugs(html);
      if (slugs.length === 0) {
        console.log(`  list page ${i}: empty — stopping pagination`);
        break;
      }
      const fname = `list_page_${String(i).padStart(2, "0")}.html`;
      writeFileSync(join(LIST_DIR, fname), html);
      let added = 0;
      for (const s of slugs) {
        if (!seen.has(s)) {
          seen.add(s);
          allSlugs.push(s);
          added++;
        }
      }
      console.log(
        `  list page ${i}: ${slugs.length} slugs (${added} new on this page)`,
      );
      await sleep(REQUEST_DELAY_MS);
    }
  } finally {
    await page.close();
  }
  return allSlugs;
}

async function scrapeDetailPages(
  context: BrowserContext,
  slugs: string[],
): Promise<{ slug: string; message: string }[]> {
  mkdirSync(DETAIL_DIR, { recursive: true });
  const errors: { slug: string; message: string }[] = [];
  const page = await context.newPage();
  try {
    let i = 0;
    for (const slug of slugs) {
      i++;
      try {
        const resp = await page.goto(participantUrl(slug), {
          waitUntil: "domcontentloaded",
        });
        if (!resp) throw new Error("no response");
        if (resp.status() !== 200) throw new Error(`status ${resp.status()}`);
        const html = await page.content();
        writeFileSync(join(DETAIL_DIR, `${slug}.html`), html);
        console.log(`  [${i}/${slugs.length}] ${slug}: ok`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  [${i}/${slugs.length}] ${slug}: ${message}`);
        errors.push({ slug, message });
      }
      await sleep(REQUEST_DELAY_MS);
    }
  } finally {
    await page.close();
  }
  return errors;
}

function writeManifest(
  errors: { slug: string; message: string }[],
): void {
  const detailFiles = readdirSync(DETAIL_DIR)
    .filter((f) => f.endsWith(".html"))
    .sort();
  const listFiles = readdirSync(LIST_DIR)
    .filter((f) => f.endsWith(".html"))
    .sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: BASE,
    searchUrl: searchUrl(0),
    totalFiles: detailFiles.length + listFiles.length,
    listPageCount: listFiles.length,
    detailPageCount: detailFiles.length,
    slugs: detailFiles.map((f) => f.replace(/\.html$/, "")),
    errors,
  };
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

function loadExistingSlugs(): Set<string> {
  if (!existsSync(DETAIL_DIR)) return new Set();
  return new Set(
    readdirSync(DETAIL_DIR)
      .filter((f) => f.endsWith(".html"))
      .map((f) => f.replace(/\.html$/, "")),
  );
}

function loadPriorManifestSlugCount(): number | null {
  if (!existsSync(MANIFEST)) return null;
  try {
    const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
    return m.detailPageCount ?? (Array.isArray(m.slugs) ? m.slugs.length : null);
  } catch {
    return null;
  }
}

async function main() {
  const priorCount = loadPriorManifestSlugCount();
  console.log(`Connecting to Chrome at ${CDP_URL}…`);
  console.log(`Prior manifest detail count: ${priorCount ?? "(none)"}\n`);

  const { context, disconnect } = await connectToActiveChrome();

  try {
    await verifyAuth(context);
    console.log("Auth verified (you're logged in).\n");

    console.log("Scraping list pages…");
    const allSlugs = await scrapeListPages(context);
    console.log(`Found ${allSlugs.length} unique slugs across list pages.\n`);

    const existing = loadExistingSlugs();
    const newSlugs = allSlugs.filter((s) => !existing.has(s));
    console.log(`${newSlugs.length} new slugs to fetch.`);

    let errors: { slug: string; message: string }[] = [];
    if (newSlugs.length > 0) {
      console.log("Fetching new detail pages…");
      errors = await scrapeDetailPages(context, newSlugs);
    }

    writeManifest(errors);

    console.log("\nDone.");
    console.log(
      `  list pages: ${readdirSync(LIST_DIR).filter((f) => f.endsWith(".html")).length}`,
    );
    console.log(
      `  detail pages: ${readdirSync(DETAIL_DIR).filter((f) => f.endsWith(".html")).length}`,
    );
    console.log(`  new this run: ${newSlugs.length}`);
    console.log(`  fetch errors: ${errors.length}`);
    if (newSlugs.length > 0) {
      console.log(
        "\nNext: run `npm run parse` to refresh the app's JSON dataset.",
      );
    }
  } finally {
    await disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
