import type { Concept, Match, Profile, ProfileConceptMap } from "../../types";

export type NodeKind = "partner" | "concept";
export type EdgeKind = "bipartite" | "match";

export interface NodeAttrs {
  kind: NodeKind;
  label: string;
  size?: number;
  refId: string;
  category?: string;
  // For partner nodes only: distinct concept categories the partner is tagged
  // with (precomputed so the category filter can dim match edges between
  // partners that don't touch any active category).
  categories?: string[];
  // Sigma renders directly from these. Set by the Canvas route after layout.
  x?: number;
  y?: number;
  color?: string;
}

export interface EdgeAttrs {
  kind: EdgeKind;
  // Sigma reads these directly:
  color?: string;
  size?: number;
  // Match-only fields:
  score?: number;
  reciprocal?: boolean;
  rationale?: string;
  sharedConcepts?: string[];
}

export interface CanvasData {
  profiles: Profile[];
  concepts: Concept[];
  profileConcepts: ProfileConceptMap;
  matches: Match[];
}
