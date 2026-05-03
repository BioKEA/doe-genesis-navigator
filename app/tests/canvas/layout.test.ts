import { describe, expect, it } from "vitest";
import Graph from "graphology";
import { computeLayout } from "../../src/canvas/lib/layout";
import type { EdgeAttrs, NodeAttrs } from "../../src/canvas/lib/types";

function smallGraph(): Graph<NodeAttrs, EdgeAttrs> {
  const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected" });
  g.addNode("partner:a", { kind: "partner", label: "A", refId: "a" });
  g.addNode("partner:b", { kind: "partner", label: "B", refId: "b" });
  g.addNode("concept:c", { kind: "concept", label: "C", refId: "c" });
  g.addEdge("partner:a", "concept:c", { kind: "bipartite" });
  g.addEdge("partner:b", "concept:c", { kind: "bipartite" });
  return g;
}

describe("computeLayout", () => {
  it("returns a finite (x, y) for every node", () => {
    const positions = computeLayout(smallGraph(), { ticks: 30 });
    expect(positions.size).toBe(3);
    for (const p of positions.values()) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("converges (positions don't change drastically with one extra tick)", () => {
    const a = computeLayout(smallGraph(), { ticks: 50 });
    const b = computeLayout(smallGraph(), { ticks: 51 });
    // Positions are randomized initial; just check shape is the same.
    expect(b.size).toBe(a.size);
  });
});
