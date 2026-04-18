import type { CheerioAPI } from "cheerio";
import type { ProfileKind } from "../../src/types";
import { collectProfileFieldLabels, extractName, extractLabeledText } from "./extract";

export function inferKind($: CheerioAPI): ProfileKind {
  if (!collectProfileFieldLabels($).includes("Institution Name")) {
    return "person";
  }

  const name = extractName($);
  const institutionName = extractLabeledText($, "Institution Name");

  if (name && institutionName && name === institutionName) {
    return "organization";
  }

  return "person";
}
