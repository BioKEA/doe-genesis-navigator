import { Link } from "react-router-dom";
import type { Profile } from "../types";
import TagChip from "./TagChip";
import FavoriteButton from "./FavoriteButton";
import CompareButton from "./CompareButton";

function trunc(s: string | undefined, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

export default function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <Link
      to={`/profile/${profile.slug}`}
      className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{profile.name}</div>
          <div className="text-xs text-slate-500">
            {[profile.affiliation, profile.orgSize].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="flex gap-1">
          <FavoriteButton slug={profile.slug} />
          <CompareButton slug={profile.slug} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {profile.challengeAreas.slice(0, 3).map((c) => (
          <TagChip key={c} tone="challenge">{c}</TagChip>
        ))}
        {profile.challengeAreas.length > 3 && (
          <span className="text-xs text-slate-400">
            +{profile.challengeAreas.length - 3}
          </span>
        )}
      </div>
      {profile.offerings?.text && (
        <div className="text-xs text-slate-600">
          <span className="font-medium text-slate-800">Offers:</span>{" "}
          {trunc(profile.offerings.text, 140)}
        </div>
      )}
      {profile.seeking?.text && (
        <div className="text-xs text-slate-600">
          <span className="font-medium text-slate-800">Seeks:</span>{" "}
          {trunc(profile.seeking.text, 140)}
        </div>
      )}
    </Link>
  );
}
