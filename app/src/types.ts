export type Affiliation = string;
export type OrgType = string;
export type OrgSize = string;

export type ProfileKind = "person" | "organization";

export interface TaggedText {
  text: string;
  tags: string[];
}

export interface Profile {
  slug: string;
  name: string;
  kind: ProfileKind;
  affiliation?: Affiliation;
  orgType?: OrgType;
  orgSize?: OrgSize;
  website?: string;
  introduction?: string;
  challengeAreas: string[];
  offerings?: TaggedText;
  seeking?: TaggedText;
  partnerTypeSeeking: string[];
  projectIdeaSummary?: string;
  relevantProjects?: string;
  relevantPublications?: string;
  rfaNumber?: string;
  conceptIds?: ConceptId[];
  rawHtmlPath: string;
}

export interface NetworkNode {
  slug: string;
  name: string;
  affiliation?: string;
  richness: number;
}

export interface NetworkEdge {
  a: string;
  b: string;
  weight: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  neighbors: Record<string, string[]>;
}

export interface ParseError {
  slug: string;
  message: string;
  field?: string;
}

export type ChallengeArea = string;

// --- Concept layer (Plan 1 of the knowledge-graph redesign) ---

export type ConceptId = string;
export type CategoryId = string;

export interface ConceptCategory {
  id: CategoryId;
  label: string;
}

export interface Concept {
  id: ConceptId;
  label: string;
  categoryId: CategoryId;
  memberPhrases: string[];
}

export interface ConceptsArtifact {
  generatedAt: string;
  categories: ConceptCategory[];
  concepts: Concept[];
}

export type ProfileConceptMap = Record<string, ConceptId[]>;

// --- Match layer (Plan 2 of the knowledge-graph redesign) ---

export interface ProfileFieldConcepts {
  offer: ConceptId[];
  seek: ConceptId[];
}

export type ProfileFieldConceptsMap = Record<string /* slug */, ProfileFieldConcepts>;

export interface Match {
  from: string;          // source partner slug — A's offer feeds this match
  to: string;            // target partner slug — B's seek feeds this match
  score: number;         // 0.5..1.0 (rows below 0.5 are dropped)
  rationale: string;     // one-sentence explanation
  sharedConcepts: ConceptId[];
  reciprocal: boolean;   // true iff the (to → from) reverse direction also kept
}
