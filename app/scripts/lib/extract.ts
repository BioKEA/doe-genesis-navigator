import type { CheerioAPI } from "cheerio";
import type { TaggedText } from "../../src/types";

const ROW = "div.row.fieldRow, div.row.mb-2.fieldRow";

function rowFor($: CheerioAPI, label: string) {
  return $(ROW)
    .filter((_, el) => $(el).find("div.profileField").first().text().trim() === label)
    .first();
}

export function extractName($: CheerioAPI): string {
  return $("h1.title .field--name-label").first().text().trim()
    || $("h1.title").first().text().trim();
}

export function extractLabeledText($: CheerioAPI, label: string): string | undefined {
  const row = rowFor($, label);
  if (row.length === 0) return undefined;
  const value = row.find("div.fieldValue").first().text().replace(/\s+/g, " ").trim();
  return value.length > 0 ? value : undefined;
}

export function extractLabeledTags($: CheerioAPI, label: string): string[] {
  const row = rowFor($, label);
  if (row.length === 0) return [];
  return row
    .find("div.field__items div.field__item, div.field__item")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

export function extractLabeledLink($: CheerioAPI, label: string): string | undefined {
  const row = rowFor($, label);
  if (row.length === 0) return undefined;
  const href = row.find("div.fieldValue a").first().attr("href");
  return href?.trim() || undefined;
}

export function extractLabeledHtmlText(
  $: CheerioAPI,
  label: string,
): string | undefined {
  const row = rowFor($, label);
  if (row.length === 0) return undefined;
  const text = row
    .find("div.fieldValue")
    .first()
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text.length > 0 ? text : undefined;
}

export function extractTaggedText(
  $: CheerioAPI,
  label: string,
): TaggedText | undefined {
  const row = rowFor($, label);
  if (row.length === 0) return undefined;
  const value = row.find("div.fieldValue").first();
  const tags = value
    .find(".taxonomy-checkbox-notes-list__term")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((s) => s.length > 0 && s.length < 200);
  const text = value.text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (text.length === 0 && tags.length === 0) return undefined;
  return { text, tags: Array.from(new Set(tags)) };
}

export function collectProfileFieldLabels($: CheerioAPI): string[] {
  return $("div.profileField")
    .map((_, el) => $(el).text().trim())
    .get();
}
