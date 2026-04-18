import { Link } from "react-router-dom";
import type { Profile } from "../types";
import FavoriteButton from "./FavoriteButton";
import CompareButton from "./CompareButton";

export default function ProfileTable({ profiles }: { profiles: Profile[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Affiliation</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Challenges</th>
            <th className="px-3 py-2">Offers</th>
            <th className="px-3 py-2">Seeks</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.slug} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link to={`/profile/${p.slug}`} className="font-medium text-sky-700 hover:underline">
                  {p.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-600">{p.affiliation}</td>
              <td className="px-3 py-2 text-slate-600">{p.orgSize}</td>
              <td className="px-3 py-2 text-slate-600">
                {p.challengeAreas.slice(0, 2).join(", ")}
                {p.challengeAreas.length > 2 && ` +${p.challengeAreas.length - 2}`}
              </td>
              <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={p.offerings?.text}>
                {p.offerings?.text?.slice(0, 80)}
              </td>
              <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={p.seeking?.text}>
                {p.seeking?.text?.slice(0, 80)}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <FavoriteButton slug={p.slug} />
                  <CompareButton slug={p.slug} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
