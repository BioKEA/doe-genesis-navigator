import { useEffect } from "react";
import { toggleFavorite, addCompare, removeCompare, getCompare } from "./storage";

function focusedSlug(): string | null {
  const el = document.querySelector<HTMLElement>(":hover[data-slug], :focus[data-slug]");
  return el?.dataset.slug ?? null;
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const slug = focusedSlug();
      if (e.key === "f" && slug) { e.preventDefault(); toggleFavorite(slug); }
      if (e.key === "c" && slug) {
        e.preventDefault();
        if (getCompare().includes(slug)) removeCompare(slug);
        else addCompare(slug);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
