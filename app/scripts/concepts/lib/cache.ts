import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Cache<T> {
  get(input: string): Promise<T | null>;
  set(input: string, value: T): Promise<void>;
}

function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function createCache<T>(dir: string): Cache<T> {
  mkdirSync(dir, { recursive: true });

  return {
    async get(input) {
      const path = join(dir, `${hashKey(input)}.json`);
      if (!existsSync(path)) return null;
      return JSON.parse(readFileSync(path, "utf8")) as T;
    },
    async set(input, value) {
      const path = join(dir, `${hashKey(input)}.json`);
      writeFileSync(path, JSON.stringify(value));
    },
  };
}
