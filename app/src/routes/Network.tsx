import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../data";
import NetworkGraph from "../components/NetworkGraph";
import type { Profile } from "../types";
import { AFFILIATION_COLORS } from "../lib/affiliations";

export default function Network() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [threshold, setThreshold] = useState(5);

  useEffect(() => { loadData().then(setBundle); }, []);

  const bySlug = useMemo(() => {
    if (!bundle) return new Map<string, Profile>();
    return new Map(bundle.profiles.map((p) => [p.slug, p]));
  }, [bundle]);

  const challenges = useMemo(() => {
    if (!bundle) return [];
    const set = new Set<string>();
    for (const p of bundle.profiles) for (const c of p.challengeAreas) set.add(c);
    return [...set].sort();
  }, [bundle]);

  const profileChallenges = useMemo(() => {
    if (!bundle) return new Map<string, string[]>();
    return new Map(bundle.profiles.map((p) => [p.slug, p.challengeAreas]));
  }, [bundle]);

  const visibleEdgeCount = useMemo(() => {
    if (!bundle) return 0;
    return bundle.network.edges.filter((e) => e.weight >= threshold).length;
  }, [bundle, threshold]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="relative flex h-[calc(100vh-57px)]">
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 text-sm">
        <div className="mb-3 font-semibold">Legend</div>
        <ul className="mb-4">
          {Object.entries(AFFILIATION_COLORS).map(([label, color]) => (
            <li key={label} className="mb-1 flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
              <span className="text-xs">{label}</span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-slate-500" />
            <span className="text-xs">Other</span>
          </li>
        </ul>
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
            <span>Edge threshold</span>
            <span className="text-slate-400 normal-case">weight ≥ {threshold}</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 text-xs text-slate-400">
            {visibleEdgeCount.toLocaleString()} edges visible
          </div>
        </div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Highlight challenge
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            className={`rounded border px-2 py-0.5 text-xs ${!highlight ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}
            onClick={() => setHighlight(null)}
          >
            All
          </button>
          {challenges.map((c) => (
            <button
              key={c}
              className={`rounded border px-2 py-0.5 text-xs ${highlight === c ? "border-indigo-700 bg-indigo-600 text-white" : "border-slate-300 bg-white"}`}
              onClick={() => setHighlight(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1">
        <NetworkGraph
          data={bundle.network}
          weightThreshold={threshold}
          highlightChallenge={highlight}
          profileChallenges={profileChallenges}
          onNodeClick={(slug) => setSelected(bySlug.get(slug) ?? null)}
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
          <Link
            to={`/profile/${selected.slug}`}
            className="mt-3 inline-block text-sm text-sky-700 underline"
          >
            Open full profile
          </Link>
        </div>
      )}
    </div>
  );
}
