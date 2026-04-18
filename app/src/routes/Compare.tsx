import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../data";
import { clearCompare, getCompare, removeCompare } from "../lib/storage";
import type { Profile } from "../types";

const ROWS: Array<[string, (p: Profile) => string]> = [
  ["Affiliation",   (p) => p.affiliation ?? ""],
  ["Org type",      (p) => p.orgType ?? ""],
  ["Org size",      (p) => p.orgSize ?? ""],
  ["Website",       (p) => p.website ?? ""],
  ["Challenge areas", (p) => p.challengeAreas.join("; ")],
  ["Offers",        (p) => p.offerings?.text ?? ""],
  ["Seeking",       (p) => p.seeking?.text ?? ""],
  ["Partner types", (p) => p.partnerTypeSeeking.join("; ")],
  ["Project idea",  (p) => p.projectIdeaSummary ?? ""],
];

function toCsv(profiles: Profile[]): string {
  const header = ["Field", ...profiles.map((p) => p.name)];
  const rows = ROWS.map(([label, f]) => [label, ...profiles.map(f)]);
  const esc = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Compare() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    loadData().then(setBundle);
    setSlugs(getCompare());
  }, []);

  const profiles = useMemo(() => {
    if (!bundle) return [];
    const map = new Map(bundle.profiles.map((p) => [p.slug, p]));
    return slugs.map((s) => map.get(s)).filter((p): p is Profile => !!p);
  }, [bundle, slugs]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;

  if (profiles.length === 0) return (
    <div className="p-8 text-slate-600">
      No profiles pinned. Go to <Link className="text-sky-700 underline" to="/">Browse</Link>
      {" "}and click the compare icon on any card.
    </div>
  );

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-slate-600">{profiles.length} / 5 pinned</span>
        <button
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          onClick={() => download("compare.csv", "text/csv", toCsv(profiles))}
        >
          Export CSV
        </button>
        <button
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
          onClick={() =>
            download("compare.json", "application/json", JSON.stringify(profiles, null, 2))
          }
        >
          Export JSON
        </button>
        <button
          className="ml-auto text-sm text-slate-500 hover:underline"
          onClick={() => { clearCompare(); setSlugs([]); }}
        >
          Clear all
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-500">Field</th>
              {profiles.map((p) => (
                <th key={p.slug} className="px-3 py-2 text-left">
                  <div className="flex items-center gap-2">
                    <Link to={`/profile/${p.slug}`} className="font-medium text-sky-700 hover:underline">
                      {p.name}
                    </Link>
                    <button
                      aria-label="Unpin"
                      className="text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => {
                        removeCompare(p.slug);
                        setSlugs((s) => s.filter((x) => x !== p.slug));
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, f]) => (
              <tr key={label} className="border-t border-slate-100 align-top">
                <td className="w-40 bg-slate-50 px-3 py-2 font-medium text-slate-500">{label}</td>
                {profiles.map((p) => (
                  <td key={p.slug} className="px-3 py-2 text-slate-800">{f(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
