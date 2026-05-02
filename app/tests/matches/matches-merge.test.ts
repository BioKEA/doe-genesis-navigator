import { describe, expect, it } from "vitest";
import { topKMatchesPerPartner } from "../../scripts/matches/lib/matches-merge";
import type { Match } from "../../src/types";

const m = (from: string, to: string, score: number): Match => ({
  from, to, score, rationale: "", sharedConcepts: [], reciprocal: false,
});

describe("topKMatchesPerPartner", () => {
  it("keeps top-K outgoing per from, preserving overall sort order", () => {
    const matches = [
      m("a", "x", 0.9), m("a", "y", 0.8), m("a", "z", 0.7), m("a", "w", 0.6),
      m("b", "x", 0.85),
    ];
    const out = topKMatchesPerPartner(matches, 2);
    const fromA = out.filter((x) => x.from === "a");
    const fromB = out.filter((x) => x.from === "b");
    expect(fromA).toHaveLength(2);
    expect(fromA.map((x) => x.to)).toEqual(["x", "y"]);
    expect(fromB).toHaveLength(1);
  });

  it("returns input unchanged when K is larger than any per-from group", () => {
    const matches = [m("a", "x", 0.9), m("a", "y", 0.8)];
    expect(topKMatchesPerPartner(matches, 10)).toEqual(matches);
  });
});
