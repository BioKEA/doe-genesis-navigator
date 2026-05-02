import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Concept, ConceptCandidate, ConceptCategory, ConceptsArtifact } from "./lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, "curate.html");
const CANDIDATES_PATH = resolve(__dirname, "../../build/concept-candidates.json");
const OUT_PATH = resolve(__dirname, "../../data-source/concepts.json");
const PORT = 5180;

interface CurationConcept extends Concept {
  dropped?: boolean;
}

interface CurationState {
  categories: ConceptCategory[];
  concepts: CurationConcept[];
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function loadInitialState(): CurationState {
  if (existsSync(OUT_PATH)) {
    // Resume an in-progress curation session
    const existing = JSON.parse(readFileSync(OUT_PATH, "utf8")) as ConceptsArtifact;
    return {
      categories: existing.categories,
      concepts: existing.concepts.map((c) => ({ ...c })),
    };
  }
  // Bootstrap from candidates
  const cand = JSON.parse(readFileSync(CANDIDATES_PATH, "utf8")) as {
    categories: ConceptCategory[];
    candidates: ConceptCandidate[];
  };
  const used = new Set<string>();
  const fallbackCat = cand.categories[0]?.id ?? "uncategorized";
  const concepts: CurationConcept[] = cand.candidates.map((c) => {
    // Defensive: LLM occasionally returns a candidate with no label/category.
    // Fall back to the first member phrase (titleized) and the first category.
    const rawLabel = (c.suggestedLabel && c.suggestedLabel.trim().length > 0)
      ? c.suggestedLabel
      : (c.members[0] ?? `cluster-${c.clusterId}`);
    const label = rawLabel.replace(/\b\w/g, (m) => m.toUpperCase());
    const categoryId = c.suggestedCategory && c.suggestedCategory.trim().length > 0
      ? c.suggestedCategory
      : fallbackCat;

    let id = slugify(label) || `cluster-${c.clusterId}`;
    let n = 2;
    const root = id;
    while (used.has(id)) id = `${root}-${n++}`;
    used.add(id);
    return {
      id,
      label,
      categoryId,
      memberPhrases: c.members,
    };
  });
  return { categories: cand.categories, concepts };
}

function saveState(state: CurationState): void {
  const live = state.concepts.filter((c) => !c.dropped);
  const out: ConceptsArtifact = {
    generatedAt: new Date().toISOString(),
    categories: state.categories,
    concepts: live.map((c) => ({
      id: c.id,
      label: c.label,
      categoryId: c.categoryId,
      memberPhrases: c.memberPhrases,
    })),
  };
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
}

let state = loadInitialState();

// The UI state uses `members` as the field name (clearer in the browser);
// we map between the persisted shape (`memberPhrases`) on the wire.
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
    const ui = JSON.parse(body) as {
      categories: ConceptCategory[];
      concepts: { id: string; label: string; categoryId: string; members: string[]; dropped?: boolean }[];
    };
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
  // Persist initial state immediately so OUT_PATH exists from the start
  saveState(state);
});
