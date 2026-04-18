import Fuse, { type FuseIndex, type IFuseOptions } from "fuse.js";

export interface SearchDoc {
  slug: string;
  name: string;
  introduction: string;
  offerings: string;
  seeking: string;
  projectIdea: string;
}

const OPTIONS: IFuseOptions<SearchDoc> = {
  keys: [
    { name: "name", weight: 3 },
    { name: "introduction", weight: 2 },
    { name: "offerings", weight: 1 },
    { name: "seeking", weight: 1 },
    { name: "projectIdea", weight: 1 },
  ],
  threshold: 0.35,
  includeScore: true,
  ignoreLocation: true,
};

export function createFuse(
  docs: SearchDoc[],
  serialized: unknown,
): Fuse<SearchDoc> {
  const index = Fuse.parseIndex<SearchDoc>(serialized as FuseIndex<SearchDoc>);
  return new Fuse(docs, OPTIONS, index);
}

export function searchSlugs(
  fuse: Fuse<SearchDoc>,
  q: string,
): Set<string> | null {
  const query = q.trim();
  if (query.length === 0) return null; // null = "no search, keep all"
  return new Set(fuse.search(query).map((r) => r.item.slug));
}
