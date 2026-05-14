import { useEffect, useMemo, useState } from "react";
import { useCanvasStore } from "./lib/store";
import type { CanvasData } from "./lib/types";
import type { Profile } from "../types";

interface Props { data: CanvasData }

const PANE = "w-[360px]";
const COLLAPSED_MATCHES = 3;
const COLLAPSED_TEXT_CHARS = 240;

export function RightPane({ data }: Props) {
  const selectedNode = useCanvasStore((s) => s.selectedNode);
  const setSelectedNode = useCanvasStore.getState().setSelectedNode;
  const [showAllMatches, setShowAllMatches] = useState(false);
  useEffect(() => setShowAllMatches(false), [selectedNode]);

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
      <aside className={`${PANE} border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400`}>
        Nothing selected — click a node on the canvas.
      </aside>
    );
  }

  if (selectedNode.startsWith("partner:")) {
    const slug = selectedNode.slice("partner:".length);
    const profile = profileBySlug.get(slug);
    if (!profile) {
      return (
        <aside className={`${PANE} border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-300`}>
          <p className="font-medium text-neutral-100">Partner not found</p>
          <p className="mt-2 text-xs text-neutral-400">
            We don't have a partner with slug{" "}
            <code className="rounded bg-neutral-800 px-1 text-pink-300">{slug}</code>.
            Pick one from the canvas.
          </p>
        </aside>
      );
    }
    return (
      <PartnerCard
        key={slug}
        profile={profile}
        conceptIds={data.profileConcepts[slug] ?? []}
        matches={data.matches.filter((m) => m.from === slug).sort((a, b) => b.score - a.score).slice(0, 12)}
        conceptById={conceptById}
        profileBySlug={profileBySlug}
        showAllMatches={showAllMatches}
        setShowAllMatches={setShowAllMatches}
        setSelectedNode={setSelectedNode}
      />
    );
  }

  if (selectedNode.startsWith("concept:")) {
    const id = selectedNode.slice("concept:".length);
    const c = conceptById.get(id);
    if (!c) return null;
    const partners = Object.entries(data.profileConcepts)
      .filter(([, ids]) => ids.includes(id))
      .map(([s]) => profileBySlug.get(s))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    return (
      <aside className={`flex ${PANE} flex-col gap-3 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-200`}>
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

interface PartnerCardProps {
  profile: Profile;
  conceptIds: string[];
  matches: CanvasData["matches"];
  conceptById: Map<string, CanvasData["concepts"][number]>;
  profileBySlug: Map<string, Profile>;
  showAllMatches: boolean;
  setShowAllMatches: (fn: (v: boolean) => boolean) => void;
  setSelectedNode: (id: string | null) => void;
}

function PartnerCard({
  profile, conceptIds, matches, conceptById, profileBySlug,
  showAllMatches, setShowAllMatches, setSelectedNode,
}: PartnerCardProps) {
  return (
    <aside className={`flex ${PANE} flex-col gap-4 overflow-y-auto border-l border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-200`}>
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold leading-tight text-neutral-100">{profile.name}</h2>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-400">
          {profile.affiliation && <span>{profile.affiliation}</span>}
          {profile.orgSize && <span className="text-neutral-600">·</span>}
          {profile.orgSize && <span>{profile.orgSize}</span>}
        </div>
        {profile.website && (
          <a
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 truncate text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
            title={profile.website}
          >
            {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        )}
      </header>

      {profile.introduction && (
        <Section title="Introduction">
          <CollapsibleText text={profile.introduction} />
        </Section>
      )}

      {conceptIds.length > 0 && (
        <Section title={`Concepts (${conceptIds.length})`}>
          <ul className="flex flex-wrap gap-1">
            {conceptIds.map((id) => {
              const c = conceptById.get(id);
              if (!c) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(`concept:${id}`)}
                    className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-200 hover:border-pink-500 hover:text-pink-200"
                  >
                    {c.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {profile.challengeAreas.length > 0 && (
        <Section title={`Challenge areas (${profile.challengeAreas.length})`}>
          <ul className="flex flex-wrap gap-1">
            {profile.challengeAreas.map((c) => (
              <li
                key={c}
                className="rounded border border-cyan-900/60 bg-cyan-900/20 px-2 py-0.5 text-[11px] text-cyan-200"
              >
                {c}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {profile.offerings && (profile.offerings.tags.length > 0 || profile.offerings.text) && (
        <Section title="Offerings">
          {profile.offerings.tags.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1">
              {profile.offerings.tags.map((t) => (
                <li
                  key={t}
                  className="rounded border border-emerald-900/60 bg-emerald-900/20 px-2 py-0.5 text-[11px] text-emerald-200"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}
          {profile.offerings.text && <CollapsibleText text={profile.offerings.text} />}
        </Section>
      )}

      {profile.seeking && (profile.seeking.tags.length > 0 || profile.seeking.text) && (
        <Section title="Seeking">
          {profile.seeking.tags.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1">
              {profile.seeking.tags.map((t) => (
                <li
                  key={t}
                  className="rounded border border-pink-900/60 bg-pink-900/20 px-2 py-0.5 text-[11px] text-pink-200"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}
          {profile.seeking.text && <CollapsibleText text={profile.seeking.text} />}
        </Section>
      )}

      {profile.partnerTypeSeeking.length > 0 && (
        <Section title="Partner types sought">
          <ul className="flex flex-wrap gap-1">
            {profile.partnerTypeSeeking.map((t) => (
              <li
                key={t}
                className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-200"
              >
                {t}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {profile.projectIdeaSummary && (
        <Section title="Project idea">
          <CollapsibleText text={profile.projectIdeaSummary} />
        </Section>
      )}

      {matches.length > 0 && (
        <Section title={`Top matches (${matches.length})`}>
          <p className="mb-2 text-[11px] text-neutral-500">
            Score 0.50–1.00. Higher is better. Reciprocal matches are marked
            with <span className="text-pink-400">⇄</span> — both partners
            satisfy each other's seek.
          </p>
          <ul className="flex flex-col gap-2">
            {matches
              .slice(0, showAllMatches ? matches.length : COLLAPSED_MATCHES)
              .map((m) => {
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
                      <span className="ml-auto text-xs text-neutral-400">{m.score.toFixed(2)}</span>
                    </button>
                    <p className="mt-1 text-xs text-neutral-300">{m.rationale}</p>
                  </li>
                );
              })}
          </ul>
          {matches.length > COLLAPSED_MATCHES && (
            <button
              type="button"
              onClick={() => setShowAllMatches((v) => !v)}
              className="mt-2 w-full rounded border border-neutral-800 py-1 text-[11px] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
            >
              {showAllMatches ? `Show top ${COLLAPSED_MATCHES} only` : `Show ${matches.length - COLLAPSED_MATCHES} more`}
            </button>
          )}
        </Section>
      )}

      {profile.relevantProjects && (
        <Section title="Relevant projects">
          <CollapsibleText text={profile.relevantProjects} />
        </Section>
      )}

      {profile.relevantPublications && (
        <Section title="Relevant publications">
          <CollapsibleText text={profile.relevantPublications} />
        </Section>
      )}

      <footer className="mt-2 border-t border-neutral-800 pt-3 text-[11px] text-neutral-500">
        {profile.rfaNumber && <div>RFA {profile.rfaNumber}</div>}
        {profile.rawHtmlPath && (
          <a
            href={`/${profile.rawHtmlPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 hover:underline"
          >
            View original profile page →
          </a>
        )}
      </footer>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-400">{title}</h3>
      {children}
    </section>
  );
}

function CollapsibleText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = text.trim();
  if (trimmed.length <= COLLAPSED_TEXT_CHARS) {
    return <p className="whitespace-pre-line text-xs leading-relaxed text-neutral-300">{trimmed}</p>;
  }
  return (
    <>
      <p className="whitespace-pre-line text-xs leading-relaxed text-neutral-300">
        {expanded ? trimmed : trimmed.slice(0, COLLAPSED_TEXT_CHARS).trimEnd() + "…"}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 text-[11px] text-cyan-400 hover:text-cyan-300"
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </>
  );
}
