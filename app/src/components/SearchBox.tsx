import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function SearchBox({ value, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if ((mod && e.key.toLowerCase() === "k") ||
          (e.key === "/" && document.activeElement?.tagName !== "INPUT")) {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === ref.current) {
        ref.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5">
      <Search size={16} className="text-slate-400" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search across 443 partners…"
        className="w-full bg-transparent text-sm outline-none"
      />
      <span className="text-xs text-slate-400">⌘K</span>
    </div>
  );
}
