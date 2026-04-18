import { Columns } from "lucide-react";
import { useEffect, useState } from "react";
import { addCompare, getCompare, removeCompare } from "../lib/storage";

export default function CompareButton({ slug }: { slug: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(getCompare().includes(slug)); }, [slug]);
  return (
    <button
      type="button"
      aria-label={on ? "Remove from compare" : "Add to compare"}
      className="rounded p-1 hover:bg-slate-100"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (on) {
          removeCompare(slug);
          setOn(false);
        } else {
          const ok = addCompare(slug);
          if (!ok) alert("Compare is full (5 max).");
          else setOn(true);
        }
      }}
    >
      <Columns
        size={16}
        className={on ? "stroke-sky-600" : "stroke-slate-400"}
      />
    </button>
  );
}
