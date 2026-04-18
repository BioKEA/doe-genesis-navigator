import type { Profile } from "../types";

export interface FilterCriteria {
  q?: string;
  challenge?: string[];
  offers?: string[];
  seeking?: string[];
  partnerType?: string[];
  orgType?: string[];
  orgSize?: string[];
  affiliation?: string[];
  favoritesOnly?: boolean;
  favorites?: string[];
}

function hasAny(source: string[] | undefined, filter: string[] | undefined): boolean {
  if (!filter || filter.length === 0) return true;
  if (!source || source.length === 0) return false;
  return source.some((s) => filter.includes(s));
}

function eqAny(value: string | undefined, filter: string[] | undefined): boolean {
  if (!filter || filter.length === 0) return true;
  return !!value && filter.includes(value);
}

export function applyFilters(profiles: Profile[], c: FilterCriteria): Profile[] {
  const favSet = new Set(c.favorites ?? []);
  return profiles.filter((p) => {
    if (c.favoritesOnly && !favSet.has(p.slug)) return false;
    if (!hasAny(p.challengeAreas, c.challenge)) return false;
    if (!hasAny(p.offerings?.tags, c.offers)) return false;
    if (!hasAny(p.seeking?.tags, c.seeking)) return false;
    if (!hasAny(p.partnerTypeSeeking, c.partnerType)) return false;
    if (!eqAny(p.orgType, c.orgType)) return false;
    if (!eqAny(p.orgSize, c.orgSize)) return false;
    if (!eqAny(p.affiliation, c.affiliation)) return false;
    return true;
  });
}

export type Facet =
  | "challenge" | "offers" | "seeking" | "partnerType"
  | "orgType"   | "orgSize" | "affiliation";

export type FacetCounts = Record<Facet, Record<string, number>>;

export function facetCounts(profiles: Profile[], c: FilterCriteria): FacetCounts {
  const init = (): FacetCounts => ({
    challenge: {}, offers: {}, seeking: {}, partnerType: {},
    orgType: {}, orgSize: {}, affiliation: {},
  });
  const counts = init();

  // Count each facet against the profiles that pass every OTHER filter (Airtable-style).
  const facets: Facet[] = [
    "challenge", "offers", "seeking", "partnerType",
    "orgType", "orgSize", "affiliation",
  ];
  for (const facet of facets) {
    const without: FilterCriteria = { ...c, [facet]: [] };
    const candidates = applyFilters(profiles, without);
    for (const p of candidates) {
      const values = facetValues(p, facet);
      for (const v of values) counts[facet][v] = (counts[facet][v] ?? 0) + 1;
    }
  }
  return counts;
}

function facetValues(p: Profile, f: Facet): string[] {
  switch (f) {
    case "challenge":   return p.challengeAreas;
    case "offers":      return p.offerings?.tags ?? [];
    case "seeking":     return p.seeking?.tags ?? [];
    case "partnerType": return p.partnerTypeSeeking;
    case "orgType":     return p.orgType ? [p.orgType] : [];
    case "orgSize":     return p.orgSize ? [p.orgSize] : [];
    case "affiliation": return p.affiliation ? [p.affiliation] : [];
  }
}

export type SortKey = "relevance" | "name" | "affiliation" | "richness";

export function sortProfiles(
  profiles: Profile[],
  key: SortKey,
  richness?: Map<string, number>,
): Profile[] {
  const arr = profiles.slice();
  switch (key) {
    case "name":
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "affiliation":
      arr.sort((a, b) =>
        (a.affiliation ?? "").localeCompare(b.affiliation ?? "") ||
        a.name.localeCompare(b.name));
      break;
    case "richness":
      arr.sort((a, b) =>
        (richness?.get(b.slug) ?? 0) - (richness?.get(a.slug) ?? 0));
      break;
    case "relevance":
    default:
      // fall back to name; real relevance comes from the search wrapper
      arr.sort((a, b) => a.name.localeCompare(b.name));
  }
  return arr;
}
