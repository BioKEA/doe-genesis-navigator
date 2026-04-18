import { describe, it, expect } from "vitest";
import { jaccard, topNeighbors, buildEdges } from "../../scripts/lib/similarity";
import type { Profile } from "../../src/types";

function mk(partial: Partial<Profile>): Profile {
  return {
    slug: "x",
    name: "X",
    kind: "organization",
    challengeAreas: [],
    partnerTypeSeeking: [],
    rawHtmlPath: "x.html",
    ...partial,
  };
}

describe("jaccard", () => {
  it("returns 0 for empty sets", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
  it("returns 1 for identical sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("computes partial overlap", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
  });
});

describe("topNeighbors", () => {
  it("returns top-K by similarity, excluding self", () => {
    const profiles = [
      mk({ slug: "a", challengeAreas: ["x", "y"] }),
      mk({ slug: "b", challengeAreas: ["x", "y"] }),
      mk({ slug: "c", challengeAreas: ["z"] }),
      mk({ slug: "d", challengeAreas: ["y"] }),
    ];
    const neighbors = topNeighbors(profiles, 2);
    expect(neighbors["a"][0]).toBe("b");
    expect(neighbors["a"]).not.toContain("a");
  });
});

describe("buildEdges", () => {
  it("emits an edge for each shared challenge area", () => {
    const profiles = [
      mk({ slug: "a", challengeAreas: ["x", "y"] }),
      mk({ slug: "b", challengeAreas: ["y", "z"] }),
      mk({ slug: "c", challengeAreas: ["w"] }),
    ];
    const edges = buildEdges(profiles);
    const ab = edges.find((e) => e.a === "a" && e.b === "b");
    expect(ab?.weight).toBe(1);
    expect(edges.find((e) => e.a === "a" && e.b === "c")).toBeUndefined();
  });
});
