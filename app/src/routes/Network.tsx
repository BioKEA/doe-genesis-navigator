import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { loadData } from "../data";
import { findMatches, type Match } from "../lib/match";
import { affiliationColor } from "../lib/affiliations";
import FavoriteButton from "../components/FavoriteButton";
import CompareButton from "../components/CompareButton";
import type { Profile } from "../types";

export default function Matchmaker() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  const [params, setParams] = useSearchParams();
  const focusSlug = params.get("focus");

  useEffect(() => { loadData().then(setBundle); }, []);

  const byslug = useMemo(() => {
    if (!bundle) return new Map<string, Profile>();
    return new Map(bundle.profiles.map((p) => [p.slug, p]));
  }, [bundle]);

  const focus = focusSlug ? byslug.get(focusSlug) ?? null : null;

  const matches = useMemo(() => {
    if (!focus || !bundle) return [];
    return findMatches(focus, bundle.profiles, 25);
  }, [focus, bundle]);

  const setFocus = (slug: string | null) => {
    const next = new URLSearchParams(params);
    if (slug) next.set("focus", slug);
    else next.delete("focus");
    setParams(next, { replace: true });
  };

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="whitespace-nowrap text-lg font-semibold">Find partners for</h2>
          <div className="flex-1 max-w-xl">
            <FocusPicker
              profiles={bundle.profiles}
              focus={focus}
              onPick={(p) => setFocus(p.slug)}
              onClear={() => setFocus(null)}
            />
          </div>
          {focus && (
            <div className="text-sm text-slate-600">
              {matches.length} candidate partners ranked by fit
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {!focus ? <EmptyState profiles={bundle.profiles} onPick={(p) => setFocus(p.slug)} />
                 : <Results focus={focus} matches={matches} onRefocus={(p) => setFocus(p.slug)} />}
      </div>
    </div>
  );
}

// ---- Focus picker (search-as-you-type combobox) ----

function FocusPicker({
  profiles, focus, onPick, onClear,
}: {
  profiles: Profile[];
  focus: Profile | null;
  onPick: (p: Profile) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return profiles
      .filter((p) => p.name.toLowerCase().includes(needle))
      .slice(0, 10);
  }, [profiles, q]);

  if (focus) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: affiliationColor(focus.affiliation) }}
        />
        <span className="font-medium">{focus.name}</span>
        <span className="text-xs text-slate-500">· {focus.affiliation}</span>
        <button
          type="button"
          onClick={() => { onClear(); setQ(""); }}
          aria-label="Clear focus"
          className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5">
        <Search size={16} className="text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Type a partner name to start…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {suggestions.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(p); setQ(""); setOpen(false); }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span
                  className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: affiliationColor(p.affiliation) }}
                />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.affiliation}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Empty state ----

