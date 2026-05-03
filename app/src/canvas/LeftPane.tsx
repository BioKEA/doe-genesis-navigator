import { useCanvasStore } from "./lib/store";

interface Category { id: string; label: string; count: number }
interface Props { categories: Category[] }

export function LeftPane({ categories }: Props) {
  const matchOverlayOn = useCanvasStore((s) => s.matchOverlayOn);
  const topK = useCanvasStore((s) => s.topK);
  const reciprocityHighlight = useCanvasStore((s) => s.reciprocityHighlight);
  const conceptCategoryFilter = useCanvasStore((s) => s.conceptCategoryFilter);
  const { setMatchOverlayOn, setTopK, setReciprocityHighlight, toggleConceptCategory } =
    useCanvasStore.getState();

  return (
    <aside className="flex h-full w-[220px] flex-col gap-6 overflow-y-auto border-r border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-200">
      <section>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Matches</h3>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={matchOverlayOn}
            onChange={(e) => setMatchOverlayOn(e.target.checked)}
          />
          Show offer→seek matches
        </label>
        <label className="mt-3 block">
          <span className="text-xs text-neutral-400">
            Top matches per partner: {topK}
          </span>
          <input
            aria-label="top matches per partner"
            type="range"
            min={3}
            max={20}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={reciprocityHighlight}
            onChange={(e) => setReciprocityHighlight(e.target.checked)}
          />
          Highlight reciprocal matches
        </label>
      </section>

      <section>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Concept categories</h3>
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => {
            const active = conceptCategoryFilter.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleConceptCategory(c.id)}
                className={
                  "rounded-full border px-2 py-0.5 text-xs " +
                  (active
                    ? "border-pink-500 bg-pink-500/20 text-pink-200"
                    : "border-neutral-700 text-neutral-300 hover:border-neutral-500")
                }
              >
                {c.label} <span className="opacity-60">({c.count})</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-auto border-t border-neutral-800 pt-3 text-[11px] text-neutral-500">
        Built by{" "}
        <a
          href="https://biokea.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-300 hover:text-pink-300"
        >
          BioKEA
        </a>
        {" · "}
        Curated 2026-05-02
      </div>
    </aside>
  );
}
