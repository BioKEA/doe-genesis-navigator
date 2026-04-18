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
