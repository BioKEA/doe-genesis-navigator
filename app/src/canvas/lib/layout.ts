import { forceLink, forceManyBody, forceSimulation, forceCenter } from "d3-force";
import type Graph from "graphology";
import type { EdgeAttrs, NodeAttrs } from "./types";
import type { Positions } from "./layout-cache";

interface SimNode {
  id: string;
  kind: "partner" | "concept";
  x?: number;
  y?: number;
}

interface SimLink { source: string; target: string }

export function computeLayout(
  graph: Graph<NodeAttrs, EdgeAttrs>,
  opts: { ticks?: number } = {},
): Positions {
  const ticks = opts.ticks ?? 200;
  const nodes: SimNode[] = graph.mapNodes((id, attrs) => ({ id, kind: attrs.kind }));
  const links: SimLink[] = graph.mapEdges((_id, _attrs, source, target) => ({ source, target }));

  const sim = forceSimulation(nodes as never)
    .force("link", forceLink(links).id((d: SimNode) => d.id).distance(40).strength(0.6))
    // Concept nodes get stronger repulsion than partners (spec § 8).
    .force(
      "charge",
      forceManyBody<SimNode>().strength((d) => (d.kind === "concept" ? -150 : -60)),
    )
    .force("center", forceCenter(0, 0))
    .stop();

  for (let i = 0; i < ticks; i++) sim.tick();

  const positions: Positions = new Map();
  for (const n of nodes) positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  return positions;
}
