import { describe, expect, it } from "vitest";
import { finalizeMatches } from "../../scripts/matches/lib/finalize";

describe("finalizeMatches", () => {
  it("sorts by from then score desc and detects reciprocity", () => {
    const scored = [
      { from: "a", to: "b", score: 0.9, rationale: "ab", sharedConcepts: ["x"] },
      { from: "b", to: "a", score: 0.8, rationale: "ba", sharedConcepts: ["y"] },
      { from: "a", to: "c", score: 0.6, rationale: "ac", sharedConcepts: ["z"] },
      { from: "a", to: "d", score: 0.7, rationale: "ad", sharedConcepts: ["w"] },
    ];
    const out = finalizeMatches(scored);
    // sorted: a→b (0.9), a→d (0.7), a→c (0.6), b→a (0.8)
    expect(out.map((m) => `${m.from}-${m.to}`)).toEqual(["a-b", "a-d", "a-c", "b-a"]);
    // a→b and b→a are both present → both reciprocal
    expect(out.find((m) => m.from === "a" && m.to === "b")!.reciprocal).toBe(true);
    expect(out.find((m) => m.from === "b" && m.to === "a")!.reciprocal).toBe(true);
    // a→d has no d→a → not reciprocal
    expect(out.find((m) => m.from === "a" && m.to === "d")!.reciprocal).toBe(false);
  });

  it("handles empty input", () => {
    expect(finalizeMatches([])).toEqual([]);
  });

  it("a single direction is never reciprocal", () => {
    const out = finalizeMatches([
      { from: "a", to: "b", score: 0.9, rationale: "ab", sharedConcepts: ["x"] },
    ]);
    expect(out[0].reciprocal).toBe(false);
  });
});
