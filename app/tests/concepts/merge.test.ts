import { describe, expect, it } from "vitest";
import { attachConceptIds } from "../../scripts/concepts/lib/merge";
import type { Profile } from "../../src/types";

const baseProfile = (slug: string): Profile => ({
  slug,
  name: slug,
  kind: "organization",
  challengeAreas: [],
  partnerTypeSeeking: [],
  rawHtmlPath: `detail-pages/${slug}.html`,
});

describe("attachConceptIds", () => {
  it("adds conceptIds to profiles that have a mapping", () => {
    const profiles = [baseProfile("alpha"), baseProfile("beta")];
    const map = { alpha: ["c1", "c2"] };
    const out = attachConceptIds(profiles, map);
    expect(out[0].conceptIds).toEqual(["c1", "c2"]);
    expect(out[1].conceptIds).toEqual([]);
  });

  it("returns new objects rather than mutating inputs", () => {
    const profiles = [baseProfile("alpha")];
    const map = { alpha: ["c1"] };
    const out = attachConceptIds(profiles, map);
    expect(out[0]).not.toBe(profiles[0]);
    expect(profiles[0].conceptIds).toBeUndefined();
  });
});
