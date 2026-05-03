import { afterEach, describe, expect, it } from "vitest";
import { loadLayout, saveLayout } from "../../src/canvas/lib/layout-cache";

afterEach(() => localStorage.clear());

describe("layout-cache", () => {
  it("saves and round-trips positions for a given version", () => {
    const positions = new Map([["a", { x: 1, y: 2 }], ["b", { x: 3, y: 4 }]]);
    saveLayout("v1:1:1:1:1", positions);
    const read = loadLayout("v1:1:1:1:1");
    expect(read).not.toBeNull();
    expect(read!.get("a")).toEqual({ x: 1, y: 2 });
    expect(read!.get("b")).toEqual({ x: 3, y: 4 });
  });

  it("returns null when the version key is unknown", () => {
    expect(loadLayout("v1:nothing")).toBeNull();
  });

  it("returns null when the cached version doesn't match", () => {
    saveLayout("v1:a", new Map([["x", { x: 0, y: 0 }]]));
    expect(loadLayout("v1:b")).toBeNull();
  });
});
