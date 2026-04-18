import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../data";
import NetworkGraph from "../components/NetworkGraph";
import { AFFILIATION_COLORS } from "../lib/affiliations";
import type { Profile } from "../types";

export default function Network() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);

  useEffect(() => { loadData().then(setBundle); }, []);

  const bySlug = useMemo(() => {
    if (!bundle) return new Map<string, Profile>();
    return new Map(bundle.profiles.map((p) => [p.slug, p]));
  }, [bundle]);

  const challenges = useMemo(() => {
    if (!bundle) return [];
    const counts = new Map<string, number>();
    for (const p of bundle.profiles) {
      for (const c of p.challengeAreas) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [bundle]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="relative flex h-[calc(100vh-57px)]">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 text-sm">
        <div className="mb-3 font-semibold">How to read this</div>
        <p className="mb-4 text-xs text-slate-500 leading-relaxed">
          Large dark circles are <strong>challenge areas</strong>. Small colored circles are
          <strong> partners</strong>, clustered around the challenges they work on.
          Click a challenge below to highlight its network; click any partner to see details.
        </p>

        <div className="mb-3 font-semibold">Affiliation</div>
        <ul className="mb-4">
          {Object.entries(AFFILIATION_COLORS).map(([label, color]) => (
            <li key={label} className="mb-1 flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
              <span className="text-xs">{label}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-slate-500" />
            <span className="text-xs">Other / unspecified</span>
          </li>
        </ul>

        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Highlight challenge ({challenges.length})
        </div>
        <div className="flex flex-col gap-1">
          <button
            className={`rounded px-2 py-1 text-left text-xs ${!highlight ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
            onClick={() => setHighlight(null)}
          >
            Show all
          </button>
          {challenges.map(([c, n]) => (
            <button
              key={c}
              title={c}
              className={`rounded px-2 py-1 text-left text-xs ${highlight === c ? "bg-indigo-600 text-white" : "hover:bg-slate-100"}`}
              onClick={() => setHighlight(c === highlight ? null : c)}
            >
              <span className="mr-1 inline-block min-w-[1.5rem] text-right text-[10px] opacity-70">{n}</span>
              {c}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1">
        <NetworkGraph
          profiles={bundle.profiles}
          highlightChallenge={highlight}
          onProfileClick={(slug) => setSelected(bySlug.get(slug) ?? null)}
          onChallengeClick={(c) => setHighlight(c === highlight ? null : c)}
        />
      </div>

      {selected && (
        <div className="absolute right-0 top-0 h-full w-80 overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-xl">
          <button
            className="mb-3 text-xs text-slate-500 hover:underline"
            onClick={() => setSelected(null)}
          >
            Close ✕
          </button>
          <h2 className="text-lg font-semibold">{selected.name}</h2>
          <div className="text-xs text-slate-500">{selected.affiliation}</div>
          {selected.introduction && (
            <p className="mt-2 text-sm text-slate-700 line-clamp-6">{selected.introduction}</p>
          )}
          {selected.challengeAreas.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Challenge areas</div>
              <div className="flex flex-wrap gap-1">
                {selected.challengeAreas.map((c) => (
                  <span key={c} className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-800">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Link
            to={`/profile/${selected.slug}`}
            className="mt-4 inline-block text-sm text-sky-700 underline"
          >
            Open full profile →
          </Link>
        </div>
      )}
    </div>
  );
}
