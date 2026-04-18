import "@testing-library/jest-dom/vitest";

// Polyfill/override localStorage to ensure it has a clear method for tests
const store: Record<string, string> = {};
const localStoragePolyfill: Storage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  },
  key: (index: number) => {
    const keys = Object.keys(store);
    return keys[index] || null;
  },
  length: Object.keys(store).length,
} as Storage;

Object.defineProperty(globalThis, "localStorage", {
  value: localStoragePolyfill,
  writable: true,
  configurable: true,
});
