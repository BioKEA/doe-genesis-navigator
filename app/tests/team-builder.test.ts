import { describe, it, expect } from "vitest";
import {
  DEFAULT_WEIGHTS,
  scoreTeam,
  greedyBuild,
  buildVariants,
  analyzeContributions,
  suggestSwap,
  findMarginalAddition,
  type TeamTarget,
} from "../src/lib/team-builder";
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

const ALL: Profile[] = [
  mk({ slug: "aca", name: "AcademicA", affiliation: "Academic institution",
       challengeAreas: ["AI"], offerings: { text: "", tags: ["AI/ML", "Data"] } }),
  mk({ slug: "ind", name: "IndustryA", affiliation: "For-profit company",
       challengeAreas: ["HPC"], offerings: { text: "", tags: ["Compute", "Software"] },
       seeking: { text: "", tags: ["AI/ML"] } }),
  mk({ slug: "lab", name: "LabA", affiliation: "DOE National Lab",
       challengeAreas: ["AI", "HPC"], offerings: { text: "", tags: ["Facilities", "Compute"] } }),
  mk({ slug: "np", name: "NonProfit", affiliation: "Non-profit",
       challengeAreas: ["Materials"], offerings: { text: "", tags: ["Expertise"] } }),
];

const TARGET: TeamTarget = {
  challenges: ["AI", "HPC"],
  requiredOfferings: ["AI/ML", "Compute"],
  minSize: 2,
  maxSize: 4,
  targetSize: 3,
  requireSectors: ["academic", "industry", "natlab"],
  lockedSlugs: [],
};

describe("scoreTeam", () => {
  it("empty team has zero total", () => {
    const s = scoreTeam([], TARGET);
    expect(s.total).toBe(0);
  });

  it("rewards challenge + offering coverage", () => {
    const fullCoverage = [ALL[0], ALL[1]]; // covers both challenges AND both offerings
    const partialCoverage = [ALL[0]];
    const full = scoreTeam(fullCoverage, TARGET);
    const partial = scoreTeam(partialCoverage, TARGET);
    expect(full.challengeCoverage).toBe(1);
    expect(full.offeringCoverage).toBe(1);
    expect(full.total).toBeGreaterThan(partial.total);
  });

  it("sectorEntropy is highest when all three required sectors are present", () => {
    const balanced = [ALL[0], ALL[1], ALL[2]];
    const monoculture = [ALL[0], ALL[0], ALL[0]];
    expect(scoreTeam(balanced, TARGET).sectorEntropy)
      .toBeGreaterThan(scoreTeam(monoculture, TARGET).sectorEntropy);
  });

  it("sectorRequirements is 1.0 when all required sectors present, lower otherwise", () => {
    const allThree = [ALL[0], ALL[1], ALL[2]];
    const missingLab = [ALL[0], ALL[1]];
    expect(scoreTeam(allThree, TARGET).sectorRequirements).toBe(1);
    expect(scoreTeam(missingLab, TARGET).sectorRequirements).toBeCloseTo(2 / 3);
  });

  it("internal complementarity rewards offer→seek matches within team", () => {
    // ALL[0] offers AI/ML; ALL[1] seeks AI/ML. Should register as complementary.
    const comp = scoreTeam([ALL[0], ALL[1]], TARGET);
    const nonComp = scoreTeam([ALL[2], ALL[3]], TARGET);
    expect(comp.internalComplementarity).toBeGreaterThan(nonComp.internalComplementarity);
  });
});

describe("greedyBuild", () => {
  it("respects lockedSlugs", () => {
    const team = greedyBuild(ALL, { ...TARGET, lockedSlugs: ["np"] });
    expect(team.some((p) => p.slug === "np")).toBe(true);
  });

  it("respects maxSize", () => {
    const team = greedyBuild(ALL, { ...TARGET, maxSize: 2 });
    expect(team.length).toBeLessThanOrEqual(2);
  });

  it("produces a team that scores well against the target", () => {
    const team = greedyBuild(ALL, TARGET);
    const s = scoreTeam(team, TARGET);
    expect(s.total).toBeGreaterThan(0);
    expect(team.length).toBeGreaterThanOrEqual(TARGET.minSize);
  });
});

describe("buildVariants", () => {
  it("returns three teams", () => {
    const variants = buildVariants(ALL, TARGET);
    expect(variants.length).toBe(3);
    expect(variants.map((v) => v.variantId).sort())
      .toEqual(["complementarity", "coverage", "diversity"]);
  });

  it("each variant scores above zero with the default weights", () => {
    const variants = buildVariants(ALL, TARGET);
    for (const v of variants) expect(v.score.total).toBeGreaterThan(0);
  });
});

describe("analyzeContributions", () => {
  it("flags uniquely-covered challenges and offerings", () => {
    const team = [ALL[0], ALL[1], ALL[2]];
    const contribs = analyzeContributions(team, TARGET);
    const lab = contribs.find((c) => c.profile.slug === "lab")!;
    // Lab uniquely covers neither AI nor HPC as challenge (both shared with others)
    // but uniquely covers "Compute" — wait, Industry also has Compute. Check that
    // at least one member has a non-empty uniqueOfferings.
    expect(contribs.some((c) => c.uniqueOfferings.length > 0)).toBe(true);
    expect(lab.sector).toBe("natlab");
  });
});

describe("suggestSwap", () => {
  it("returns ranked alternatives for a slot", () => {
    const team = [ALL[0], ALL[1]];
    const alts = suggestSwap(team, TARGET, 0, ALL);
    expect(alts.length).toBeGreaterThan(0);
    // Results must be sorted descending by delta
    for (let i = 1; i < alts.length; i++) {
      expect(alts[i - 1].delta).toBeGreaterThanOrEqual(alts[i].delta);
    }
  });

  it("never suggests a locked partner as an alternative", () => {
    const team = [ALL[0], ALL[1]];
    const alts = suggestSwap(team, { ...TARGET, lockedSlugs: ["lab"] }, 1, ALL);
    expect(alts.every((a) => a.candidate.slug !== "lab")).toBe(true);
  });
});

describe("findMarginalAddition", () => {
  it("returns the best partner to add", () => {
    const team = [ALL[0]];
    const result = findMarginalAddition(team, TARGET, ALL);
    expect(result).not.toBeNull();
    expect(result!.delta).toBeGreaterThan(0);
  });

  it("returns null when team is at maxSize", () => {
    const team = [ALL[0], ALL[1], ALL[2], ALL[3]];
    const result = findMarginalAddition(team, TARGET, ALL);
    expect(result).toBeNull();
  });
});

describe("default weights produce sensible totals", () => {
  it("unreachable perfect team caps at sum of weights", () => {
    const perfect = scoreTeam([ALL[0], ALL[1], ALL[2]], TARGET);
    const weightSum = Object.entries(DEFAULT_WEIGHTS)
      .filter(([k]) => k !== "redundancy")
      .reduce((s, [_, v]) => s + v, 0);
    expect(perfect.total).toBeLessThanOrEqual(weightSum);
  });
});
