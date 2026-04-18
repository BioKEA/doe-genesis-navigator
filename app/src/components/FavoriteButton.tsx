import { Star } from "lucide-react";
import { toggleFavorite, useFavorites } from "../lib/storage";

export default function FavoriteButton({ slug }: { slug: string }) {
  const favorites = useFavorites();
  const on = favorites.includes(slug);
  return (
    <button
      type="button"
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      className="rounded p-1 hover:bg-slate-100"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(slug);
      }}
    >
      <Star
        size={16}
        className={on ? "fill-amber-400 stroke-amber-500" : "stroke-slate-400"}
      />
    </button>
  );
}
