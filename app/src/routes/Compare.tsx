import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadData } from "../data";
import { clearCompare, removeCompare, useCompare } from "../lib/storage";
import { affiliationColor } from "../lib/affiliations";
import type { Profile } from "../types";

type FieldKind = "text" | "chips";
interface Field {
  label: string;
  kind: FieldKind;
  text?: (p: Profile) => string | undefined;
  chips?: (p: Profile) => string[];
  forCsv: (p: Profile) => string;
}

const FIELDS: Field[] = [
  { label: "Affiliation",
    kind: "text", text: (p) => p.affiliation,
    forCsv: (p) => p.affiliation ?? "" },
  { label: "Org type",
    kind: "text", text: (p) => p.orgType,
    forCsv: (p) => p.orgType ?? "" },
  { label: "Org size",
    kind: "text", text: (p) => p.orgSize,
    forCsv: (p) => p.orgSize ?? "" },
  { label: "Website",
    kind: "text", text: (p) => p.website,
    forCsv: (p) => p.website ?? "" },
  { label: "Challenge areas",
    kind: "chips", chips: (p) => p.challengeAreas,
    forCsv: (p) => p.challengeAreas.join("; ") },
  { label: "Offers",
    kind: "chips", chips: (p) => p.offerings?.tags ?? [],
    forCsv: (p) => p.offerings?.tags.join("; ") ?? "" },
  { label: "Seeking",
    kind: "chips", chips: (p) => p.seeking?.tags ?? [],
    forCsv: (p) => p.seeking?.tags.join("; ") ?? "" },
  { label: "Partner types",
    kind: "chips", chips: (p) => p.partnerTypeSeeking,
    forCsv: (p) => p.partnerTypeSeeking.join("; ") },
  { label: "Project idea",
    kind: "text", text: (p) => p.projectIdeaSummary,
    forCsv: (p) => p.projectIdeaSummary ?? "" },
  { label: "Offerings (detail)",
    kind: "text", text: (p) => p.offerings?.text,
    forCsv: (p) => p.offerings?.text ?? "" },
  { label: "Seeking (detail)",
    kind: "text", text: (p) => p.seeking?.text,
    forCsv: (p) => p.seeking?.text ?? "" },
];

function toCsv(profiles: Profile[]): string {
  const header = ["Field", ...profiles.map((p) => p.name)];
  const rows = FIELDS.map((f) => [f.label, ...profiles.map(f.forCsv)]);
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
  const slugs = useCompare();
  useEffect(() => { loadData().then(setBundle); }, []);

  const profiles = useMemo(() => {
    if (!bundle) return [];
    const map = new Map(bundle.profiles.map((p) => [p.slug, p]));
    return slugs.map((s) => map.get(s)).filter((p): p is Profile => !!p);
  }, [bundle, slugs]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;

  if (profiles.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-8 text-slate-600">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Compare up to 5 partners</h2>
        <p className="mb-4 text-sm">
          Pin partners from <Link className="text-sky-700 underline" to="/">Browse</Link> or{" "}
          <Link className="text-sky-700 underline" to="/network">Matchmaker</Link> by clicking the
          compare icon. Once pinned they appear here side by side, with shared values highlighted.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Compare</h2>
        <span className="text-sm text-slate-500">{profiles.length} / 5 pinned</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm hover:bg-slate-50"
            onClick={() => download("compare.csv", "text/csv", toCsv(profiles))}
          >
            Export CSV
          </button>
          <button
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm hover:bg-slate-50"
            onClick={() =>
              download("compare.json", "application/json", JSON.stringify(profiles, null, 2))
            }
          >
            Export JSON
          </button>
          <button
            className="text-sm text-slate-500 hover:underline"
            onClick={clearCompare}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-44 bg-slate-50 px-3 py-3 text-left text-xs uppercase text-slate-500">
                Field
              </th>
              {profiles.map((p) => (
                <th key={p.slug} className="min-w-[240px] border-l border-slate-100 bg-slate-50 px-3 py-3 text-left align-top">
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: affiliationColor(p.affiliation) }}
                      title={p.affiliation ?? "Unknown affiliation"}
                    />
                    <div className="flex-1">
                      <Link to={`/profile/${p.slug}`} className="font-semibold text-sky-700 hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs font-normal text-slate-500">
                        {[p.affiliation, p.orgSize].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <button
                      aria-label="Unpin"
                      className="text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => removeCompare(p.slug)}
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f) => (
              <Row key={f.label} field={f} profiles={profiles} />
            ))}
          </tbody>
        </table>
      </div>

      <ComplementarityPanel profiles={profiles} />
    </div>
  );
}

