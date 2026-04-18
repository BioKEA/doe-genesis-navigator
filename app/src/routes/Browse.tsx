import { useEffect, useMemo, useState } from "react";
import { loadData } from "../data";
import { useFilterState } from "../lib/url-state";
import { applyFilters, facetCounts, sortProfiles, type Facet } from "../lib/filters";
import { createFuse, searchSlugs } from "../lib/search";
import { useFavorites } from "../lib/storage";
import FilterSidebar from "../components/FilterSidebar";
import ProfileCard from "../components/ProfileCard";
import ProfileTable from "../components/ProfileTable";
import SearchBox from "../components/SearchBox";
import type { Profile } from "../types";

export default function Browse() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  const favorites = useFavorites();
  const [state, update] = useFilterState();

  useEffect(() => { loadData().then(setBundle); }, []);

  const fuse = useMemo(() => {
    if (!bundle) return null;
    return createFuse(bundle.search.docs, bundle.search.index);
  }, [bundle]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;

  const criteria = {
    challenge: state.challenge, offers: state.offers, seeking: state.seeking,
    partnerType: state.partnerType, orgType: state.orgType, orgSize: state.orgSize,
    affiliation: state.affiliation,
    favoritesOnly: state.favoritesOnly, favorites,
  };

  let filtered: Profile[] = applyFilters(bundle.profiles, criteria);

  if (fuse && state.q) {
    const hits = searchSlugs(fuse, state.q);
    if (hits) filtered = filtered.filter((p) => hits.has(p.slug));
  }

  const sorted = sortProfiles(filtered, state.sort);
  const counts = facetCounts(bundle.profiles, criteria);

  const toggleFacet = (f: Facet, v: string) => {
    const current = state[f];
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    update({ [f]: next } as any);
  };

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <FilterSidebar
        counts={counts}
        selected={{
          challenge: state.challenge, offers: state.offers, seeking: state.seeking,
          partnerType: state.partnerType, orgType: state.orgType, orgSize: state.orgSize,
          affiliation: state.affiliation,
        }}
        favoritesOnly={state.favoritesOnly}
        onToggle={toggleFacet}
        onFavoritesOnly={(v) => update({ favoritesOnly: v })}
        onClearAll={() => update({
          challenge: [], offers: [], seeking: [], partnerType: [],
          orgType: [], orgSize: [], affiliation: [],
          favoritesOnly: false, q: "",
        })}
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1">
            <SearchBox value={state.q} onChange={(v) => update({ q: v })} />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>{sorted.length} results</span>
            <select
              value={state.sort}
              onChange={(e) => update({ sort: e.target.value as typeof state.sort })}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value="relevance">Relevance</option>
              <option value="name">Name</option>
              <option value="affiliation">Affiliation</option>
              <option value="richness">Completeness</option>
            </select>
            <div className="flex rounded-md border border-slate-300">
              <button
                className={`px-2 py-1 text-sm ${state.view === "cards" ? "bg-slate-900 text-white" : "bg-white"}`}
                onClick={() => update({ view: "cards" })}
              >
                Cards
              </button>
              <button
                className={`px-2 py-1 text-sm ${state.view === "table" ? "bg-slate-900 text-white" : "bg-white"}`}
                onClick={() => update({ view: "table" })}
              >
                Table
              </button>
            </div>
          </div>
        </div>
        {state.view === "cards" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((p) => <ProfileCard key={p.slug} profile={p} />)}
          </div>
        ) : (
          <ProfileTable profiles={sorted} />
        )}
      </div>
    </div>
  );
}
