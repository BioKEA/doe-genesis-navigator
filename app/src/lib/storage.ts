const FAV_KEY = "genesis.favorites";
const CMP_KEY = "genesis.compare";
const MAX_COMPARE = 5;

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable; caller falls back to in-memory state
  }
}

export function getFavorites(): string[] {
  return read(FAV_KEY);
}

export function addFavorite(slug: string) {
  const set = new Set(read(FAV_KEY));
  set.add(slug);
  write(FAV_KEY, [...set]);
}

export function removeFavorite(slug: string) {
  write(FAV_KEY, read(FAV_KEY).filter((s) => s !== slug));
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
