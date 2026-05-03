import type Graph from "graphology";
import type { EdgeAttrs, NodeAttrs } from "./types";
import type { Positions } from "./layout-cache";

export function runLayoutInWorker(
  graph: Graph<NodeAttrs, EdgeAttrs>,
): Promise<Positions> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./layout-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<{ id: string; x: number; y: number }[]>) => {
      const out: Positions = new Map();
      for (const p of e.data) out.set(p.id, { x: p.x, y: p.y });
      worker.terminate();
      resolve(out);
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage({
      nodes: graph.mapNodes((id, attrs) => ({ id, attrs })),
      edges: graph.mapEdges((_id, attrs, source, target) => ({ source, target, attrs })),
    });
  });
}
