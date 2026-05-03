import { describe, expect, it } from "vitest";
import { selectTopKMatchEdges } from "../../src/canvas/lib/match-edges";
import type { Match } from "../../src/types";

const m = (from: string, to: string, score: number, reciprocal = false): Match => ({
  from, to, score, reciprocal,
  rationale: "x", sharedConcepts: ["c1"],
});

describe("selectTopKMatchEdges", () => {
  it("keeps top-K per `from` partner", () => {
    const matches = [
      m("a", "b", 0.9), m("a", "c", 0.8), m("a", "d", 0.7), m("a", "e", 0.6),
      m("b", "a", 0.85),
    ];
    const out = selectTopKMatchEdges(matches, 2);
    const aEdges = out.filter((x) => x.from === "a");
    expect(aEdges.map((e) => e.to)).toEqual(["b", "c"]);
    expect(out.filter((x) => x.from === "b")).toHaveLength(1);
  });

  it("returns empty when k is 0", () => {
    expect(selectTopKMatchEdges([m("a", "b", 0.9)], 0)).toEqual([]);
  });

  it("preserves reciprocal flag and sharedConcepts on returned edges", () => {
    const out = selectTopKMatchEdges([m("a", "b", 0.9, true)], 5);
    expect(out[0].reciprocal).toBe(true);
    expect(out[0].sharedConcepts).toEqual(["c1"]);
  });
});
