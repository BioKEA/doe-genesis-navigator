import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCache } from "../../scripts/concepts/lib/cache";

describe("cache", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cache-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null on miss, stores and returns on hit", async () => {
    const cache = createCache<{ value: number }>(dir);
    expect(await cache.get("input-a")).toBeNull();

    await cache.set("input-a", { value: 42 });
    expect(await cache.get("input-a")).toEqual({ value: 42 });
  });

  it("isolates entries by input string", async () => {
    const cache = createCache<{ v: string }>(dir);
    await cache.set("input-a", { v: "alpha" });
    await cache.set("input-b", { v: "beta" });
    expect(await cache.get("input-a")).toEqual({ v: "alpha" });
    expect(await cache.get("input-b")).toEqual({ v: "beta" });
  });

  it("survives a fresh cache instance over the same dir", async () => {
    const c1 = createCache<{ x: number }>(dir);
    await c1.set("k", { x: 7 });

    const c2 = createCache<{ x: number }>(dir);
    expect(await c2.get("k")).toEqual({ x: 7 });
  });
});
