import Graph from "graphology";
import type { EdgeAttrs, NodeAttrs } from "./types";
import { computeLayout } from "./layout";

interface Message {
  nodes: { id: string; attrs: NodeAttrs }[];
  edges: { source: string; target: string; attrs: EdgeAttrs }[];
}

self.addEventListener("message", (e: MessageEvent<Message>) => {
  const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected" });
  for (const n of e.data.nodes) g.addNode(n.id, n.attrs);
  for (const ed of e.data.edges) g.addEdge(ed.source, ed.target, ed.attrs);
  const positions = computeLayout(g);
  const payload = Array.from(positions.entries()).map(([id, p]) => ({ id, x: p.x, y: p.y }));
  (self as unknown as Worker).postMessage(payload);
});
