import type { FacetCounts, Facet } from "../lib/filters";

interface Group {
  facet: Facet;
  label: string;
}

const GROUPS: Group[] = [
  { facet: "challenge",   label: "Challenge area" },
  { facet: "offers",      label: "Offers" },
  { facet: "seeking",     label: "Seeking" },
  { facet: "partnerType", label: "Partner type" },
  { facet: "orgType",     label: "Org type" },
  { facet: "orgSize",     label: "Org size" },
  { facet: "affiliation", label: "Affiliation" },
];

interface Props {
  counts: FacetCounts;
  selected: Record<Facet, string[]>;
  favoritesOnly: boolean;
  onToggle: (facet: Facet, value: string) => void;
  onFavoritesOnly: (v: boolean) => void;
  onClearAll: () => void;
}

export default function FilterSidebar({
  counts, selected, favoritesOnly, onToggle, onFavoritesOnly, onClearAll,
}: Props) {
  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">Filters</span>
        <button className="text-xs text-slate-500 hover:underline" onClick={onClearAll}>
          Clear all
        </button>
      </div>
      <label className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={favoritesOnly}
          onChange={(e) => onFavoritesOnly(e.target.checked)}
        />
        <span>Favorites only</span>
      </label>
      {GROUPS.map((g) => (
        <FacetGroup
          key={g.facet}
          label={g.label}
          values={counts[g.facet]}
          selected={selected[g.facet]}
          onToggle={(v) => onToggle(g.facet, v)}
        />
      ))}
    </aside>
  );
}

function FacetGroup({
  label, values, selected, onToggle,
}: {
  label: string;
  values: Record<string, number>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const selectedSet = new Set(selected);
  return (
    <fieldset className="mb-4">
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </legend>
      <ul>
        {entries.map(([v, n]) => (
          <li key={v}>
            <label className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={selectedSet.has(v)}
                onChange={() => onToggle(v)}
              />
              <span className="flex-1 truncate" title={v}>{v}</span>
              <span className="text-xs text-slate-400">{n}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
