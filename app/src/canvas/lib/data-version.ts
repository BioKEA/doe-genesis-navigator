export interface DataShape {
  profileCount: number;
  conceptCount: number;
  matchCount: number;
  bipartiteEdgeCount: number;
}

export function dataVersion(s: DataShape): string {
  return `v1:${s.profileCount}:${s.conceptCount}:${s.matchCount}:${s.bipartiteEdgeCount}`;
}
