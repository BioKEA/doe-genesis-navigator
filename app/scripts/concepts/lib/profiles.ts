import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Profile } from "../../../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function conceptSourceText(p: Profile): string {
  const parts: string[] = [];
  const push = (label: string, text?: string) => {
    if (text && text.trim().length > 0) {
      parts.push(`${label}:\n${text.trim()}`);
    }
  };
  push("INTRODUCTION", p.introduction);
  push("OFFERS", p.offerings?.text);
  push("SEEKS", p.seeking?.text);
  push("PROJECT IDEA", p.projectIdeaSummary);
  return parts.join("\n\n");
}

export function loadParsedProfiles(): Profile[] {
  const path = resolve(__dirname, "../../../public/data/profiles.json");
  return JSON.parse(readFileSync(path, "utf8")) as Profile[];
}
