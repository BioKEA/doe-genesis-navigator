import type { Concept, ConceptsArtifact, Match, Profile, ProfileConceptMap } from "../../types";
import type { CanvasData } from "./types";

async function fetchJson<T>(path: string): Promise<T> {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`fetch ${path} failed: ${resp.status}`);
  return (await resp.json()) as T;
}

export async function loadCanvasData(): Promise<CanvasData> {
  const [profiles, conceptsArtifact, profileConcepts, matches] = await Promise.all([
    fetchJson<Profile[]>("data/profiles.json"),
    fetchJson<ConceptsArtifact>("data/concepts.json"),
    fetchJson<ProfileConceptMap>("data/profile-concepts.json").catch(() => ({})),
    fetchJson<Match[]>("data/matches.json").catch(() => []),
  ]);
  return {
    profiles,
    concepts: conceptsArtifact.concepts as Concept[],
    profileConcepts,
    matches,
  };
}
