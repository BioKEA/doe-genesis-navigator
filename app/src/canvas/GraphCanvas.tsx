import { useEffect, useRef } from "react";
import Sigma from "sigma";
import type Graph from "graphology";
import type { Settings } from "sigma/settings";
import type { NodeDisplayData, PartialButFor } from "sigma/types";
import { useCanvasStore } from "./lib/store";
import type { EdgeAttrs, NodeAttrs } from "./lib/types";

interface Props {
  graph: Graph<NodeAttrs, EdgeAttrs>;
}

// Sigma's default node-hover renderer hardcodes #FFF for the label background,
// which collides with our light label text on the dark canvas. Mirror its
// shape but use a dark slate fill.
function drawDarkNodeHover(
  context: CanvasRenderingContext2D,
  data: PartialButFor<NodeDisplayData, "x" | "y" | "size" | "label" | "color">,
  settings: Settings,
): void {
  const size = settings.labelSize;
  const font = settings.labelFont;
  const weight = settings.labelWeight;
  context.font = `${weight} ${size}px ${font}`;
  context.fillStyle = "rgba(23, 23, 23, 0.95)";
  const PADDING = 3;
  if (typeof data.label === "string") {
    const textWidth = context.measureText(data.label).width;
    const boxWidth = Math.round(textWidth + 8);
    const boxHeight = Math.round(size + 2 * PADDING);
    const radius = Math.max(data.size, size / 2) + PADDING;
    const angleRadian = Math.asin(boxHeight / 2 / radius);
    const xDeltaCoord = Math.sqrt(Math.abs(radius ** 2 - (boxHeight / 2) ** 2));
    context.beginPath();
    context.moveTo(data.x + xDeltaCoord, data.y + boxHeight / 2);
    context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
    context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
    context.lineTo(data.x + xDeltaCoord, data.y - boxHeight / 2);
    context.arc(data.x, data.y, radius, angleRadian, -angleRadian);
    context.closePath();
    context.fill();
  }
  if (typeof data.label === "string") {
    context.fillStyle = "#f4f4f5";
    context.fillText(data.label, data.x + (data.size + PADDING) + 3, data.y + size / 3);
  }
}

export function GraphCanvas({ graph }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Cast to bare Graph to satisfy sigma's generic constraints at runtime;
    // our NodeAttrs/EdgeAttrs are structurally compatible at the JS level.
    const sigma = new Sigma(graph as Graph, containerRef.current, {
      renderEdgeLabels: false,
      defaultEdgeColor: "rgba(220,220,220,0.55)",
      defaultNodeColor: "#d4d4d8",
      labelColor: { color: "#f4f4f5" },
      labelWeight: "500",
      defaultDrawNodeHover: drawDarkNodeHover,
      // Hide concept nodes whose category isn't in the active filter set.
      // (Bipartite edges to a hidden node are auto-hidden by sigma.)
      nodeReducer: (_id, attrs) => {
        const filter = useCanvasStore.getState().conceptCategoryFilter;
        if (filter.size === 0) return attrs;
        if (attrs.kind === "concept" && !filter.has(attrs.category as string)) {
          return { ...attrs, hidden: true };
        }
        return attrs;
      },
    });
    sigmaRef.current = sigma;
    const setSelected = useCanvasStore.getState().setSelectedNode;
    const setHover = useCanvasStore.getState().setHoverNode;
    sigma.on("clickNode", (e: { node: string }) => setSelected(e.node));
    sigma.on("enterNode", (e: { node: string }) => setHover(e.node));
    sigma.on("leaveNode", () => setHover(null));
    sigma.on("clickStage", () => setSelected(null));

    // Re-render when the category filter changes.
    let prevFilter = useCanvasStore.getState().conceptCategoryFilter;
    const unsubFilter = useCanvasStore.subscribe((state) => {
      if (state.conceptCategoryFilter !== prevFilter) {
        prevFilter = state.conceptCategoryFilter;
        sigma.refresh();
      }
    });

    // Animate the camera to the selected node — both when selection changes
    // and once on mount if a selection was already set (deep-link case).
    const focusOnSelection = (id: string | null) => {
      if (!id || !graph.hasNode(id)) return;
      const display = sigma.getNodeDisplayData(id);
      if (!display) return;
      sigma.getCamera().animate(
        { x: display.x, y: display.y, ratio: 0.35 },
        { duration: 600 },
      );
    };
    focusOnSelection(useCanvasStore.getState().selectedNode);
    let prevSelected = useCanvasStore.getState().selectedNode;
    const unsubSelected = useCanvasStore.subscribe((state) => {
      if (state.selectedNode === prevSelected) return;
      prevSelected = state.selectedNode;
      focusOnSelection(state.selectedNode);
    });

    return () => {
      unsubFilter();
      unsubSelected();
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [graph]);

  return <div ref={containerRef} className="h-full w-full bg-neutral-800" />;
}
