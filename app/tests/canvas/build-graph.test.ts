import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/canvas/lib/build-graph";
import type { CanvasData } from "../../src/canvas/lib/types";

const data: CanvasData = {
  profiles: [
    { slug: "alice", name: "Alice", kind: "person", challengeAreas: [], partnerTypeSeeking: [], rawHtmlPath: "" } as never,
    { slug: "bob", name: "Bob", kind: "org", challengeAreas: [], partnerTypeSeeking: [], rawHtmlPath: "" } as never,
  ],
  concepts: [
    { id: "c1", label: "AI", categoryId: "tech", memberPhrases: ["ai", "ml"] },
    { id: "c2", label: "Bio", categoryId: "science", memberPhrases: ["bio"] },
  ],
  profileConcepts: { alice: ["c1", "c2"], bob: ["c1"] },
  matches: [],
};

describe("buildGraph", () => {
  it("creates a node per partner and per concept", () => {
    const g = buildGraph(data);
    expect(g.hasNode("partner:alice")).toBe(true);
    expect(g.hasNode("partner:bob")).toBe(true);
    expect(g.hasNode("concept:c1")).toBe(true);
    expect(g.hasNode("concept:c2")).toBe(true);
    expect(g.order).toBe(4);
  });

  it("creates a bipartite edge for each (profile, concept) link", () => {
    const g = buildGraph(data);
    expect(g.hasEdge("partner:alice", "concept:c1")).toBe(true);
    expect(g.hasEdge("partner:alice", "concept:c2")).toBe(true);
    expect(g.hasEdge("partner:bob", "concept:c1")).toBe(true);
    expect(g.size).toBe(3);
  });

  it("annotates partner nodes with kind=partner and concept nodes with kind=concept + category", () => {
    const g = buildGraph(data);
    expect(g.getNodeAttribute("partner:alice", "kind")).toBe("partner");
    expect(g.getNodeAttribute("concept:c1", "kind")).toBe("concept");
    expect(g.getNodeAttribute("concept:c1", "category")).toBe("tech");
  });

  it("skips partners with no curated concept tags (orphan filter)", () => {
    const data2: CanvasData = {
      ...data,
      profiles: [
        ...data.profiles,
        { slug: "carol", name: "Carol", kind: "person", challengeAreas: [], partnerTypeSeeking: [], rawHtmlPath: "" } as never,
      ],
      // carol intentionally absent from profileConcepts
    };
    const g = buildGraph(data2);
    expect(g.hasNode("partner:carol")).toBe(false);
    expect(g.hasNode("partner:alice")).toBe(true);
  });

  it("skips concept ids in profileConcepts that don't exist in the concept list", () => {
    const data2: CanvasData = {
      ...data,
      profileConcepts: { alice: ["c1", "MISSING"] },
    };
    const g = buildGraph(data2);
    expect(g.hasNode("concept:MISSING")).toBe(false);
    expect(g.size).toBe(1);
  });
});