function EmptyState({ profiles, onPick }: { profiles: Profile[]; onPick: (p: Profile) => void }) {
  // Suggest a handful of partners with the richest profiles (most challenge areas
  // plus offerings and seeking tags) to give the user a starting point.
  const suggestions = useMemo(() => {
    const score = (p: Profile) =>
      p.challengeAreas.length +
      (p.offerings?.tags.length ?? 0) +
      (p.seeking?.tags.length ?? 0);
    return [...profiles].sort((a, b) => score(b) - score(a)).slice(0, 8);
  }, [profiles]);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h2 className="mb-2 text-xl font-semibold text-slate-900">Partner matchmaker</h2>
      <p className="mb-6 text-sm text-slate-600 leading-relaxed">
        Pick a partner above. Matchmaker ranks all other participants by partnership fit:
        who can provide what your partner is seeking, who is asking for what your partner
        offers, and who shares their science and technology challenge areas.
      </p>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Start with one of these
      </h3>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((p) => (
          <li key={p.slug}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="flex w-full items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-left hover:border-slate-400"
            >
              <span
                className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: affiliationColor(p.affiliation) }}
              />
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-slate-500">{p.affiliation}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Results pane ----

function Results({
  focus, matches, onRefocus,
}: {
  focus: Profile;
  matches: Match[];
  onRefocus: (p: Profile) => void;
}) {
  return (
    <div className="grid h-full grid-cols-[320px_1fr] overflow-hidden">
      <FocusPanel focus={focus} />
      <MatchesList matches={matches} onRefocus={onRefocus} />
    </div>
  );
}

function FocusPanel({ focus }: { focus: Profile }) {
  return (
    <aside className="overflow-y-auto border-r border-slate-200 bg-white p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Focal partner
      </div>
      <div className="mb-4">
        <Link to={`/profile/${focus.slug}`} className="text-lg font-semibold text-sky-700 hover:underline">
          {focus.name}
        </Link>
        <div className="text-xs text-slate-500">
          {[focus.affiliation, focus.orgType, focus.orgSize].filter(Boolean).join(" · ")}
        </div>
      </div>

      {focus.challengeAreas.length > 0 && (
        <Section label="Challenge areas">
          <ChipRow items={focus.challengeAreas} tone="challenge" />
        </Section>
      )}
      {focus.offerings?.tags.length ? (
        <Section label="Offers">
          <ChipRow items={focus.offerings.tags} tone="offers" />
        </Section>
      ) : null}
      {focus.seeking?.tags.length ? (
        <Section label="Seeking">
          <ChipRow items={focus.seeking.tags} tone="seeking" />
        </Section>
      ) : null}
      {focus.partnerTypeSeeking.length > 0 && (
        <Section label="Wants partner types">
          <ChipRow items={focus.partnerTypeSeeking} tone="partner" />
        </Section>
      )}
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </div>
  );
}

const TONES = {
  challenge: "bg-indigo-100 text-indigo-800",
  offers: "bg-emerald-100 text-emerald-800",
  seeking: "bg-sky-100 text-sky-800",
  partner: "bg-amber-100 text-amber-800",
};

function ChipRow({ items, tone }: { items: string[]; tone: keyof typeof TONES }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((x) => (
        <span key={x} className={`rounded-full px-2 py-0.5 text-[11px] ${TONES[tone]}`}>{x}</span>
      ))}
    </div>
  );
}

function MatchesList({ matches, onRefocus }: { matches: Match[]; onRefocus: (p: Profile) => void }) {
  if (matches.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        No complementary or overlapping partners found.
      </div>
    );
  }
  const maxScore = Math.max(...matches.map((m) => m.score));
  return (
    <div className="overflow-y-auto p-4">
      <ul className="space-y-3">
        {matches.map((m, i) => (
          <MatchCard
            key={m.profile.slug}
            rank={i + 1}
            match={m}
            maxScore={maxScore}
            onRefocus={onRefocus}
          />
        ))}
      </ul>
    </div>
  );
}

function MatchCard({
  rank, match, maxScore, onRefocus,
}: {
  rank: number;
  match: Match;
  maxScore: number;
  onRefocus: (p: Profile) => void;
}) {
  const p = match.profile;
  const pct = Math.round((match.score / maxScore) * 100);
  return (
    <li className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold text-slate-400">#{rank}</span>
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: affiliationColor(p.affiliation) }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Link to={`/profile/${p.slug}`} className="font-semibold text-sky-700 hover:underline">
            {p.name}
          </Link>
          <div className="text-xs text-slate-500">
            {[p.affiliation, p.orgType, p.orgSize].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <FavoriteButton slug={p.slug} />
          <CompareButton slug={p.slug} />
          <button
            type="button"
            onClick={() => onRefocus(p)}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs hover:bg-slate-50"
            title="Pivot the matchmaker around this partner"
          >
            Focus
          </button>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="min-w-[3rem] text-right text-xs text-slate-500">score {match.score.toFixed(1)}</span>
      </div>

      <div className="space-y-1 text-xs">
        {match.theyOffer.length > 0 && (
          <div>
            <span className="font-medium text-emerald-700">They offer what you seek:</span>{" "}
            {match.theyOffer.map((t) => (
              <span key={t} className="ml-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{t}</span>
            ))}
          </div>
        )}
        {match.theySeek.length > 0 && (
          <div>
            <span className="font-medium text-sky-700">They seek what you offer:</span>{" "}
            {match.theySeek.map((t) => (
              <span key={t} className="ml-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">{t}</span>
            ))}
          </div>
        )}
        {match.sharedChallenges.length > 0 && (
          <div>
            <span className="font-medium text-indigo-700">Shared challenges ({match.sharedChallenges.length}):</span>{" "}
            {match.sharedChallenges.map((t) => (
              <span key={t} className="ml-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">{t}</span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
