import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadData } from "../data";
import TagChip from "../components/TagChip";
import FavoriteButton from "../components/FavoriteButton";
import CompareButton from "../components/CompareButton";
import SimilarCarousel from "../components/SimilarCarousel";
import type { Profile } from "../types";

export default function ProfileDetail() {
  const { slug } = useParams();
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof loadData>> | null>(null);
  useEffect(() => { loadData().then(setBundle); }, []);

  const bySlug = useMemo(() => {
    if (!bundle) return new Map<string, Profile>();
    return new Map(bundle.profiles.map((p) => [p.slug, p]));
  }, [bundle]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading…</div>;
  const p = slug ? bySlug.get(slug) : undefined;
  if (!p) return (
    <div className="p-8">
      <p className="mb-2 text-slate-600">Profile not found: {slug}</p>
      <Link to="/" className="text-sky-700 underline">Back to browse</Link>
    </div>
  );

  const similar = (bundle.network.neighbors[p.slug] ?? [])
    .map((s) => bySlug.get(s))
    .filter((x): x is Profile => !!x);

  return (
    <article className="mx-auto max-w-3xl p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{p.kind}</div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <div className="text-sm text-slate-600">
            {[p.affiliation, p.orgType, p.orgSize].filter(Boolean).join(" · ")}
          </div>
          {p.website && (
            <a
              href={p.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-sky-700 underline"
            >
              {p.website}
            </a>
          )}
        </div>
        <div className="flex gap-1">
          <FavoriteButton slug={p.slug} />
          <CompareButton slug={p.slug} />
        </div>
      </header>

      {p.introduction && (
        <Section title="Introduction">
          <p className="whitespace-pre-line">{p.introduction}</p>
        </Section>
      )}

      {p.challengeAreas.length > 0 && (
        <Section title="Challenge areas">
          <div className="flex flex-wrap gap-1">
            {p.challengeAreas.map((c) => <TagChip key={c} tone="challenge">{c}</TagChip>)}
          </div>
        </Section>
      )}

      {p.offerings?.text && (
        <Section title="Offerings">
          <p className="whitespace-pre-line">{p.offerings.text}</p>
        </Section>
      )}

      {p.seeking?.text && (
        <Section title="Seeking">
          <p className="whitespace-pre-line">{p.seeking.text}</p>
        </Section>
      )}

      {p.partnerTypeSeeking.length > 0 && (
        <Section title="Partner type seeking">
          <div className="flex flex-wrap gap-1">
            {p.partnerTypeSeeking.map((t) => <TagChip key={t} tone="partner">{t}</TagChip>)}
          </div>
        </Section>
      )}

      {p.projectIdeaSummary && (
        <Section title="Project idea">
          <p className="whitespace-pre-line">{p.projectIdeaSummary}</p>
        </Section>
      )}

      {p.relevantProjects && (
        <Section title="Relevant projects">
          <p className="whitespace-pre-line">{p.relevantProjects}</p>
        </Section>
      )}

      {p.relevantPublications && (
        <Section title="Relevant publications">
          <p className="whitespace-pre-line">{p.relevantPublications}</p>
        </Section>
      )}

      <SimilarCarousel profiles={similar} />

      <div className="mt-6 text-xs text-slate-400">
        <a
          href={`/${p.rawHtmlPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          View original scraped HTML
        </a>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="text-sm text-slate-800">{children}</div>
    </section>
  );
}
