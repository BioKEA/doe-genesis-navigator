import type { Profile } from "../types";
import type { Team } from "./team-builder";
import { analyzeContributions } from "./team-builder";
import { SECTOR_LABELS, sectorFor, type Sector, type PhaseId } from "./rfa";
import type { CoverageMatrix } from "./coverage";

// -----------------------------------------------------------------------------
// Generate a proposal-ready narrative draft. Template-based (no LLM) so the
// output is deterministic and reviewable. The user edits this draft — our job
// is to save them the 2 hours of boilerplate.
// -----------------------------------------------------------------------------

export interface NarrativeTarget {
  challenges: string[];
  requiredOfferings: string[];
  phaseId: PhaseId;
  leadSlug?: string;
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function phaseLabel(phaseId: PhaseId): string {
  return phaseId === "phase-1"
    ? "Phase I (exploratory, $500K–$750K over 9 months)"
    : "Phase II (consortium, $6M–$15M over 3 years)";
}

function contributionLine(
  name: string,
  sector: Sector,
  uniqueChallenges: string[],
  uniqueOfferings: string[],
  sharedOfferings: string[],
): string {
  const role = uniqueOfferings[0] ?? sharedOfferings[0] ?? "subject matter expertise";
  const coverageNote =
    uniqueChallenges.length > 0
      ? ` uniquely covering the ${joinList(uniqueChallenges)} challenge${uniqueChallenges.length > 1 ? "s" : ""}`
      : "";
  return `- **${name}** (${SECTOR_LABELS[sector]}): contributes ${role}${coverageNote}.`;
}

export interface NarrativeDoc {
  markdown: string;
  plaintext: string;
}

export function generateNarrative(
  team: Team,
  matrix: CoverageMatrix,
  target: NarrativeTarget,
  allProfiles: Profile[],
): NarrativeDoc {
  const contributions = analyzeContributions(team.members, {
    challenges: target.challenges,
    requiredOfferings: target.requiredOfferings,
    minSize: 2,
    maxSize: 12,
    targetSize: team.members.length,
    requireSectors: ["academic", "industry", "natlab"],
    lockedSlugs: target.leadSlug ? [target.leadSlug] : [],
  });

  // Choose lead: user-specified, else highest richness
  const lead =
    (target.leadSlug && team.members.find((p) => p.slug === target.leadSlug)) ||
    team.members.slice().sort((a, b) => {
      const ra = (a.offerings?.tags.length ?? 0) + a.challengeAreas.length;
      const rb = (b.offerings?.tags.length ?? 0) + b.challengeAreas.length;
      return rb - ra;
    })[0];

  const sectorBreakdown: Record<Sector, Profile[]> = {
    academic: [], industry: [], natlab: [], other: [],
  };
  for (const p of team.members) sectorBreakdown[sectorFor(p.affiliation)].push(p);

  const sectorSummary: string[] = [];
  for (const s of ["academic", "industry", "natlab", "other"] as Sector[]) {
    const n = sectorBreakdown[s].length;
    if (n > 0) sectorSummary.push(`${n} ${SECTOR_LABELS[s]}${n > 1 ? " partner" + (n > 1 ? "s" : "") : ""}`);
  }

  const coveredChallenges = matrix.rows
    .filter((r) => r.kind === "challenge" && r.totalCoverage > 0)
    .map((r) => r.label);
  const uncoveredChallenges = matrix.rows
    .filter((r) => r.kind === "challenge" && r.totalCoverage === 0)
    .map((r) => r.label);
  const coveredOfferings = matrix.rows
    .filter((r) => r.kind === "offering" && r.totalCoverage > 0)
    .map((r) => r.label);

  void allProfiles; // available for future extensions (e.g., cite nearest non-member)

  const md = `# Proposed Consortium — Genesis Mission ${phaseLabel(target.phaseId)}

**Genesis Mission challenge area${target.challenges.length > 1 ? "s" : ""}:** ${joinList(target.challenges)}

**Team lead:** ${lead.name} (${SECTOR_LABELS[sectorFor(lead.affiliation)]}${lead.affiliation ? " · " + lead.affiliation : ""})

**Team composition:** ${team.members.length} partners — ${joinList(sectorSummary)}.

## Why this consortium wins

This team directly addresses the Genesis Mission's challenge${target.challenges.length > 1 ? "s" : ""} of ${joinList(target.challenges)} by combining ${joinList(coveredOfferings.slice(0, 4)) || "multiple complementary capabilities"} across ${joinList(sectorSummary)}. Score: ${team.score.total.toFixed(2)} — with challenge coverage of ${Math.round(team.score.challengeCoverage * 100)}%, capability coverage of ${Math.round(team.score.offeringCoverage * 100)}%, and sector balance index of ${team.score.sectorEntropy.toFixed(2)}.

## Member contributions

${contributions.map((c) =>
  contributionLine(
    c.profile.name,
    c.sector,
    c.uniqueChallenges,
    c.uniqueOfferings,
    c.sharedOfferings,
  )
).join("\n")}

## Capability coverage

Covered in this consortium: ${joinList(coveredOfferings) || "_none selected_"}.
${coveredChallenges.length > 0 ? `\nChallenges addressed: ${joinList(coveredChallenges)}.` : ""}
${uncoveredChallenges.length > 0 ? `\n\n**Gap**: the following selected challenges have no team coverage: ${joinList(uncoveredChallenges)}.` : ""}

${matrix.gaps.filter((g) => g.severity === "critical").length > 0 ? `\n## Critical gaps to address before submission\n${matrix.gaps
  .filter((g) => g.severity === "critical")
  .map((g) => `- ${g.recommendation}`)
  .join("\n")}\n` : ""}
---
_Draft generated by Genesis Partners Navigator — edit before submitting._`;

  return {
    markdown: md,
    plaintext: md.replace(/[*_#]/g, ""),
  };
}

// -----------------------------------------------------------------------------
// Outreach email template (one per non-lead team member).
// -----------------------------------------------------------------------------

export function generateOutreach(
  lead: Profile | undefined,
  target: Profile,
  challenges: string[],
  sharedOfferings: string[],
): string {
  const leadName = lead?.name ?? "[Your organization]";
  const leadContext = lead?.affiliation
    ? ` (${SECTOR_LABELS[sectorFor(lead.affiliation)]})`
    : "";

  const offerOverlap =
    target.offerings?.tags.filter((t) => sharedOfferings.includes(t)) ?? [];

  const firstChallenge = challenges[0] ?? "Genesis Mission challenges";

  return `Subject: Proposed Genesis Mission consortium — ${firstChallenge}

Hi${target.name.includes(" ") && /^[A-Z][a-z]+\s/.test(target.name) ? ` ${target.name.split(" ")[0]}` : ""},

I'm reaching out about the DOE Genesis Mission funding opportunity (DE-FOA-0003612, "Transforming Science and Energy with AI"). ${leadName}${leadContext} is assembling a consortium to address ${joinList(challenges)} and we'd like to include ${target.name}.

We noticed your listed offerings${offerOverlap.length > 0 ? ` — particularly ${joinList(offerOverlap)}` : ""} align closely with what this challenge needs. ${target.seeking?.text ? `You're also seeking collaborators, and we may be able to help with that on the consortium side.` : ""}

Phase I LOIs are due April 28, so timing is tight. Would you have 20 minutes this week to discuss a potential partnership?

Best regards,
[Your name]

---
Auto-drafted. Source profile: ${target.website ?? "(no website on file)"}.`;
}
