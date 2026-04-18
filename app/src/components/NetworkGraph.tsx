import { useEffect, useRef } from "react";
import * as d3 from "d3-force";
import { select } from "d3-selection";
import { drag as d3drag } from "d3-drag";
import type { NetworkData, NetworkNode } from "../types";

interface SimNode extends d3.SimulationNodeDatum, NetworkNode {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

const AFFILIATION_COLORS: Record<string, string> = {
  "Academic institution": "#4f46e5",
  "Industry": "#059669",
  "National Laboratory": "#d97706",
  "Government": "#dc2626",
};

function affiliationColor(a?: string) {
  if (!a) return "#64748b";
  return AFFILIATION_COLORS[a] ?? "#64748b";
}

interface Props {
  data: NetworkData;
  weightThreshold: number;
  highlightChallenge?: string | null;
  profileChallenges: Map<string, string[]>;
  onNodeClick: (slug: string) => void;
}

export default function NetworkGraph({
  data, weightThreshold, highlightChallenge, profileChallenges, onNodeClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const width = svg.clientWidth;
    const height = svg.clientHeight;

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const slugToNode = new Map(nodes.map((n) => [n.slug, n]));
    const links: SimLink[] = data.edges
      .filter((e) => e.weight >= weightThreshold && slugToNode.has(e.a) && slugToNode.has(e.b))
      .map((e) => ({ source: slugToNode.get(e.a)!, target: slugToNode.get(e.b)!, weight: e.weight }));

    const selection = select(svg);
    selection.selectAll("*").remove();

    const linkSel = selection.append("g")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.3)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke-width", (d) => Math.min(3, 0.5 + d.weight * 0.1));

    const nodeSel = selection.append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", (d) => 3 + Math.min(8, d.richness))
      .attr("fill", (d) => affiliationColor(d.affiliation))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("click", (_evt, d) => onNodeClick(d.slug));

    nodeSel.append("title").text((d) => d.name);

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.slug).distance(40).strength(0.15))
      .force("charge", d3.forceManyBody().strength(-40))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(10));

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);
      nodeSel
        .attr("cx", (d) => d.x!)
        .attr("cy", (d) => d.y!);
    });

    const dragBehavior = d3drag<SVGCircleElement, SimNode>()
      .on("start", (e, d) => {
        if (!e.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => {
        if (!e.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
    nodeSel.call(dragBehavior as any);

    return () => { sim.stop(); };
  }, [data, weightThreshold]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    select(svg)
      .selectAll<SVGCircleElement, SimNode>("circle")
      .attr("opacity", (d) => {
        if (!highlightChallenge) return 1;
        const cs = profileChallenges.get(d.slug) ?? [];
        return cs.includes(highlightChallenge) ? 1 : 0.15;
      });
  }, [highlightChallenge, profileChallenges]);

  return <svg ref={svgRef} className="h-full w-full" />;
}
