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
