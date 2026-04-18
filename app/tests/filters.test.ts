import { describe, it, expect } from "vitest";
import { applyFilters, facetCounts, sortProfiles } from "../src/lib/filters";
import type { Profile } from "../src/types";

function mk(p: Partial<Profile>): Profile {
  return {
    slug: "x", name: "X", kind: "organization",
    challengeAreas: [], partnerTypeSeeking: [],
    rawHtmlPath: "x.html", ...p,
  };
}

const DATA: Profile[] = [
  mk({ slug: "a", name: "Alpha", affiliation: "Academic", orgSize: "Small",
       challengeAreas: ["AI"], partnerTypeSeeking: ["Industry"] }),
  mk({ slug: "b", name: "Beta", affiliation: "Industry", orgSize: "Large",
       challengeAreas: ["HPC"], partnerTypeSeeking: ["Academic"] }),
  mk({ slug: "c", name: "Gamma", affiliation: "Academic", orgSize: "Large",
       challengeAreas: ["AI", "HPC"], partnerTypeSeeking: ["Industry"] }),
];

describe("applyFilters", () => {
  it("returns all when no filters set", () => {
    expect(applyFilters(DATA, {}).length).toBe(3);
  });
  it("AND across categories, OR within", () => {
    const r = applyFilters(DATA, {
      challenge: ["AI"],
      affiliation: ["Academic"],
    });
    expect(r.map((p) => p.slug).sort()).toEqual(["a", "c"]);
  });
  it("supports favoritesOnly", () => {
    const r = applyFilters(DATA, { favoritesOnly: true, favorites: ["b"] });
    expect(r.map((p) => p.slug)).toEqual(["b"]);
  });
});

describe("facetCounts", () => {
  it("counts values within the filtered set", () => {
    const counts = facetCounts(DATA, {});
    expect(counts.affiliation["Academic"]).toBe(2);
    expect(counts.challenge["HPC"]).toBe(2);
  });
});

describe("sortProfiles", () => {
  it("sorts by name", () => {
    expect(sortProfiles(DATA, "name").map((p) => p.slug)).toEqual(["a", "b", "c"]);
  });
});
