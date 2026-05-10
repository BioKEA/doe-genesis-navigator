import { Columns } from "lucide-react";
import { addCompare, removeCompare, useCompare } from "../lib/storage";

export default function CompareButton({ slug }: { slug: string }) {
  const compare = useCompare();
  const on = compare.includes(slug);
  return (
    <button
      type="button"
      aria-label={on ? "Remove from compare" : "Add to compare"}
      className="rounded p-1 hover:bg-neutral-800"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (on) removeCompare(slug);
        else if (!addCompare(slug)) alert("Compare is full (5 max).");
      }}
    >
      <Columns
        size={16}
        className={on ? "stroke-cyan-400" : "stroke-neutral-500"}
      />
    </button>
  );
}
