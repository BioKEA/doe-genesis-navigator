import { useSyncExternalStore } from "react";

const FAV_KEY = "genesis.favorites";
const CMP_KEY = "genesis.compare";
const MAX_COMPARE = 5;

type Key = typeof FAV_KEY | typeof CMP_KEY;

const bus = new EventTarget();

// Cached snapshots so useSyncExternalStore returns referentially stable
// arrays between renders until a real change occurs.
let favSnapshot: string[] = [];
let cmpSnapshot: string[] = [];

function read(key: Key): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: Key, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable; caller falls back to in-memory state
  }
  if (key === FAV_KEY) favSnapshot = value;
  else cmpSnapshot = value;
  bus.dispatchEvent(new CustomEvent(key));
}

// Cross-tab sync: re-emit on storage events from other tabs
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === FAV_KEY) { favSnapshot = read(FAV_KEY); bus.dispatchEvent(new CustomEvent(FAV_KEY)); }
    if (e.key === CMP_KEY) { cmpSnapshot = read(CMP_KEY); bus.dispatchEvent(new CustomEvent(CMP_KEY)); }
  });
}

function subscribe(key: Key, cb: () => void): () => void {
  bus.addEventListener(key, cb);
  return () => bus.removeEventListener(key, cb);
}

// --- Favorites ---

export function getFavorites(): string[] {
  return read(FAV_KEY);
}

export function toggleFavorite(slug: string): boolean {
  const set = new Set(read(FAV_KEY));
  if (set.has(slug)) {
    set.delete(slug);
    write(FAV_KEY, [...set]);
    return false;
  }
  set.add(slug);
  write(FAV_KEY, [...set]);
  return true;
}

export function addFavorite(slug: string) {
  const set = new Set(read(FAV_KEY));
  if (!set.has(slug)) {
    set.add(slug);
    write(FAV_KEY, [...set]);
  }
}

export function removeFavorite(slug: string) {
  write(FAV_KEY, read(FAV_KEY).filter((s) => s !== slug));
}

// --- Compare ---

export function getCompare(): string[] {
  return read(CMP_KEY);
}

export function addCompare(slug: string): boolean {
  const current = read(CMP_KEY);
  if (current.includes(slug)) return true;
  if (current.length >= MAX_COMPARE) return false;
  write(CMP_KEY, [...current, slug]);
  return true;
}

export function removeCompare(slug: string) {
  write(CMP_KEY, read(CMP_KEY).filter((s) => s !== slug));
}

export function clearCompare() {
  write(CMP_KEY, []);
}

export { MAX_COMPARE };

// Initialize snapshots from localStorage now that `read` is defined.
favSnapshot = read(FAV_KEY);
cmpSnapshot = read(CMP_KEY);

// --- React hooks ---

export function useFavorites(): string[] {
  return useSyncExternalStore(
    (cb) => subscribe(FAV_KEY, cb),
    () => favSnapshot,
    () => favSnapshot,
  );
}

export function useCompare(): string[] {
  return useSyncExternalStore(
    (cb) => subscribe(CMP_KEY, cb),
    () => cmpSnapshot,
    () => cmpSnapshot,
  );
}
