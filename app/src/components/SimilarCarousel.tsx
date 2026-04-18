import { Link } from "react-router-dom";
import type { Profile } from "../types";

export default function SimilarCarousel({
  profiles,
}: {
  profiles: Profile[];
}) {
  if (profiles.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        More like this
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {profiles.map((p) => (
          <Link
            key={p.slug}
            to={`/profile/${p.slug}`}
            className="w-56 shrink-0 rounded-md border border-slate-200 bg-white p-3 hover:border-slate-400"
          >
            <div className="text-sm font-medium">{p.name}</div>
            <div className="text-xs text-slate-500">{p.affiliation}</div>
            <div className="mt-2 line-clamp-3 text-xs text-slate-600">
              {p.introduction}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
