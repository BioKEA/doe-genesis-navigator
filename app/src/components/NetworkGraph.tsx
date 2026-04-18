import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3-force";
import { select } from "d3-selection";
import { drag as d3drag } from "d3-drag";
import type { Profile } from "../types";
import { affiliationColor } from "../lib/affiliations";

type NodeKind = "profile" | "challenge";

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  label: string;
  affiliation?: string;
  profileCount?: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {}

interface Props {
  profiles: Profile[];
  highlightChallenge?: string | null;
  onProfileClick: (slug: string) => void;
  onChallengeClick?: (challenge: string) => void;
}

export default function NetworkGraph({
  profiles, highlightChallenge, onProfileClick, onChallengeClick,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const profilesBySlug = useMemo(
    () => new Map(profiles.map((p) => [p.slug, p])),
    [profiles]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const width = svg.clientWidth;
    const height = svg.clientHeight;

    const challengeCounts = new Map<string, number>();
    for (const p of profiles) {
      for (const c of p.challengeAreas) {
        challengeCounts.set(c, (challengeCounts.get(c) ?? 0) + 1);
      }
    }

    const challengeNodes: SimNode[] = Array.from(challengeCounts, ([c, n]) => ({
      id: `c:${c}`,
      kind: "challenge",
      label: c,
      profileCount: n,
    }));

    const profileNodes: SimNode[] = profiles.map((p) => ({
      id: `p:${p.slug}`,
      kind: "profile",
      label: p.name,
      affiliation: p.affiliation,
    }));

    const nodes: SimNode[] = [...challengeNodes, ...profileNodes];
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const links: SimLink[] = [];
    for (const p of profiles) {
      for (const c of p.challengeAreas) {
        const from = byId.get(`p:${p.slug}`);
        const to = byId.get(`c:${c}`);
        if (from && to) links.push({ source: from, target: to });
      }
    }

    const maxCount = Math.max(1, ...challengeNodes.map((n) => n.profileCount ?? 0));
    const challengeRadius = (count: number) =>
      12 + 18 * Math.sqrt(count / maxCount);

    const selection = select(svg);
    selection.selectAll("*").remove();

    const linkSel = selection.append("g")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 0.6)
      .selectAll<SVGLineElement, SimLink>("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke-opacity", 0.35);

    const nodeSel = selection.append("g")
      .selectAll<SVGCircleElement, SimNode>("circle")
      .data(nodes, (d) => d!.id)
      .enter()
      .append("circle")
      .attr("r", (d) => d.kind === "challenge" ? challengeRadius(d.profileCount ?? 0) : 3.5)
      .attr("fill", (d) => d.kind === "challenge" ? "#0f172a" : affiliationColor(d.affiliation))
      .attr("stroke", (d) => d.kind === "challenge" ? "#fbbf24" : "#ffffff")
      .attr("stroke-width", (d) => d.kind === "challenge" ? 2 : 1)
      .style("cursor", "pointer")
      .on("click", (_evt, d) => {
        if (d.kind === "profile") onProfileClick(d.id.slice(2));
        else onChallengeClick?.(d.label);
      });

    nodeSel.append("title").text((d) =>
      d.kind === "challenge"
        ? `${d.label} (${d.profileCount} partners)`
        : d.label
    );

    const labelSel = selection.append("g")
      .selectAll<SVGTextElement, SimNode>("text")
      .data(challengeNodes, (d) => d!.id)
      .enter()
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("font-weight", 600)
      .attr("fill", "#0f172a")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 3)
      .attr("paint-order", "stroke")
      .attr("pointer-events", "none")
      .text((d) => truncate(d.label, 28));

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(60).strength(0.4))
      .force("charge", d3.forceManyBody<SimNode>().strength((d) => d.kind === "challenge" ? -600 : -30))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) =>
        d.kind === "challenge" ? challengeRadius(d.profileCount ?? 0) + 6 : 5
      ))
      .alphaDecay(0.03);

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);
      nodeSel
        .attr("cx", (d) => d.x!)
        .attr("cy", (d) => d.y!);
      labelSel
        .attr("x", (d) => d.x!)
        .attr("y", (d) => d.y! + challengeRadius(d.profileCount ?? 0) + 12);
    });

    const dragBehavior = d3drag<SVGCircleElement, SimNode>()
      .on("start", (e, d) => {
        if (!e.active) sim.alphaTarget(0.2).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => {
        if (!e.active) sim.alphaTarget(0);
        if (d.kind === "profile") { d.fx = null; d.fy = null; }
      });
    nodeSel.call(dragBehavior as any);

    return () => { sim.stop(); };
  }, [profiles, onProfileClick, onChallengeClick]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const s = select(svg);
    s.selectAll<SVGCircleElement, SimNode>("circle")
      .attr("opacity", (d) => {
        if (!highlightChallenge) return 1;
        if (d.kind === "challenge") return d.label === highlightChallenge ? 1 : 0.2;
        const slug = d.id.slice(2);
        const p = profilesBySlug.get(slug);
        return p?.challengeAreas.includes(highlightChallenge) ? 1 : 0.08;
      });
    s.selectAll<SVGLineElement, SimLink>("line")
      .attr("stroke-opacity", (d) => {
        if (!highlightChallenge) return 0.35;
        const t = d.target as SimNode;
        return t.label === highlightChallenge ? 0.65 : 0.04;
      });
    s.selectAll<SVGTextElement, SimNode>("text")
      .attr("opacity", (d) =>
        !highlightChallenge || d.label === highlightChallenge ? 1 : 0.25
      );
  }, [highlightChallenge, profilesBySlug]);

  return <svg ref={svgRef} className="h-full w-full" />;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
