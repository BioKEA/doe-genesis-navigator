import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RightPane } from "../../src/canvas/RightPane";
import { useCanvasStore } from "../../src/canvas/lib/store";
import type { CanvasData } from "../../src/canvas/lib/types";

const data: CanvasData = {
  profiles: [
    { slug: "alice", name: "Alice", kind: "person", affiliation: "ACME", challengeAreas: [], partnerTypeSeeking: [], rawHtmlPath: "" } as never,
    { slug: "bob", name: "Bob", kind: "org", affiliation: "BCO", challengeAreas: [], partnerTypeSeeking: [], rawHtmlPath: "" } as never,
  ],
  concepts: [{ id: "c1", label: "AI", categoryId: "tech", memberPhrases: ["ai", "ml"] }],
  profileConcepts: { alice: ["c1"], bob: ["c1"] },
  matches: [
    { from: "alice", to: "bob", score: 0.9, rationale: "perfect fit", sharedConcepts: ["c1"], reciprocal: true },
  ],
};

afterEach(() => useCanvasStore.setState({ selectedNode: null }));

describe("<RightPane>", () => {
  it("renders 'Nothing selected' when no node is selected", () => {
    render(<RightPane data={data} />);
    expect(screen.getByText(/nothing selected/i)).toBeInTheDocument();
  });

  it("renders a partner card with concepts and matches", () => {
    useCanvasStore.setState({ selectedNode: "partner:alice" });
    render(<RightPane data={data} />);
    expect(screen.getByText(/alice/i)).toBeInTheDocument();
    expect(screen.getByText(/ACME/)).toBeInTheDocument();
    expect(screen.getByText(/AI/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/perfect fit/i)).toBeInTheDocument();
  });

  it("renders a concept card with member count", () => {
    useCanvasStore.setState({ selectedNode: "concept:c1" });
    render(<RightPane data={data} />);
    expect(screen.getByText(/AI/)).toBeInTheDocument();
    expect(screen.getByText(/2 partners/)).toBeInTheDocument();
  });
});
