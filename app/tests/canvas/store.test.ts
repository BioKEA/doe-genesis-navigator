import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasStore } from "../../src/canvas/lib/store";

describe("useCanvasStore", () => {
  beforeEach(() => {
    useCanvasStore.setState({
      selectedNode: null,
      hoverNode: null,
      matchOverlayOn: false,
      topK: 8,
      reciprocityHighlight: true,
      conceptCategoryFilter: new Set(),
    });
  });

  it("starts with sensible defaults", () => {
    const s = useCanvasStore.getState();
    expect(s.selectedNode).toBeNull();
    expect(s.matchOverlayOn).toBe(false);
    expect(s.topK).toBe(8);
    expect(s.reciprocityHighlight).toBe(true);
  });

  it("setSelectedNode updates state", () => {
    useCanvasStore.getState().setSelectedNode("partner:alice");
    expect(useCanvasStore.getState().selectedNode).toBe("partner:alice");
  });

  it("setTopK clamps to [3, 12]", () => {
    useCanvasStore.getState().setTopK(2);
    expect(useCanvasStore.getState().topK).toBe(3);
    useCanvasStore.getState().setTopK(50);
    expect(useCanvasStore.getState().topK).toBe(12);
    useCanvasStore.getState().setTopK(8);
    expect(useCanvasStore.getState().topK).toBe(8);
  });

  it("toggleConceptCategory adds and removes a category id", () => {
    const s = useCanvasStore.getState();
    s.toggleConceptCategory("tech");
    expect(useCanvasStore.getState().conceptCategoryFilter.has("tech")).toBe(true);
    useCanvasStore.getState().toggleConceptCategory("tech");
    expect(useCanvasStore.getState().conceptCategoryFilter.has("tech")).toBe(false);
  });
});
