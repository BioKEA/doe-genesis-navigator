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
