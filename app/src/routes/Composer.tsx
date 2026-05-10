import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, Download, Lock, Plus, Replace, X } from "lucide-react";
import { loadData } from "../data";
import {
  buildVariants,
  scoreTeam,
  analyzeContributions,
  findMarginalAddition,
  suggestSwap,
  VARIANT_META,
  type TeamTarget,
  type Team,
  type VariantId,
  type MemberContribution,
} from "../lib/team-builder";
import { buildCoverageMatrix } from "../lib/coverage";
import { generateNarrative, generateOutreach } from "../lib/narrative";
import { PHASES, DEADLINES, SECTOR_LABELS, sectorFor, type PhaseId, SECTORS } from "../lib/rfa";
import { affiliationColor } from "../lib/affiliations";
import CoverageMatrixView from "../components/CoverageMatrix";
import type { Match, Profile } from "../types";

// ---- URL state helpers ----

function parseList(v: string | null): string[] {
  if (!v) return [];
  return v.split(",").map(decodeURIComponent).filter(Boolean);
}

function serializeList(items: string[]): string {
  return items.map(encodeURIComponent).join(",");
}

export default function Composer() {
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => { loadData().then(setBundle); }, []);
  useEffect(() => {
    fetch("/data/matches.json")
      .then((r) => (r.ok ? r.json() : []) as Promise<Match[]>)
      .then(setMatches)
      .catch(() => setMatches([]));
  }, []);
  const [params, setParams] = useSearchParams();

  // URL-backed controls (so a configured composer is shareable)
  const selectedChallenges = parseList(params.get("c"));
  const selectedOfferings = parseList(params.get("o"));
  const phaseId = (params.get("p") as PhaseId) ?? "phase-2";
  const leadSlug = params.get("lead") ?? "";
  const lockedSlugs = parseList(params.get("lock"));

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };
  const setList = (key: string, values: string[]) =>
    setParam(key, values.length > 0 ? serializeList(values) : null);

  const [selectedVariant, setSelectedVariant] = useState<VariantId>("coverage");
  const [liveTeam, setLiveTeam] = useState<Profile[] | null>(null);
  const [swapSlot, setSwapSlot] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [narrativeOpen, setNarrativeOpen] = useState(false);

  // Derive available challenges/offerings from the actual data
  const challengeOptions = useMemo(() => {
    if (!bundle) return [];
    const counts = new Map<string, number>();
    for (const p of bundle.profiles) for (const c of p.challengeAreas) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [bundle]);

  const offeringOptions = useMemo(() => {
    if (!bundle) return [];
    const counts = new Map<string, number>();
    for (const p of bundle.profiles) for (const t of p.offerings?.tags ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [bundle]);

  const phase = PHASES.find((ph) => ph.id === phaseId) ?? PHASES[1];

  const target: TeamTarget = useMemo(() => ({
    challenges: selectedChallenges,
    requiredOfferings: selectedOfferings,
    minSize: phase.minSize,
    maxSize: phase.maxSize,
    targetSize: phase.defaultSize,
    requireSectors: ["academic", "industry", "natlab"],
    lockedSlugs: [...(leadSlug ? [leadSlug] : []), ...lockedSlugs],
  }), [selectedChallenges, selectedOfferings, phase, leadSlug, lockedSlugs]);

  // Generated teams (memoized on inputs)
  const variantsReady = bundle && selectedChallenges.length > 0;
  const variants = useMemo<Team[] | null>(() => {
    if (!variantsReady) return null;
    return buildVariants(bundle!.profiles, target);
  }, [bundle, target, variantsReady]);

  // Selected team (possibly edited live)
  const baseTeam = variants?.find((v) => v.variantId === selectedVariant) ?? variants?.[0];
  const activeTeamMembers = liveTeam ?? baseTeam?.members ?? [];
  const activeTeam: Team | null = baseTeam
    ? {
        members: activeTeamMembers,
        score: scoreTeam(activeTeamMembers, target),
        variantId: selectedVariant,
        lockedSlugs: new Set(target.lockedSlugs),
      }
    : null;

  const coverage = useMemo(() => {
    if (!activeTeam) return null;
    return buildCoverageMatrix(
      activeTeam.members,
      selectedChallenges,
      selectedOfferings,
      ["academic", "industry", "natlab"],
    );
  }, [activeTeam, selectedChallenges, selectedOfferings]);

  const contributions = useMemo<MemberContribution[]>(() => {
    if (!activeTeam) return [];
    return analyzeContributions(activeTeam.members, target);
  }, [activeTeam, target]);

  const marginalAddition = useMemo(() => {
    if (!activeTeam || !bundle) return null;
    return findMarginalAddition(activeTeam.members, target, bundle.profiles);
  }, [activeTeam, target, bundle]);

  // When user picks a different variant or edits inputs, reset the live team
  useEffect(() => { setLiveTeam(null); setSwapSlot(null); }, [selectedVariant, selectedChallenges.join(","), selectedOfferings.join(","), phaseId, leadSlug, lockedSlugs.join(",")]);

  if (!bundle) return <div className="p-8 text-neutral-400">Loading…</div>;

  const toggleChallenge = (c: string) => {
    setList("c", selectedChallenges.includes(c)
      ? selectedChallenges.filter((x) => x !== c)
      : [...selectedChallenges, c]);
  };
  const toggleOffering = (o: string) => {
    setList("o", selectedOfferings.includes(o)
      ? selectedOfferings.filter((x) => x !== o)
      : [...selectedOfferings, o]);
  };
  const setPhase = (id: PhaseId) => setParam("p", id);
  const setLead = (slug: string) => setParam("lead", slug || null);
  const toggleLock = (slug: string) => {
    setList("lock", lockedSlugs.includes(slug)
      ? lockedSlugs.filter((x) => x !== slug)
      : [...lockedSlugs, slug]);
  };

  const swapMember = (slotIndex: number, newMember: Profile) => {
    const next = [...activeTeamMembers];
    next[slotIndex] = newMember;
    setLiveTeam(next);
    setSwapSlot(null);
  };

  const removeMember = (slotIndex: number) => {
    const next = activeTeamMembers.filter((_, i) => i !== slotIndex);
    setLiveTeam(next);
  };

  const addMember = (p: Profile) => {
    setLiveTeam([...activeTeamMembers, p]);
    setShowAddDialog(false);
  };

  const addTopMarginal = () => {
    if (marginalAddition) setLiveTeam([...activeTeamMembers, marginalAddition.candidate]);
  };

  // -----------------------
  // Render
  // -----------------------

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <SetupBar
        phaseId={phaseId}
        onPhase={setPhase}
        challengeOptions={challengeOptions}
        selectedChallenges={selectedChallenges}
        onToggleChallenge={toggleChallenge}
        offeringOptions={offeringOptions}
        selectedOfferings={selectedOfferings}
        onToggleOffering={toggleOffering}
        leadSlug={leadSlug}
        onLead={setLead}
        profiles={bundle.profiles}
      />

      {selectedChallenges.length === 0 ? (
        <EmptyState challengeOptions={challengeOptions} onToggleChallenge={toggleChallenge} />
      ) : !variants ? (
        <div className="p-8 text-neutral-400">Computing consortium variants…</div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-neutral-800 bg-neutral-900">
            <VariantRail
              variants={variants}
              selected={selectedVariant}
              onSelect={setSelectedVariant}
            />
          </aside>

          <main className="flex-1 overflow-y-auto">
            {activeTeam && coverage && (
              <TeamWorkspace
                team={activeTeam}
                contributions={contributions}
                coverage={coverage}
                marginalAddition={marginalAddition}
                leadSlug={leadSlug}
                lockedSlugs={new Set(target.lockedSlugs)}
                onSwapSlot={(i) => setSwapSlot(i)}
                onRemoveSlot={removeMember}
                onToggleLock={toggleLock}
                onAddMember={() => setShowAddDialog(true)}
                onAddTopMarginal={addTopMarginal}
                onOpenNarrative={() => setNarrativeOpen(true)}
                onReset={() => setLiveTeam(null)}
                edited={liveTeam !== null}
                matches={matches}
              />
            )}
          </main>

          {swapSlot !== null && activeTeam && (
            <SwapDialog
              team={activeTeam.members}
              target={target}
              slotIndex={swapSlot}
              allProfiles={bundle.profiles}
              onPick={(p) => swapMember(swapSlot, p)}
              onClose={() => setSwapSlot(null)}
            />
          )}

          {showAddDialog && activeTeam && (
            <AddDialog
              team={activeTeam.members}
              target={target}
              allProfiles={bundle.profiles}
              onPick={addMember}
              onClose={() => setShowAddDialog(false)}
            />
          )}

          {narrativeOpen && activeTeam && coverage && (
            <NarrativeDialog
              team={activeTeam}
              coverage={coverage}
              target={{
                challenges: selectedChallenges,
                requiredOfferings: selectedOfferings,
                phaseId,
                leadSlug: leadSlug || undefined,
              }}
              allProfiles={bundle.profiles}
              leadSlug={leadSlug || undefined}
              onClose={() => setNarrativeOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---- Setup bar -------------------------------------------------------------

function SetupBar({
  phaseId, onPhase, challengeOptions, selectedChallenges, onToggleChallenge,
  offeringOptions, selectedOfferings, onToggleOffering, leadSlug, onLead, profiles,
}: {
  phaseId: PhaseId;
  onPhase: (id: PhaseId) => void;
  challengeOptions: [string, number][];
  selectedChallenges: string[];
  onToggleChallenge: (c: string) => void;
  offeringOptions: [string, number][];
  selectedOfferings: string[];
  onToggleOffering: (o: string) => void;
  leadSlug: string;
  onLead: (slug: string) => void;
  profiles: Profile[];
}) {
  const lead = profiles.find((p) => p.slug === leadSlug);
  return (
    <div className="border-b border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="mb-2 flex items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">Consortium Composer</h2>
          <div className="text-xs text-neutral-400">
            DOE Genesis Mission (DE-FOA-0003612) · Phase I + LOI due <b>{DEADLINES.phase1}</b> · Phase II full <b>{DEADLINES.phase2Full}</b>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={phaseId}
            onChange={(e) => onPhase(e.target.value as PhaseId)}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          >
            {PHASES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <LeadPicker leadSlug={leadSlug} profiles={profiles} onPick={onLead} />
          {lead && (
            <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200">
              lead: {lead.name}
              <button
                className="ml-1 text-neutral-500 hover:text-neutral-200"
                onClick={() => onLead("")}
                aria-label="Clear lead"
              >×</button>
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Dropdown
            label={`Challenges (${selectedChallenges.length})`}
            options={challengeOptions}
            selected={selectedChallenges}
            onToggle={onToggleChallenge}
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {selectedChallenges.map((c) => (
              <span key={c} className="rounded-full bg-cyan-900/40 px-2 py-0.5 text-[11px] text-cyan-200">
                {c}
                <button
                  className="ml-1 text-cyan-400 hover:text-cyan-200"
                  onClick={() => onToggleChallenge(c)}
                  aria-label="Remove challenge"
                >×</button>
              </span>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <Dropdown
            label={`Required offerings (${selectedOfferings.length})`}
            options={offeringOptions}
            selected={selectedOfferings}
            onToggle={onToggleOffering}
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {selectedOfferings.map((o) => (
              <span key={o} className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[11px] text-emerald-200">
                {o}
                <button
                  className="ml-1 text-emerald-400 hover:text-emerald-200"
                  onClick={() => onToggleOffering(o)}
                  aria-label="Remove offering"
                >×</button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dropdown({
  label, options, selected, onToggle,
}: {
  label: string;
  options: [string, number][];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selSet = new Set(selected);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm hover:bg-neutral-900"
      >
        <span>{label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900 shadow-lg">
          {options.map(([value, count]) => (
            <button
              key={value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onToggle(value)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-900 ${
                selSet.has(value) ? "bg-cyan-900/40" : ""
              }`}
            >
              <input type="checkbox" checked={selSet.has(value)} readOnly />
              <span className="flex-1 truncate">{value}</span>
              <span className="text-[11px] text-neutral-500">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadPicker({
  leadSlug, profiles, onPick,
}: {
  leadSlug: string;
  profiles: Profile[];
  onPick: (slug: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return profiles
      .filter((p) => p.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [profiles, q]);

  if (leadSlug) return null; // managed as a pill outside

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Pick team lead (optional)…"
        className="w-48 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute right-0 top-full z-20 mt-1 w-80 max-h-64 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900 shadow-lg">
          {suggestions.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(p.slug); setQ(""); setOpen(false); }}
                className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-neutral-900"
              >
                <span
                  className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: affiliationColor(p.affiliation) }}
                />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[10px] text-neutral-400">{p.affiliation}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- Variant rail ---------------------------------------------------------

function VariantRail({
  variants, selected, onSelect,
}: {
  variants: Team[];
  selected: VariantId;
  onSelect: (v: VariantId) => void;
}) {
  return (
    <div className="p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Proposed teams
      </div>
      <ul className="space-y-2">
        {variants.map((t) => {
          const meta = VARIANT_META[t.variantId!];
          const active = t.variantId === selected;
          return (
            <li key={t.variantId}>
              <button
                type="button"
                onClick={() => onSelect(t.variantId!)}
                className={`w-full rounded-md border p-3 text-left ${
                  active ? "border-slate-900 bg-slate-900 text-white"
                         : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
                }`}
              >
                <div className="text-sm font-semibold">{meta.label}</div>
                <div className={`text-[11px] ${active ? "text-neutral-500" : "text-neutral-400"}`}>
                  {meta.tagline}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className={`h-1.5 flex-1 overflow-hidden rounded-full ${active ? "bg-slate-700" : "bg-neutral-800"}`}>
                    <div
                      className={`h-full rounded-full ${active ? "bg-neutral-900" : "bg-slate-900"}`}
                      style={{ width: `${Math.min(100, (t.score.total / 10) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px]">{t.score.total.toFixed(1)}</span>
                </div>
                <div className={`mt-1 text-[10px] ${active ? "text-neutral-500" : "text-neutral-500"}`}>
                  {t.members.length} partners
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---- Team workspace (main pane) ------------------------------------------

function TeamWorkspace({
  team, contributions, coverage, marginalAddition, lockedSlugs, leadSlug,
  onSwapSlot, onRemoveSlot, onToggleLock, onAddMember, onAddTopMarginal, onOpenNarrative, onReset, edited,
  matches,
}: {
  team: Team;
  contributions: MemberContribution[];
  coverage: ReturnType<typeof buildCoverageMatrix>;
  marginalAddition: { candidate: Profile; delta: number } | null;
  lockedSlugs: Set<string>;
  leadSlug: string;
  onSwapSlot: (i: number) => void;
  onRemoveSlot: (i: number) => void;
  onToggleLock: (slug: string) => void;
  onAddMember: () => void;
  onAddTopMarginal: () => void;
  onOpenNarrative: () => void;
  onReset: () => void;
  edited: boolean;
  matches: Match[];
}) {
  const sectorsPresent = new Set(team.members.map((p) => sectorFor(p.affiliation)));
  const missingSectors = (["academic", "industry", "natlab"] as const).filter(s => !sectorsPresent.has(s));

  // Surface the LLM-scored offer→seek match rationales between this team's
  // members so the user can see WHY these partners complement each other.
  const teamSlugs = new Set(team.members.map((p) => p.slug));
  const memberByName = new Map(team.members.map((p) => [p.slug, p.name]));
  const internalMatches = matches
    .filter((m) => teamSlugs.has(m.from) && teamSlugs.has(m.to))
    .sort((a, b) => {
      if (a.reciprocal !== b.reciprocal) return a.reciprocal ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, 8);

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">Team</h3>
          <span className="text-xs text-neutral-400">{team.members.length} partners</span>
          <ScoreChip label="Challenge cov" value={team.score.challengeCoverage} />
          <ScoreChip label="Offering cov" value={team.score.offeringCoverage} />
          <ScoreChip label="Sector mix" value={team.score.sectorEntropy} />
          <ScoreChip label="Complement" value={team.score.internalComplementarity} />
          <div className="ml-auto flex items-center gap-2">
            {edited && (
              <button
                onClick={onReset}
                className="text-xs text-neutral-400 hover:underline"
              >
                Reset to suggested
              </button>
            )}
            <button
              onClick={onAddMember}
              className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-900"
            >
              <Plus size={12} /> Add member
            </button>
            <button
              onClick={onOpenNarrative}
              className="inline-flex items-center gap-1 rounded bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-700"
            >
              <Download size={12} /> Export proposal
            </button>
          </div>
        </div>

        {missingSectors.length > 0 && (
          <div className="mb-3 rounded-md bg-amber-900/30 px-3 py-2 text-xs text-amber-200">
            <b>Sector gap:</b> this team is missing {missingSectors.map((s) => SECTOR_LABELS[s]).join(", ")}.
            The RFA favors interdisciplinary consortiums — consider adding one.
          </div>
        )}

        <ul className="divide-y divide-slate-100 rounded-md border border-neutral-800">
          {team.members.map((p, i) => {
            const contrib = contributions.find((c) => c.profile.slug === p.slug);
            const isLead = p.slug === leadSlug;
            const locked = lockedSlugs.has(p.slug);
            return (
              <li key={p.slug} className="flex items-start gap-3 p-3">
                <span className="mt-1 shrink-0 text-xs font-semibold text-neutral-500">#{i + 1}</span>
                <span
                  className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: affiliationColor(p.affiliation) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={`/profile/${p.slug}`} className="font-semibold text-cyan-400 hover:underline">
                      {p.name}
                    </Link>
                    {isLead && <span className="rounded bg-amber-900/40 px-1.5 py-0 text-[10px] font-medium text-amber-300">LEAD</span>}
                    {locked && <span className="rounded bg-neutral-700 px-1.5 py-0 text-[10px] font-medium text-neutral-200">LOCKED</span>}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {[p.affiliation, p.orgSize].filter(Boolean).join(" · ")}
                  </div>
                  {contrib && (contrib.uniqueChallenges.length > 0 || contrib.uniqueOfferings.length > 0) && (
                    <div className="mt-1 space-y-0.5 text-[11px]">
                      {contrib.uniqueChallenges.length > 0 && (
                        <div>
                          <span className="font-medium text-cyan-300">Uniquely covers:</span>{" "}
                          {contrib.uniqueChallenges.map((c) => (
                            <span key={c} className="ml-1 inline-block rounded-full bg-cyan-900/40 px-2 py-0 text-cyan-200">{c}</span>
                          ))}
                        </div>
                      )}
                      {contrib.uniqueOfferings.length > 0 && (
                        <div>
                          <span className="font-medium text-emerald-300">Only provider of:</span>{" "}
                          {contrib.uniqueOfferings.map((t) => (
                            <span key={t} className="ml-1 inline-block rounded-full bg-emerald-900/40 px-2 py-0 text-emerald-200">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => onToggleLock(p.slug)}
                    className={`rounded p-1 ${locked ? "bg-neutral-700 text-neutral-200" : "text-neutral-500 hover:bg-neutral-800"}`}
                    title={locked ? "Unlock" : "Lock — keep this member in all regenerations"}
                    aria-label="Toggle lock"
                  >
                    <Lock size={12} />
                  </button>
                  <button
                    onClick={() => onSwapSlot(i)}
                    disabled={locked}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-800 disabled:opacity-30"
                    title="Swap"
                    aria-label="Swap member"
                  >
                    <Replace size={12} />
                  </button>
                  <button
                    onClick={() => onRemoveSlot(i)}
                    disabled={locked}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-800 disabled:opacity-30"
                    title="Remove"
                    aria-label="Remove member"
                  >
                    <X size={12} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {coverage.gaps.length > 0 && (
        <section className="rounded-md border border-red-800 bg-red-900/30 p-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-400">Gaps to address</h3>
          <ul className="space-y-1 text-xs">
            {coverage.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`shrink-0 rounded px-1.5 py-0 text-[10px] font-medium ${
                  g.severity === "critical" ? "bg-red-200 text-red-200" : "bg-amber-200 text-amber-200"
                }`}>
                  {g.severity.toUpperCase()}
                </span>
                <span className="text-neutral-100"><b>{g.label}</b> — {g.recommendation}</span>
              </li>
            ))}
          </ul>
          {marginalAddition && (
            <div className="mt-3 rounded-md border border-red-800 bg-neutral-900 p-2 text-xs">
              Best partner to add next:{" "}
              <Link to={`/profile/${marginalAddition.candidate.slug}`} className="font-semibold text-cyan-400 hover:underline">
                {marginalAddition.candidate.name}
              </Link>{" "}
              <span className="text-neutral-400">(+{marginalAddition.delta.toFixed(2)} team score)</span>
              <button
                onClick={onAddTopMarginal}
                className="ml-2 rounded bg-slate-900 px-2 py-0.5 text-[10px] text-white hover:bg-slate-700"
              >
                Add to team
              </button>
            </div>
          )}
        </section>
      )}

      {internalMatches.length > 0 && (
        <section className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-300">
            Why these partners fit together
          </h3>
          <p className="mb-3 text-[11px] text-neutral-500">
            LLM-scored offer→seek matches between the {team.members.length}{" "}
            partners on this team. Reciprocal pairs (⇄) satisfy each other in
            both directions.
          </p>
          <ul className="space-y-2">
            {internalMatches.map((m) => (
              <li
                key={`${m.from}->${m.to}`}
                className="rounded border border-neutral-800 bg-neutral-950 p-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-cyan-300">
                    {memberByName.get(m.from)}
                  </span>
                  <span className="text-neutral-500">→</span>
                  <span className="font-medium text-cyan-300">
                    {memberByName.get(m.to)}
                  </span>
                  {m.reciprocal && (
                    <span title="reciprocal" className="text-pink-400">⇄</span>
                  )}
                  <span className="ml-auto text-xs text-neutral-400">
                    {m.score.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-300">{m.rationale}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-300">Coverage matrix</h3>
        <CoverageMatrixView matrix={coverage} />
      </section>
    </div>
  );
}

function ScoreChip({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const tone =
    pct >= 80 ? "bg-emerald-900/40 text-emerald-200" :
    pct >= 50 ? "bg-amber-900/40 text-amber-300" :
                "bg-red-900/40 text-red-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] ${tone}`}>
      {label}: {pct}%
    </span>
  );
}

// ---- Empty state ---------------------------------------------------------

function EmptyState({
  challengeOptions, onToggleChallenge,
}: {
  challengeOptions: [string, number][];
  onToggleChallenge: (c: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h2 className="mb-2 text-xl font-semibold text-neutral-100">
        Assemble a consortium for the Genesis Mission
      </h2>
      <p className="mb-4 text-sm text-neutral-300 leading-relaxed">
        Pick one or more challenge areas below. Composer scores every
        combination of Genesis participants and proposes three distinct teams
        optimized for different proposal strategies — then hands you a coverage
        matrix, gap analysis, and narrative draft ready for your proposal.
      </p>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Select a challenge to start
      </h3>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {challengeOptions.slice(0, 12).map(([c, n]) => (
          <li key={c}>
            <button
              type="button"
              onClick={() => onToggleChallenge(c)}
              className="flex w-full items-start gap-2 rounded-md border border-neutral-800 bg-neutral-900 p-3 text-left hover:border-neutral-600"
            >
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
              <div className="flex-1">
                <div className="text-sm font-medium">{c}</div>
                <div className="text-[11px] text-neutral-400">{n} participants tagged</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- Swap dialog ---------------------------------------------------------

function SwapDialog({
  team, target, slotIndex, allProfiles, onPick, onClose,
}: {
  team: Profile[];
  target: TeamTarget;
  slotIndex: number;
  allProfiles: Profile[];
  onPick: (p: Profile) => void;
  onClose: () => void;
}) {
  const alts = useMemo(
    () => suggestSwap(team, target, slotIndex, allProfiles, 15),
    [team, target, slotIndex, allProfiles],
  );
  const current = team[slotIndex];
  return (
    <DialogShell title={`Swap: ${current?.name ?? ""}`} onClose={onClose}>
      <ul className="divide-y divide-slate-100">
        {alts.map(({ candidate, delta }) => (
          <li key={candidate.slug}>
            <button
              type="button"
              onClick={() => onPick(candidate)}
              className="flex w-full items-start gap-2 p-3 text-left hover:bg-neutral-900"
            >
              <span
                className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: affiliationColor(candidate.affiliation) }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{candidate.name}</div>
                <div className="text-xs text-neutral-400">{candidate.affiliation}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                delta > 0 ? "bg-emerald-900/40 text-emerald-200" :
                delta < 0 ? "bg-red-900/40 text-red-300" :
                            "bg-neutral-800 text-neutral-300"
              }`}>
                {delta > 0 ? "+" : ""}{delta.toFixed(2)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </DialogShell>
  );
}

function AddDialog({
  team, target, allProfiles, onPick, onClose,
}: {
  team: Profile[];
  target: TeamTarget;
  allProfiles: Profile[];
  onPick: (p: Profile) => void;
  onClose: () => void;
}) {
  // "Add" = swap into an empty slot. Use findMarginalAddition-like ranking:
  // rank by delta of team+candidate.
  const alts = useMemo(() => {
    const used = new Set(team.map((p) => p.slug));
    const currentScore = scoreTeam(team, target).total;
    return allProfiles
      .filter((p) => !used.has(p.slug))
      .map((c) => ({ candidate: c, delta: scoreTeam([...team, c], target).total - currentScore }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 15);
  }, [team, target, allProfiles]);
  return (
    <DialogShell title="Add a partner" onClose={onClose}>
      <ul className="divide-y divide-slate-100">
        {alts.map(({ candidate, delta }) => (
          <li key={candidate.slug}>
            <button
              type="button"
              onClick={() => onPick(candidate)}
              className="flex w-full items-start gap-2 p-3 text-left hover:bg-neutral-900"
            >
              <span
                className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: affiliationColor(candidate.affiliation) }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{candidate.name}</div>
                <div className="text-xs text-neutral-400">{candidate.affiliation}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                delta > 0 ? "bg-emerald-900/40 text-emerald-200" : "bg-neutral-800 text-neutral-300"
              }`}>
                {delta > 0 ? "+" : ""}{delta.toFixed(2)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </DialogShell>
  );
}

function DialogShell({ title, children, onClose }: {
  title: string; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-6" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-md bg-neutral-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-800">
            <X size={14} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ---- Narrative / export dialog ------------------------------------------

function NarrativeDialog({
  team, coverage, target, allProfiles, leadSlug, onClose,
}: {
  team: Team;
  coverage: ReturnType<typeof buildCoverageMatrix>;
  target: { challenges: string[]; requiredOfferings: string[]; phaseId: PhaseId; leadSlug?: string };
  allProfiles: Profile[];
  leadSlug?: string;
  onClose: () => void;
}) {
  const narrative = useMemo(
    () => generateNarrative(team, coverage, target, allProfiles),
    [team, coverage, target, allProfiles],
  );

  const lead = leadSlug ? team.members.find((p) => p.slug === leadSlug) : undefined;

  const [tab, setTab] = useState<"narrative" | "csv" | "outreach">("narrative");

  const download = (filename: string, mime: string, content: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const csv = useMemo(() => {
    const header = ["Name", "Affiliation", "Sector", "Org Type", "Org Size", "Website", "Challenge areas", "Offerings", "Seeking"];
    const rows = team.members.map((p) => [
      p.name,
      p.affiliation ?? "",
      SECTOR_LABELS[sectorFor(p.affiliation)],
      p.orgType ?? "",
      p.orgSize ?? "",
      p.website ?? "",
      p.challengeAreas.join("; "),
      (p.offerings?.tags ?? []).join("; "),
      (p.seeking?.tags ?? []).join("; "),
    ]);
    const esc = (s: string) => `"${String(s).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  }, [team]);

  const outreach = useMemo(() => {
    const nonLead = team.members.filter((p) => p.slug !== leadSlug);
    return nonLead.map((p) => ({
      target: p,
      text: generateOutreach(lead, p, target.challenges, target.requiredOfferings),
    }));
  }, [team, lead, leadSlug, target.challenges, target.requiredOfferings]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-md bg-neutral-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2">
          <h3 className="text-sm font-semibold">Proposal assets</h3>
          <nav className="flex gap-1">
            <TabBtn active={tab === "narrative"} onClick={() => setTab("narrative")}>Narrative draft</TabBtn>
            <TabBtn active={tab === "csv"} onClick={() => setTab("csv")}>Roster (CSV)</TabBtn>
            <TabBtn active={tab === "outreach"} onClick={() => setTab("outreach")}>Outreach ({outreach.length})</TabBtn>
          </nav>
          <button onClick={onClose} className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-800">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "narrative" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(narrative.markdown)}
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-900"
                >
                  Copy Markdown
                </button>
                <button
                  onClick={() => download("consortium-narrative.md", "text/markdown", narrative.markdown)}
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-900"
                >
                  Download .md
                </button>
                <button
                  onClick={() => download("consortium-narrative.txt", "text/plain", narrative.plaintext)}
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-900"
                >
                  Download .txt
                </button>
              </div>
              <pre className="whitespace-pre-wrap rounded-md border border-neutral-800 bg-neutral-900 p-4 font-mono text-[12px] leading-relaxed text-neutral-100">
                {narrative.markdown}
              </pre>
            </div>
          )}

          {tab === "csv" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => download("consortium-roster.csv", "text/csv", csv)}
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-900"
                >
                  Download .csv
                </button>
                <button
                  onClick={() => download("consortium-roster.json", "application/json", JSON.stringify(team.members, null, 2))}
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-900"
                >
                  Download .json
                </button>
              </div>
              <pre className="whitespace-pre overflow-x-auto rounded-md border border-neutral-800 bg-neutral-900 p-4 font-mono text-[11px] leading-relaxed text-neutral-100">
                {csv}
              </pre>
            </div>
          )}

          {tab === "outreach" && (
            <div className="space-y-4">
              <div className="text-xs text-neutral-400">
                Personalized email template for each non-lead member. Edit freely — these are starting drafts.
              </div>
              {outreach.map(({ target: p, text }) => (
                <details key={p.slug} className="rounded-md border border-neutral-800 bg-neutral-900">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-neutral-900">
                    To: {p.name} <span className="text-[11px] text-neutral-500">({p.affiliation})</span>
                  </summary>
                  <div className="border-t border-neutral-800 p-3">
                    <div className="mb-2 flex gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(text)}
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-900"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => download(`outreach-${p.slug}.txt`, "text/plain", text)}
                        className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-900"
                      >
                        Download .txt
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap rounded bg-neutral-900 p-3 font-mono text-[11px] text-neutral-100">{text}</pre>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs ${active ? "bg-slate-900 text-white" : "text-neutral-300 hover:bg-neutral-800"}`}
    >
      {children}
    </button>
  );
}

void SECTORS; // keep import if tree-shake complains
