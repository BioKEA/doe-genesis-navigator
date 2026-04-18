import { describe, it, expect, beforeEach } from "vitest";
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  addCompare,
  removeCompare,
  getCompare,
  clearCompare,
} from "../src/lib/storage";

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("toggles favorites", () => {
    addFavorite("a");
    addFavorite("b");
    addFavorite("a");
    expect(getFavorites().sort()).toEqual(["a", "b"]);
    removeFavorite("a");
    expect(getFavorites()).toEqual(["b"]);
  });

  it("caps compare at 5", () => {
    const added: boolean[] = [];
    for (const slug of ["a", "b", "c", "d", "e", "f"]) {
      added.push(addCompare(slug));
    }
    expect(added).toEqual([true, true, true, true, true, false]);
    expect(getCompare().length).toBe(5);
  });

  it("removes and clears compare", () => {
    addCompare("x");
    addCompare("y");
    removeCompare("x");
    expect(getCompare()).toEqual(["y"]);
    clearCompare();
    expect(getCompare()).toEqual([]);
  });
});
