import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import type {
  ConceptsArtifact,
  ParseError,
  Profile,
  ProfileConceptMap,
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
import { buildSearchIndex } from "./lib/search-index";
import { attachConceptIds } from "./concepts/lib/merge";
import { topKMatchesPerPartner } from "./matches/lib/matches-merge";
import type { Match } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

  const PUBLIC_DETAIL_DIR = resolve(__dirname, "../public/detail-pages");
  cpSync(SOURCE_DIR, PUBLIC_DETAIL_DIR, { recursive: true });

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

  // Merge curated concept layer if available (Plan 1 of the knowledge-graph redesign)
  const CONCEPTS_PATH = resolve(__dirname, "../data-source/concepts.json");
  const PROFILE_CONCEPTS_PATH = resolve(__dirname, "../data-source/profile-concepts.json");
  let mergedProfiles = profiles;
  if (existsSync(CONCEPTS_PATH) && existsSync(PROFILE_CONCEPTS_PATH)) {
    const map = JSON.parse(readFileSync(PROFILE_CONCEPTS_PATH, "utf8")) as ProfileConceptMap;
    mergedProfiles = attachConceptIds(profiles, map);
    const concepts = JSON.parse(readFileSync(CONCEPTS_PATH, "utf8")) as ConceptsArtifact;
    writeFileSync(join(OUT_DIR, "concepts.json"), JSON.stringify(concepts));
    writeFileSync(join(OUT_DIR, "profile-concepts.json"), JSON.stringify(map));
    console.log(`merged ${concepts.concepts.length} concepts, tagged ${Object.keys(map).length} profiles`);
  } else {
    console.log("no concepts.json found — skipping concept merge (run npm run concepts first)");
  }

  // Merge match layer if available (Plan 2 of the knowledge-graph redesign).
  // Source artifact is gzipped (~3 MB) so it fits under hosting CLI upload
  // limits; the plain JSON (~20 MB) is gitignored. Both are read here.
  const MATCHES_GZ = resolve(__dirname, "../data-source/matches.json.gz");
  const MATCHES_JSON = resolve(__dirname, "../data-source/matches.json");
  let matchesRaw: string | null = null;
  if (existsSync(MATCHES_GZ)) {
    matchesRaw = gunzipSync(readFileSync(MATCHES_GZ)).toString("utf8");
  } else if (existsSync(MATCHES_JSON)) {
    matchesRaw = readFileSync(MATCHES_JSON, "utf8");
  }
  if (matchesRaw) {
    const matches = JSON.parse(matchesRaw) as Match[];
    // Cap to top-20 per partner for shipping (runtime slider goes 3-20).
    const trimmed = topKMatchesPerPartner(matches, 20);
    writeFileSync(join(OUT_DIR, "matches.json"), JSON.stringify(trimmed));
    console.log(
      `merged ${matches.length} matches → ${trimmed.length} after top-20 cap`,
    );
  } else {
    console.log("no matches.json[.gz] found — skipping match merge (run npm run matches first)");
  }

  const search = buildSearchIndex(mergedProfiles);

  writeFileSync(join(OUT_DIR, "profiles.json"), JSON.stringify(mergedProfiles));
  writeFileSync(join(OUT_DIR, "search.json"), JSON.stringify(search));
  writeFileSync(join(OUT_DIR, "parse-errors.json"), JSON.stringify(errors, null, 2));

  console.log(
    `parsed ${profiles.length} profiles, ${errors.length} errors`,
  );
}

main();
