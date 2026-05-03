import { useEffect, useRef } from "react";
import Sigma from "sigma";
import type Graph from "graphology";
import { useCanvasStore } from "./lib/store";
import type { EdgeAttrs, NodeAttrs } from "./lib/types";

interface Props {
  graph: Graph<NodeAttrs, EdgeAttrs>;
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
    });
    sigmaRef.current = sigma;
    const setSelected = useCanvasStore.getState().setSelectedNode;
    const setHover = useCanvasStore.getState().setHoverNode;
    sigma.on("clickNode", (e: { node: string }) => setSelected(e.node));
    sigma.on("enterNode", (e: { node: string }) => setHover(e.node));
    sigma.on("leaveNode", () => setHover(null));
    sigma.on("clickStage", () => setSelected(null));
    return () => {
      sigma.kill();
      sigmaRef.current = null;
    };
  }, [graph]);

  return <div ref={containerRef} className="h-full w-full bg-neutral-800" />;
}
