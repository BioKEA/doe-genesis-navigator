import { useMemo } from "react";
import { useCanvasStore } from "./lib/store";
import type { CanvasData } from "./lib/types";

interface Props { data: CanvasData }

export function RightPane({ data }: Props) {
  const selectedNode = useCanvasStore((s) => s.selectedNode);
  const setSelectedNode = useCanvasStore.getState().setSelectedNode;

  const conceptById = useMemo(
    () => new Map(data.concepts.map((c) => [c.id, c])),
    [data.concepts],
  );
  const profileBySlug = useMemo(
    () => new Map(data.profiles.map((p) => [p.slug, p])),
    [data.profiles],
  );

  if (!selectedNode) {
    return (
      <aside className="w-[260px] border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
        Nothing selected — click a node on the canvas.
      </aside>
    );
  }

  if (selectedNode.startsWith("partner:")) {
    const slug = selectedNode.slice("partner:".length);
    const profile = profileBySlug.get(slug);
    if (!profile) return null;
    const conceptIds = data.profileConcepts[slug] ?? [];
    const matches = data.matches
      .filter((m) => m.from === slug)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return (
      <aside className="flex w-[260px] flex-col gap-4 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-200">
        <header>
          <h2 className="text-base font-semibold">{profile.name}</h2>
          {profile.affiliation && <p className="text-xs text-neutral-400">{profile.affiliation}</p>}
        </header>
        <section>
          <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Concepts</h3>
          <ul className="flex flex-wrap gap-1">
            {conceptIds.map((id) => {
              const c = conceptById.get(id);
              if (!c) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(`concept:${id}`)}
                    className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs hover:border-pink-500"
                  >
                    {c.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-400">
            Top matches ({matches.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {matches.map((m) => {
              const target = profileBySlug.get(m.to);
              return (
                <li key={`${m.from}->${m.to}`} className="rounded border border-neutral-800 p-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNode(`partner:${m.to}`)}
                    className="flex items-center gap-2 text-left font-medium text-pink-300 hover:underline"
                  >
                    {target?.name ?? m.to}
                    {m.reciprocal && <span title="reciprocal" className="text-pink-500">⇄</span>}
                    <span className="ml-auto text-xs text-neutral-400">
                      {m.score.toFixed(2)}
                    </span>
                  </button>
                  <p className="mt-1 text-xs text-neutral-300">{m.rationale}</p>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    );
  }

  if (selectedNode.startsWith("concept:")) {
    const id = selectedNode.slice("concept:".length);
    const c = conceptById.get(id);
    if (!c) return null;
    const partners = Object.entries(data.profileConcepts)
      .filter(([_, ids]) => ids.includes(id))
      .map(([slug]) => profileBySlug.get(slug))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    return (
      <aside className="flex w-[260px] flex-col gap-3 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-200">
        <header>
          <h2 className="text-base font-semibold">{c.label}</h2>
          <p className="text-xs text-neutral-400">
            {c.categoryId ?? "uncategorized"} · {partners.length} partners
          </p>
        </header>
        <ul className="flex flex-col gap-1">
          {partners.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => setSelectedNode(`partner:${p.slug}`)}
                className="text-left text-pink-300 hover:underline"
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    );
  }

  return null;
}
