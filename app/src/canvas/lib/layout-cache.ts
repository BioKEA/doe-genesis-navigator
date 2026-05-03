export type Positions = Map<string, { x: number; y: number }>;

const STORAGE_KEY = "canvas:layout";

interface Cached {
  version: string;
  positions: Record<string, { x: number; y: number }>;
}

export function saveLayout(version: string, positions: Positions): void {
  const obj: Cached = {
    version,
    positions: Object.fromEntries(positions),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // Quota or disabled storage — silently no-op; layout will recompute on reload.
  }
}

export function loadLayout(version: string): Positions | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Cached;
    if (parsed.version !== version) return null;
    return new Map(Object.entries(parsed.positions));
  } catch {
    return null;
  }
}
