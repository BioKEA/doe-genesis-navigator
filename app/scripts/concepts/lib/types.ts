// Shared types for the concept extraction pipeline.
// Final shapes (Concept, ProfileConceptMap) are also exported from
// app/src/types.ts so the runtime app can consume them.

export type ConceptId = string;            // e.g. "biomarker-discovery"
export type CategoryId = string;           // e.g. "bio-health"

export interface RawConceptResponse {
  slug: string;                            // partner slug
  phrases: string[];                       // 5-15 short phrases from one Haiku call
}

export interface ConceptVector {
  phrase: string;                          // unique phrase across the corpus
  embedding: number[];                     // sentence-transformers vector
}

export interface ClusterResult {
  clusterId: number;                       // -1 = noise
  members: string[];                       // raw phrases in this cluster
}

export interface ConceptCandidate {
  clusterId: number;
  suggestedLabel: string;                  // canonical short name from Haiku
  suggestedCategory: CategoryId;           // one of the LLM-proposed categories
  members: string[];                       // raw phrases in this cluster
}

export interface CategoryProposal {
  id: CategoryId;
  label: string;                           // human-friendly name
}

// Final committed shapes — also re-exported from app/src/types.ts

export interface Concept {
  id: ConceptId;
  label: string;                           // canonical short name (post-curation)
  categoryId: CategoryId;
  memberPhrases: string[];                 // for debugging / search index
}

export interface ConceptCategory {
  id: CategoryId;
  label: string;
}

export interface ConceptsArtifact {
  generatedAt: string;                     // ISO timestamp
  categories: ConceptCategory[];
  concepts: Concept[];
}

export type ProfileConceptMap = Record<string /* slug */, ConceptId[]>;
