import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { getFavorites, toggleFavorite } from "../lib/storage";

export default function FavoriteButton({ slug }: { slug: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(getFavorites().includes(slug)); }, [slug]);
  return (
    <button
      type="button"
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      className="rounded p-1 hover:bg-slate-100"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOn(toggleFavorite(slug));
      }}
    >
      <Star
        size={16}
        className={on ? "fill-amber-400 stroke-amber-500" : "stroke-slate-400"}
      />
    </button>
  );
}
