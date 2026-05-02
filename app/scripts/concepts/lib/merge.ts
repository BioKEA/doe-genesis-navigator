import type { Profile, ProfileConceptMap } from "../../../src/types";

export function attachConceptIds(
  profiles: Profile[],
  map: ProfileConceptMap,
): Profile[] {
  return profiles.map((p) => ({
    ...p,
    conceptIds: map[p.slug] ?? [],
  }));
}
