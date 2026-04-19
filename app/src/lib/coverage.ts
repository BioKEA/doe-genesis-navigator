import type { Profile } from "../types";
import { sectorFor, type Sector } from "./rfa";

// -----------------------------------------------------------------------------
// Coverage matrix: rows = required items (challenges and offerings),
// columns = team members, cells = strength of coverage.
// -----------------------------------------------------------------------------

export type Strength = 0 | 1 | 2 | 3;

export interface CoverageCell {
  strength: Strength;
  tags: string[]; // specific tags the member contributes for this row
}

export interface CoverageRow {
  kind: "challenge" | "offering";
  label: string;
  cells: CoverageCell[];      // indexed by member slot
  totalCoverage: number;      // number of members contributing ≥1
  status: "strong" | "thin" | "gap" | "redundant";
}

export interface CoverageMatrix {
  rows: CoverageRow[];
  members: Profile[];
  gaps: Gap[];
  redundancies: Redundancy[];
}

export interface Gap {
  kind: "challenge" | "offering" | "sector";
  label: string;
  severity: "critical" | "warning";
  recommendation?: string;
}

export interface Redundancy {
  kind: "offering" | "challenge";
  label: string;
  memberCount: number;
  // Who you could drop without losing coverage
  expendable: Profile[];
}

function challengeStrength(p: Profile, challenge: string): Strength {
  if (!p.challengeAreas.includes(challenge)) return 0;
  // Anyone that tags a challenge gets at least strength 1.
  // Strength 2 if they also have offering tags that map to this challenge
  // (proxy: they have ≥2 offering tags = they back the challenge with capabilities).
  const offeringTagCount = p.offerings?.tags.length ?? 0;
  if (offeringTagCount >= 3) return 3;
  if (offeringTagCount >= 1) return 2;
  return 1;
}

function offeringStrength(p: Profile, offering: string): Strength {
  const tags = p.offerings?.tags ?? [];
  if (!tags.includes(offering)) return 0;
  // Strength 2 if their offerings text also describes this; strength 3 if
  // they ALSO tag it in seeking-negative (i.e. they only OFFER this, not seek it).
  const seeking = p.seeking?.tags ?? [];
  const onlyOffers = !seeking.includes(offering);
  const hasText = (p.offerings?.text.length ?? 0) > 100;
  if (onlyOffers && hasText) return 3;
  if (onlyOffers || hasText) return 2;
  return 1;
}

export function buildCoverageMatrix(
  team: Profile[],
  challenges: string[],
  offerings: string[],
  requireSectors: Sector[],
): CoverageMatrix {
  const rows: CoverageRow[] = [];

  for (const c of challenges) {
    const cells: CoverageCell[] = team.map((p) => ({
      strength: challengeStrength(p, c),
      tags: p.challengeAreas.filter((x) => x === c),
    }));
    const total = cells.filter((x) => x.strength > 0).length;
    rows.push({
      kind: "challenge",
      label: c,
      cells,
      totalCoverage: total,
      status:
        total === 0 ? "gap" :
        total === 1 ? "thin" :
        total > 4 ? "redundant" : "strong",
    });
  }

  for (const o of offerings) {
    const cells: CoverageCell[] = team.map((p) => ({
      strength: offeringStrength(p, o),
      tags: (p.offerings?.tags ?? []).filter((x) => x === o),
    }));
    const total = cells.filter((x) => x.strength > 0).length;
    rows.push({
      kind: "offering",
      label: o,
      cells,
      totalCoverage: total,
      status:
        total === 0 ? "gap" :
        total === 1 ? "thin" :
        total > 4 ? "redundant" : "strong",
    });
  }

  const gaps = identifyGaps(team, challenges, offerings, requireSectors, rows);
  const redundancies = identifyRedundancies(team, rows);

  return { rows, members: team, gaps, redundancies };
}

function identifyGaps(
  team: Profile[],
  _challenges: string[],
  _offerings: string[],
  requireSectors: Sector[],
  rows: CoverageRow[],
): Gap[] {
  const gaps: Gap[] = [];

  // Uncovered challenges → critical
  for (const row of rows) {
    if (row.status !== "gap") continue;
    gaps.push({
      kind: row.kind,
      label: row.label,
      severity: "critical",
      recommendation: `No team member covers this ${row.kind}. Add a partner with ${row.label}.`,
    });
  }

  // Thinly covered (single point of failure) → warning
  for (const row of rows) {
    if (row.status !== "thin") continue;
    gaps.push({
      kind: row.kind,
      label: row.label,
      severity: "warning",
      recommendation: `Only one member covers this — single point of failure.`,
    });
  }

  // Missing sectors
  const present = new Set<Sector>();
  for (const p of team) present.add(sectorFor(p.affiliation));
  for (const s of requireSectors) {
    if (!present.has(s)) {
      gaps.push({
        kind: "sector",
        label: s,
        severity: "critical",
        recommendation:
          `The RFA favors interdisciplinary teams. Missing: ${s}. Add a partner from this sector.`,
      });
    }
  }

  return gaps;
}

function identifyRedundancies(
  team: Profile[],
  rows: CoverageRow[],
): Redundancy[] {
  const redundancies: Redundancy[] = [];
  for (const row of rows) {
    if (row.status !== "redundant") continue;
    const covering = row.cells
      .map((cell, i) => ({ cell, member: team[i] }))
      .filter(({ cell }) => cell.strength > 0);

    // "Expendable": the members with the weakest coverage of this row
    // (lowest strength). Keep the strongest, flag the rest.
    const sorted = covering.sort((a, b) => b.cell.strength - a.cell.strength);
    const expendable = sorted.slice(3).map((x) => x.member); // keep top 3

    redundancies.push({
      kind: row.kind as "offering" | "challenge",
      label: row.label,
      memberCount: covering.length,
      expendable,
    });
  }
  return redundancies;
}
