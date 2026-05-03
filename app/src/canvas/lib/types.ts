import type { Concept, Match, Profile, ProfileConceptMap } from "../../types";

export type NodeKind = "partner" | "concept";
export type EdgeKind = "bipartite" | "match";

export interface NodeAttrs {
  kind: NodeKind;
  label: string;
  // Bipartite: degree (used for sizing). Concepts: member count.
  size?: number;
  // For partner nodes: original Profile slug. For concept nodes: concept id.
  refId: string;
  // For concept nodes: parent category id (for filter coloring).
  category?: string;
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
