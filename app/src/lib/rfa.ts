// Constants derived from the Genesis Mission RFA (DE-FOA-0003612, "Transforming
// Science and Energy with AI") and from the self-nominated data on the source
// site. These are the canonical lists the Composer uses for challenge selection
// and offering-requirement selection.

export const PHASES = [
  {
    id: "phase-1",
    label: "Phase I (exploratory, $500K–$750K, 9 months)",
    defaultSize: 4,
    minSize: 2,
    maxSize: 6,
    blurb:
      "Tight, focused pilot team. 2–6 partners, typically one anchor plus complementary experts.",
  },
  {
    id: "phase-2",
    label: "Phase II (consortium, $6M–$15M, 3 years)",
    defaultSize: 8,
    minSize: 5,
    maxSize: 12,
    blurb:
      "Full interdisciplinary consortium. 5–12 partners spanning national labs, industry, and academia.",
  },
] as const;

export type PhaseId = (typeof PHASES)[number]["id"];

// Four "sector" buckets used for team diversity scoring. The RFA requires
// interdisciplinary teams spanning DOE National Labs, industry, and academia.
export const SECTORS = ["academic", "industry", "natlab", "other"] as const;
export type Sector = (typeof SECTORS)[number];

export function sectorFor(affiliation: string | undefined): Sector {
  if (!affiliation) return "other";
  const a = affiliation.toLowerCase();
  if (a.includes("academic")) return "academic";
  if (a.includes("for-profit") || a.includes("industry")) return "industry";
  if (a.includes("national lab") || a.includes("doe")) return "natlab";
  return "other";
}

export const SECTOR_LABELS: Record<Sector, string> = {
  academic: "Academic",
  industry: "Industry",
  natlab: "National Lab",
  other: "Other / Non-profit",
};

// Hardcoded application deadlines surfaced in the UI so users know how much
// time they have. Pulled from the DOE announcement.
export const DEADLINES = {
  phase1: "2026-04-28",
  phase2Loi: "2026-04-28",
  phase2Full: "2026-05-19",
} as const;
