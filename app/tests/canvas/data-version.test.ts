import { describe, expect, it } from "vitest";
import { dataVersion } from "../../src/canvas/lib/data-version";

const base = {
  profileCount: 486,
  conceptCount: 126,
  matchCount: 7892,
  bipartiteEdgeCount: 5121,
};

describe("dataVersion", () => {
  it("returns the same string for the same input", () => {
    expect(dataVersion(base)).toBe(dataVersion(base));
  });
  it("returns a different string when any field changes", () => {
    expect(dataVersion(base)).not.toBe(dataVersion({ ...base, matchCount: 7893 }));
    expect(dataVersion(base)).not.toBe(dataVersion({ ...base, profileCount: 487 }));
  });
});
