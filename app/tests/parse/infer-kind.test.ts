import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { inferKind } from "../../scripts/lib/infer-kind";

const fixture = (name: string) =>
  cheerio.load(readFileSync(join(__dirname, "../../scripts/fixtures", name), "utf8"));

describe("inferKind", () => {
  it("organization when Institution Name present", () => {
    expect(inferKind(fixture("acceleration-consortium.html"))).toBe("organization");
  });

  it("person when Institution Name absent", () => {
    expect(inferKind(fixture("abel-souza.html"))).toBe("person");
  });
});
