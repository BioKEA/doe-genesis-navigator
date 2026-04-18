import { describe, it, expect } from "vitest";
import { findMatches } from "../src/lib/match";
import type { Profile } from "../src/types";

function mk(p: Partial<Profile>): Profile {
  return {
    slug: "x", name: "X", kind: "organization",
    challengeAreas: [], partnerTypeSeeking: [],
    rawHtmlPath: "x.html", ...p,
  };
}

describe("findMatches", () => {
  it("returns empty when no partial matches exist", () => {
    const focus = mk({ slug: "a", offerings: { text: "", tags: ["X"] }, seeking: { text: "", tags: ["Y"] } });
    const others = [
      mk({ slug: "b", offerings: { text: "", tags: ["Z"] }, seeking: { text: "", tags: ["W"] } }),
    ];
    expect(findMatches(focus, [focus, ...others])).toEqual([]);
  });

  it("ranks complementary offer/seek matches highest", () => {
    const focus = mk({
      slug: "a",
      offerings: { text: "", tags: ["Compute"] },
      seeking: { text: "", tags: ["Data"] },
      challengeAreas: ["AI"],
    });
    const perfect = mk({
      slug: "b",
      offerings: { text: "", tags: ["Data"] },           // A is seeking Data → B offers it
      seeking: { text: "", tags: ["Compute"] },          // A offers Compute → B seeks it
    });
    const challengeOnly = mk({
      slug: "c",
      challengeAreas: ["AI"],
    });
    const matches = findMatches(focus, [focus, perfect, challengeOnly]);
    expect(matches[0].profile.slug).toBe("b");
    expect(matches[0].theyOffer).toEqual(["Data"]);
    expect(matches[0].theySeek).toEqual(["Compute"]);
    expect(matches[1].profile.slug).toBe("c");
    expect(matches[1].sharedChallenges).toEqual(["AI"]);
  });

  it("excludes the focus itself from results", () => {
    const focus = mk({ slug: "a", offerings: { text: "", tags: ["X"] }, seeking: { text: "", tags: ["X"] } });
    const matches = findMatches(focus, [focus]);
    expect(matches).toEqual([]);
  });

  it("honors the limit", () => {
    const focus = mk({ slug: "a", challengeAreas: ["AI"] });
    const candidates = Array.from({ length: 10 }, (_, i) =>
      mk({ slug: `c${i}`, challengeAreas: ["AI"] }));
    const matches = findMatches(focus, [focus, ...candidates], 3);
    expect(matches.length).toBe(3);
  });
});
