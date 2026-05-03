import type { Concept, Match, Profile, ProfileConceptMap } from "../../types";

export type NodeKind = "partner" | "concept";
export type EdgeKind = "bipartite" | "match";

export interface NodeAttrs {
  kind: NodeKind;
  label: string;
  size?: number;
  refId: string;
  category?: string;
  // Sigma renders directly from these. Set by the Canvas route after layout.
  x?: number;
  y?: number;
  color?: string;
}

export interface EdgeAttrs {
  kind: EdgeKind;
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