function Row({ field, profiles }: { field: Field; profiles: Profile[] }) {
  // For chip fields, compute shared vs. unique across pinned profiles
  const sharedChips = useMemo(() => {
    if (field.kind !== "chips") return new Set<string>();
    const sets = profiles.map((p) => new Set(field.chips!(p)));
    if (sets.length === 0) return new Set<string>();
    const [first, ...rest] = sets;
    const shared = new Set(first);
    for (const s of rest) for (const x of shared) if (!s.has(x)) shared.delete(x);
    return shared;
  }, [field, profiles]);

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="sticky left-0 z-10 w-44 bg-slate-50 px-3 py-2 font-medium text-slate-500">
        {field.label}
      </td>
      {profiles.map((p) => (
        <td key={p.slug} className="border-l border-slate-100 px-3 py-2 text-slate-800">
          {field.kind === "text"
            ? <TextCell text={field.text!(p)} />
            : <ChipsCell chips={field.chips!(p)} shared={sharedChips} />}
        </td>
      ))}
    </tr>
  );
}

function TextCell({ text }: { text: string | undefined }) {
  if (!text) return <span className="text-slate-400">—</span>;
  return <div className="whitespace-pre-line">{text}</div>;
}

function ChipsCell({ chips, shared }: { chips: string[]; shared: Set<string> }) {
  if (chips.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => {
        const isShared = shared.has(c);
        return (
          <span
            key={c}
            className={
              isShared
                ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-300"
                : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
            }
            title={isShared ? "Shared by all pinned partners" : undefined}
          >
            {c}
          </span>
        );
      })}
    </div>
  );
}

function ComplementarityPanel({ profiles }: { profiles: Profile[] }) {
  if (profiles.length < 2) return null;
  const pairs = useMemo(() => {
    const out: Array<{ a: Profile; b: Profile; aOffersBSeeks: string[]; bOffersASeeks: string[] }> = [];
    for (let i = 0; i < profiles.length; i++) {
      for (let j = i + 1; j < profiles.length; j++) {
        const a = profiles[i], b = profiles[j];
        const aOffers = new Set(a.offerings?.tags ?? []);
        const bSeeks = new Set(b.seeking?.tags ?? []);
        const bOffers = new Set(b.offerings?.tags ?? []);
        const aSeeks = new Set(a.seeking?.tags ?? []);
        const aOffersBSeeks = [...aOffers].filter((t) => bSeeks.has(t));
        const bOffersASeeks = [...bOffers].filter((t) => aSeeks.has(t));
        if (aOffersBSeeks.length + bOffersASeeks.length > 0) {
          out.push({ a, b, aOffersBSeeks, bOffersASeeks });
        }
      }
    }
    return out;
  }, [profiles]);

  if (pairs.length === 0) return null;

  return (
    <section className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-900">
        Complementarity — where pinned partners could help each other
      </h3>
      <ul className="space-y-2 text-sm">
        {pairs.map(({ a, b, aOffersBSeeks, bOffersASeeks }) => (
          <li key={`${a.slug}|${b.slug}`} className="rounded bg-white p-2">
            {aOffersBSeeks.map((tag) => (
              <div key={`a-${tag}`} className="mb-1">
                <strong>{a.name}</strong> offers <Pill>{tag}</Pill>
                {" → "}<strong>{b.name}</strong> is seeking it
              </div>
            ))}
            {bOffersASeeks.map((tag) => (
              <div key={`b-${tag}`} className="mb-1">
                <strong>{b.name}</strong> offers <Pill>{tag}</Pill>
                {" → "}<strong>{a.name}</strong> is seeking it
              </div>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      {children}
    </span>
  );
}
