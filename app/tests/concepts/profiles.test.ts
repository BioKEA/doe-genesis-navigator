import { describe, expect, it } from "vitest";
import { conceptSourceText } from "../../scripts/concepts/lib/profiles";
import type { Profile } from "../../src/types";

const baseProfile = (overrides: Partial<Profile> = {}): Profile => ({
  slug: "test-slug",
  name: "Test",
  kind: "organization",
  challengeAreas: [],
  partnerTypeSeeking: [],
  rawHtmlPath: "detail-pages/test-slug.html",
  ...overrides,
});

describe("conceptSourceText", () => {
  it("concatenates the four source fields with section markers", () => {
    const p = baseProfile({
      introduction: "We do science.",
      offerings: { text: "compute power", tags: [] },
      seeking: { text: "wet-lab partners", tags: [] },
      projectIdeaSummary: "AI for materials.",
    });
    const text = conceptSourceText(p);
    expect(text).toContain("INTRODUCTION:\nWe do science.");
    expect(text).toContain("OFFERS:\ncompute power");
    expect(text).toContain("SEEKS:\nwet-lab partners");
    expect(text).toContain("PROJECT IDEA:\nAI for materials.");
  });

  it("omits sections with empty / missing fields", () => {
    const p = baseProfile({ introduction: "Only intro." });
    const text = conceptSourceText(p);
    expect(text).toContain("INTRODUCTION:\nOnly intro.");
    expect(text).not.toContain("OFFERS:");
    expect(text).not.toContain("SEEKS:");
    expect(text).not.toContain("PROJECT IDEA:");
  });

  it("returns empty string when all four fields missing", () => {
    expect(conceptSourceText(baseProfile())).toBe("");
  });
});
