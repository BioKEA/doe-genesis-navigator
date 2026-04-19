import { describe, it, expect } from "vitest";
import { buildCoverageMatrix } from "../src/lib/coverage";
import type { Profile } from "../src/types";

function mk(p: Partial<Profile>): Profile {
  return {
    slug: p.slug ?? "x",
    name: p.name ?? "X",
    kind: "organization",
    challengeAreas: [],
    partnerTypeSeeking: [],
    rawHtmlPath: "x.html",
    ...p,
  };
}

const TEAM: Profile[] = [
  mk({ slug: "a", name: "A", affiliation: "Academic institution",
       challengeAreas: ["AI", "HPC"],
       offerings: { text: "long description here for richness purposes over 100 chars which is plenty to exceed the threshold", tags: ["AI/ML", "Compute"] }}),
  mk({ slug: "b", name: "B", affiliation: "For-profit company",
       challengeAreas: ["HPC"],
       offerings: { text: "", tags: ["Compute"] }}),
  mk({ slug: "c", name: "C", affiliation: "DOE National Lab",
       challengeAreas: ["AI"],
       offerings: { text: "", tags: ["AI/ML", "Facilities"] }}),
];

describe("buildCoverageMatrix", () => {
  it("emits a row per challenge and per offering", () => {
    const m = buildCoverageMatrix(TEAM, ["AI", "HPC", "Materials"], ["AI/ML"], []);
    expect(m.rows.length).toBe(4);
    expect(m.rows.filter(r => r.kind === "challenge").length).toBe(3);
    expect(m.rows.filter(r => r.kind === "offering").length).toBe(1);
  });

  it("flags uncovered challenges as gaps", () => {
    const m = buildCoverageMatrix(TEAM, ["AI", "Materials"], [], []);
    const materialsGap = m.gaps.find(g => g.label === "Materials" && g.kind === "challenge");
    expect(materialsGap).toBeDefined();
    expect(materialsGap!.severity).toBe("critical");
  });

  it("flags thinly covered rows as warnings", () => {
    // Materials isn't covered at all, but a single-member coverage of another challenge
    const m = buildCoverageMatrix([TEAM[0]], ["AI", "HPC"], [], []);
    expect(m.gaps.some(g => g.severity === "warning")).toBe(true);
  });

  it("flags missing required sectors", () => {
    const m = buildCoverageMatrix([TEAM[0]], [], [], ["academic", "industry", "natlab"]);
    const sectorGaps = m.gaps.filter(g => g.kind === "sector");
    expect(sectorGaps.length).toBe(2); // missing industry + natlab
  });

  it("strength is 0 when member does not cover the row", () => {
    const m = buildCoverageMatrix(TEAM, ["Materials"], [], []);
    expect(m.rows[0].cells.every(c => c.strength === 0)).toBe(true);
    expect(m.rows[0].status).toBe("gap");
  });

  it("cells reflect challenge strength based on offering depth", () => {
    const m = buildCoverageMatrix(TEAM, ["AI"], [], []);
    const row = m.rows[0];
    // Member A has 2 offerings → strength 2; member C has 2 offerings → strength 2
    expect(row.cells[0].strength).toBe(2);
    expect(row.cells[1].strength).toBe(0); // B doesn't tag AI
    expect(row.cells[2].strength).toBe(2);
  });
});
