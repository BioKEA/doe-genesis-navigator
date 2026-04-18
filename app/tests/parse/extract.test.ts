import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import {
  extractName,
  extractLabeledText,
  extractLabeledTags,
  extractLabeledLink,
  extractTaggedText,
  collectProfileFieldLabels,
} from "../../scripts/lib/extract";

const fixture = (name: string) =>
  cheerio.load(readFileSync(join(__dirname, "../../scripts/fixtures", name), "utf8"));

describe("extract", () => {
  it("reads the page title", () => {
    const $ = fixture("acceleration-consortium.html");
    expect(extractName($)).toBe("Acceleration Consortium");
  });

  it("reads a simple labeled text field", () => {
    const $ = fixture("acceleration-consortium.html");
    expect(extractLabeledText($, "Affiliation")).toBe("Academic institution");
    expect(extractLabeledText($, "Organization Size")).toBe(
      "Small: 50 - 499 employees",
    );
  });

  it("returns undefined for missing labels", () => {
    const $ = fixture("acceleration-consortium.html");
    expect(extractLabeledText($, "Does Not Exist")).toBeUndefined();
  });

  it("reads a tag-group field as an array", () => {
    const $ = fixture("acceleration-consortium.html");
    const tags = extractLabeledTags(
      $,
      "National Science and Technology Challenges",
    );
    expect(tags).toContain("Achieving AI-Driven Autonomous Laboratories");
    expect(tags.length).toBeGreaterThanOrEqual(1);
  });

  it("reads the Website Address link", () => {
    const $ = fixture("acceleration-consortium.html");
    expect(extractLabeledLink($, "Website Address")).toMatch(/^https?:\/\//);
  });

  it("reads a checkbox-notes field (Offerings) as tagged text", () => {
    const $ = fixture("acceleration-consortium.html");
    const off = extractTaggedText($, "Offerings");
    expect(off).toBeDefined();
    expect(off!.text.length).toBeGreaterThan(0);
    expect(Array.isArray(off!.tags)).toBe(true);
  });

  it("enumerates all present labels for a page", () => {
    const $ = fixture("acceleration-consortium.html");
    const labels = collectProfileFieldLabels($);
    expect(labels).toContain("Institution Name");
    expect(labels).toContain("Affiliation");
  });
});
