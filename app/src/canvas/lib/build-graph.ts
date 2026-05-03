import Graph from "graphology";
import type { CanvasData, EdgeAttrs, NodeAttrs } from "./types";

export function buildGraph(data: CanvasData): Graph<NodeAttrs, EdgeAttrs> {
  const g = new Graph<NodeAttrs, EdgeAttrs>({ type: "undirected", multi: false });
  const conceptIds = new Set(data.concepts.map((c) => c.id));

  for (const p of data.profiles) {
    g.addNode(`partner:${p.slug}`, {
      kind: "partner",
      label: p.name,
      refId: p.slug,
    });
  }
  for (const c of data.concepts) {
    g.addNode(`concept:${c.id}`, {
      kind: "concept",
      label: c.label,
      refId: c.id,
      category: c.categoryId,
      size: c.memberPhrases.length,
    });
  }
  for (const [slug, ids] of Object.entries(data.profileConcepts)) {
    if (!g.hasNode(`partner:${slug}`)) continue;
    for (const id of ids) {
      if (!conceptIds.has(id)) continue;
      g.addEdge(`partner:${slug}`, `concept:${id}`, { kind: "bipartite" });
    }
  }
  return g;
}
