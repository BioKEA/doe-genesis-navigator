import "@testing-library/jest-dom/vitest";

// jsdom in Vitest 4 + the pinned jsdom version doesn't provide a functional
// localStorage.clear(). Replace with an in-memory implementation for tests.
const store = new Map<string, string>();
const storage: Storage = {
  get length() { return store.size; },
  clear: () => store.clear(),
  getItem: (k) => store.get(k) ?? null,
  key: (i) => Array.from(store.keys())[i] ?? null,
  removeItem: (k) => { store.delete(k); },
  setItem: (k, v) => { store.set(k, String(v)); },
};
Object.defineProperty(globalThis, "localStorage", {
  value: storage, writable: true, configurable: true,
});
