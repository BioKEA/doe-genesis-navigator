import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LeftPane } from "../canvas/LeftPane";
import { GraphCanvas } from "../canvas/GraphCanvas";
import { RightPane } from "../canvas/RightPane";
import { OnboardingOverlay } from "../canvas/OnboardingOverlay";
import { loadCanvasData } from "../canvas/lib/load-canvas-data";
import { buildGraph } from "../canvas/lib/build-graph";
import { selectTopKMatchEdges } from "../canvas/lib/match-edges";
import { dataVersion } from "../canvas/lib/data-version";
import { loadLayout, saveLayout } from "../canvas/lib/layout-cache";
import { runLayoutInWorker } from "../canvas/lib/run-layout";
import { useCanvasStore } from "../canvas/lib/store";
import type { CanvasData, EdgeAttrs, NodeAttrs } from "../canvas/lib/types";
import type Graph from "graphology";

export default function Canvas() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CanvasData | null>(null);
  const [graph, setGraph] = useState<Graph<NodeAttrs, EdgeAttrs> | null>(null);
  const matchOverlayOn = useCanvasStore((s) => s.matchOverlayOn);
  const topK = useCanvasStore((s) => s.topK);
  const reciprocityHighlight = useCanvasStore((s) => s.reciprocityHighlight);
  const selectedNode = useCanvasStore((s) => s.selectedNode);

  useEffect(() => {
    void loadCanvasData().then(setData);
  }, []);

  // Build the bipartite graph + lay it out (worker + localStorage cache).
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    (async () => {
      const g = buildGraph(data);
      const version = dataVersion({
        profileCount: data.profiles.length,
        conceptCount: data.concepts.length,
        matchCount: data.matches.length,
        bipartiteEdgeCount: g.size,
      });
      let positions = loadLayout(version);
      if (!positions) {
        positions = await runLayoutInWorker(g);
        saveLayout(version, positions);
      }
      if (cancelled) return;
      g.forEachNode((id) => {
        const p = positions!.get(id);
        if (p) {
          g.setNodeAttribute(id, "x", p.x);
          g.setNodeAttribute(id, "y", p.y);
        }
      });
      // Concept nodes are the visual scaffolding (pink, large); partner nodes
      // are cyan dots — distinct hue from both the pink concepts and the
      // white-ish bipartite edges so they remain legible in the dense middle.
      g.forEachNode((id, attrs) => {
        g.setNodeAttribute(id, "size", attrs.kind === "concept" ? 11 : 4);
        g.setNodeAttribute(id, "color", attrs.kind === "concept" ? "#ec4899" : "#22d3ee");
      });
      // Precompute each partner's distinct concept categories so the
      // category-filter reducer in GraphCanvas can quickly dim irrelevant
      // partner-partner match edges without walking neighbors at render time.
      g.forEachNode((id, attrs) => {
        if (attrs.kind !== "partner") return;
        const cats = new Set<string>();
        g.forEachNeighbor(id, (_n, nattrs) => {
          if (nattrs.kind === "concept" && nattrs.category) cats.add(nattrs.category);
        });
        g.setNodeAttribute(id, "categories", Array.from(cats));
      });
      setGraph(g);
    })();
    return () => { cancelled = true; };
  }, [data]);

  // Apply the match overlay (add or replace edges with kind="match") whenever
  // the toggle, top-K, or data changes.
  useEffect(() => {
    if (!graph || !data) return;
    graph.forEachEdge((id, attrs) => {
      if (attrs.kind === "match") graph.dropEdge(id);
    });
    if (!matchOverlayOn) return;
    const edges = selectTopKMatchEdges(data.matches, topK);
    for (const m of edges) {
      const src = `partner:${m.from}`;
      const dst = `partner:${m.to}`;
      if (!graph.hasNode(src) || !graph.hasNode(dst)) continue;
      if (graph.hasEdge(src, dst)) continue;
      const highlighted = reciprocityHighlight && m.reciprocal;
      graph.addEdge(src, dst, {
        kind: "match",
        color: highlighted ? "rgba(251,113,133,0.85)" : "rgba(244,114,182,0.4)",
        size: highlighted ? 1.4 : 0.7,
        score: m.score,
        reciprocal: m.reciprocal,
        rationale: m.rationale,
        sharedConcepts: m.sharedConcepts,
      });
    }
  }, [graph, data, matchOverlayOn, topK, reciprocityHighlight]);

  // Push the URL when the user picks a partner via canvas click or a name in
  // the right pane. Don't push for concept selection (no concept route) or
  // when the URL already matches (avoids initial-mount loop).
  useEffect(() => {
    if (!selectedNode || !selectedNode.startsWith("partner:")) return;
    const newSlug = selectedNode.slice("partner:".length);
    if (newSlug !== slug) navigate(`/profile/${newSlug}`);
  }, [selectedNode, slug, navigate]);

  // Pre-select partner from the URL.
  useEffect(() => {
    if (!slug) return;
    useCanvasStore.getState().setSelectedNode(`partner:${slug}`);
  }, [slug]);

  const categories = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const c of data.concepts) {
      const k = c.categoryId ?? "uncategorized";  // NOTE: real Concept type uses categoryId
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([id, count]) => ({ id, label: id, count }));
  }, [data]);

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <LeftPane categories={categories} />
      <div className="relative flex-1">
        {graph
          ? <GraphCanvas graph={graph} />
          : <div className="flex h-full items-center justify-center text-neutral-500">
              Loading canvas…
            </div>}
        {graph && <OnboardingOverlay />}
      </div>
      {data && <RightPane data={data} />}
    </div>
  );
}
