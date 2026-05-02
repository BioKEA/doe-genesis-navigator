import { describe, expect, it } from "vitest";
import { buildCandidatePairs } from "../../scripts/matches/lib/candidates";
import type { ProfileFieldConceptsMap } from "../../src/types";

describe("buildCandidatePairs", () => {
  it("emits ordered pairs where from.offer overlaps to.seek", () => {
    const fc: ProfileFieldConceptsMap = {
      a: { offer: ["x", "y"], seek: ["z"] },
      b: { offer: ["z"], seek: ["x"] },
      c: { offer: [], seek: ["y", "x"] },
    };
    const pairs = buildCandidatePairs(fc).sort((p, q) =>
      p.from.localeCompare(q.from) || p.to.localeCompare(q.to),
    );
    // a.offer={x,y} → b.seek={x} : shared=[x]
    // a.offer={x,y} → c.seek={y,x} : shared=[x,y] (any order)
    // b.offer={z} → a.seek={z} : shared=[z]
    // c.offer={} → no candidates
    expect(pairs).toHaveLength(3);
    expect(pairs[0]).toEqual({ from: "a", to: "b", sharedConcepts: ["x"] });
    expect(pairs[1].from).toBe("a");
    expect(pairs[1].to).toBe("c");
    expect(pairs[1].sharedConcepts.sort()).toEqual(["x", "y"]);
    expect(pairs[2]).toEqual({ from: "b", to: "a", sharedConcepts: ["z"] });
  });

  it("skips self-pairs even when offer intersects own seek", () => {
    const fc: ProfileFieldConceptsMap = {
      a: { offer: ["x"], seek: ["x"] },
    };
    expect(buildCandidatePairs(fc)).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(buildCandidatePairs({})).toEqual([]);
  });

  it("emits no pair when no overlap exists", () => {
    const fc: ProfileFieldConceptsMap = {
      a: { offer: ["x"], seek: ["y"] },
      b: { offer: ["z"], seek: ["w"] },
    };
    expect(buildCandidatePairs(fc)).toEqual([]);
  });
});
