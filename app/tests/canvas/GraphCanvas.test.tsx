import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import Graph from "graphology";
import { useCanvasStore } from "../../src/canvas/lib/store";
import { GraphCanvas } from "../../src/canvas/GraphCanvas";
import type { EdgeAttrs, NodeAttrs } from "../../src/canvas/lib/types";

const sigmaInstances: { onClick?: (e: { node: string }) => void }[] = [];
vi.mock("sigma", () => ({
  default: class FakeSigma {
    private handlers: Record<string, (e: unknown) => void> = {};
    constructor() { sigmaInstances.push(this as never); }
    on(evt: string, fn: (e: unknown) => void) { this.handlers[evt] = fn; }
    kill() {}
    refresh() {}
    fire(evt: string, payload: unknown) { this.handlers[evt]?.(payload); }
  },
}));

afterEach(() => {
  sigmaInstances.length = 0;
  useCanvasStore.setState({ selectedNode: null });
});

describe("<GraphCanvas>", () => {
  it("forwards a node-click into the canvas store", () => {
    const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected" });
    g.addNode("partner:a", { kind: "partner", label: "A", refId: "a", size: 1 });
    g.setNodeAttribute("partner:a", "x" as never, 0);
    g.setNodeAttribute("partner:a", "y" as never, 0);

    render(<GraphCanvas graph={g} />);
    const sigma = sigmaInstances[0] as never as { fire: (e: string, p: unknown) => void };
    sigma.fire("clickNode", { node: "partner:a" });
    expect(useCanvasStore.getState().selectedNode).toBe("partner:a");
  });
});
