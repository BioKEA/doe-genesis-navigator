import { create } from "zustand";

interface CanvasState {
  selectedNode: string | null;
  hoverNode: string | null;
  matchOverlayOn: boolean;
  topK: number;
  reciprocityHighlight: boolean;
  conceptCategoryFilter: Set<string>;

  setSelectedNode: (id: string | null) => void;
  setHoverNode: (id: string | null) => void;
  setMatchOverlayOn: (on: boolean) => void;
  setTopK: (k: number) => void;
  setReciprocityHighlight: (on: boolean) => void;
  toggleConceptCategory: (id: string) => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const useCanvasStore = create<CanvasState>((set) => ({
  selectedNode: null,
  hoverNode: null,
  matchOverlayOn: true,
  topK: 8,
  reciprocityHighlight: true,
  conceptCategoryFilter: new Set(),

  setSelectedNode: (id) => set({ selectedNode: id }),
  setHoverNode: (id) => set({ hoverNode: id }),
  setMatchOverlayOn: (on) => set({ matchOverlayOn: on }),
  setTopK: (k) => set({ topK: clamp(Math.round(k), 3, 20) }),
  setReciprocityHighlight: (on) => set({ reciprocityHighlight: on }),
  toggleConceptCategory: (id) =>
    set((s) => {
      const next = new Set(s.conceptCategoryFilter);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { conceptCategoryFilter: next };
    }),
}));
