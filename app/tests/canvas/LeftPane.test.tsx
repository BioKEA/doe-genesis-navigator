import { afterEach, describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { LeftPane } from "../../src/canvas/LeftPane";
import { useCanvasStore } from "../../src/canvas/lib/store";

const categories = [
  { id: "tech", label: "Technology", count: 30 },
  { id: "science", label: "Science", count: 25 },
];

afterEach(() => {
  useCanvasStore.setState({
    matchOverlayOn: true,
    topK: 8,
    reciprocityHighlight: true,
    conceptCategoryFilter: new Set(),
  });
});

describe("<LeftPane>", () => {
  it("toggles match overlay", () => {
    render(<LeftPane categories={categories} />);
    fireEvent.click(screen.getByLabelText(/show offer→seek matches/i));
    expect(useCanvasStore.getState().matchOverlayOn).toBe(false);
  });

  it("updates topK from the slider", () => {
    render(<LeftPane categories={categories} />);
    const slider = screen.getByLabelText(/top matches per partner/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "12" } });
    expect(useCanvasStore.getState().topK).toBe(12);
  });

  it("toggles a concept-category chip", () => {
    render(<LeftPane categories={categories} />);
    fireEvent.click(screen.getByText(/Technology/i));
    expect(useCanvasStore.getState().conceptCategoryFilter.has("tech")).toBe(true);
  });
});
