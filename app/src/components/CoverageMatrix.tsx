import type { CoverageMatrix, Strength } from "../lib/coverage";
import { affiliationColor } from "../lib/affiliations";

interface Props {
  matrix: CoverageMatrix;
  onMemberClick?: (slug: string) => void;
}

const STRENGTH_DOTS: Record<Strength, string> = {
  0: "",
  1: "●",
  2: "●●",
  3: "●●●",
};

const STRENGTH_COLOR: Record<Strength, string> = {
  0: "text-neutral-600",
  1: "text-emerald-400",
  2: "text-emerald-400",
  3: "text-emerald-200",
};

const STATUS_BG: Record<string, string> = {
  strong: "bg-emerald-900/30",
  thin: "bg-amber-900/30",
  gap: "bg-red-900/30",
  redundant: "bg-cyan-900/30",
};

const STATUS_LABEL: Record<string, string> = {
  strong: "strong",
  thin: "thin — single point of failure",
  gap: "GAP — no coverage",
  redundant: "redundant — consider trimming",
};

export default function CoverageMatrixView({ matrix, onMemberClick }: Props) {
  const { rows, members } = matrix;
  if (members.length === 0) return null;

  // Group rows: challenges first, then offerings
  const challengeRows = rows.filter((r) => r.kind === "challenge");
  const offeringRows = rows.filter((r) => r.kind === "offering");

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-700 bg-neutral-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-900">
            <th className="sticky left-0 z-10 w-60 bg-neutral-900 px-3 py-2 text-left text-xs uppercase text-neutral-400">
              Requirement
            </th>
            {members.map((p) => (
              <th
                key={p.slug}
                className="min-w-[90px] border-l border-neutral-800 px-2 py-2 text-left align-bottom"
                style={{ minHeight: 80 }}
              >
                <button
                  type="button"
                  onClick={() => onMemberClick?.(p.slug)}
                  className="group block text-left"
                  title={p.name}
                >
                  <div className="flex items-start gap-1">
                    <span
                      className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: affiliationColor(p.affiliation) }}
                    />
                    <div
                      className="text-[11px] font-semibold leading-tight text-neutral-100 group-hover:text-cyan-300"
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        maxHeight: 140,
                      }}
                    >
                      {truncate(p.name, 28)}
                    </div>
                  </div>
                </button>
              </th>
            ))}
            <th className="border-l border-neutral-800 px-2 py-2 text-left text-xs uppercase text-neutral-400">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {challengeRows.length > 0 && (
            <tr>
              <td
                colSpan={members.length + 2}
                className="bg-cyan-900/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-300"
              >
                Challenge areas
              </td>
            </tr>
          )}
          {challengeRows.map((row) => (
            <tr key={`c:${row.label}`} className="border-t border-neutral-800">
              <td className={`sticky left-0 z-10 w-60 px-3 py-2 text-xs ${STATUS_BG[row.status]}`}>
                {row.label}
              </td>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className={`border-l border-neutral-800 px-2 py-2 text-center text-sm ${
                    cell.strength > 0 ? STATUS_BG[row.status] : ""
                  }`}
                >
                  <span className={STRENGTH_COLOR[cell.strength]}>
                    {STRENGTH_DOTS[cell.strength]}
                  </span>
                </td>
              ))}
              <td className={`border-l border-neutral-800 px-2 py-2 text-[11px] ${STATUS_BG[row.status]}`}>
                {STATUS_LABEL[row.status]}
              </td>
            </tr>
          ))}

          {offeringRows.length > 0 && (
            <tr>
              <td
                colSpan={members.length + 2}
                className="bg-emerald-900/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300"
              >
                Required offerings
              </td>
            </tr>
          )}
          {offeringRows.map((row) => (
            <tr key={`o:${row.label}`} className="border-t border-neutral-800">
              <td className={`sticky left-0 z-10 w-60 px-3 py-2 text-xs ${STATUS_BG[row.status]}`}>
                {row.label}
              </td>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className={`border-l border-neutral-800 px-2 py-2 text-center text-sm ${
                    cell.strength > 0 ? STATUS_BG[row.status] : ""
                  }`}
                >
                  <span className={STRENGTH_COLOR[cell.strength]}>
                    {STRENGTH_DOTS[cell.strength]}
                  </span>
                </td>
              ))}
              <td className={`border-l border-neutral-800 px-2 py-2 text-[11px] ${STATUS_BG[row.status]}`}>
                {STATUS_LABEL[row.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-neutral-700 bg-neutral-900 px-3 py-2 text-[11px] text-neutral-400">
        Dots show coverage strength (● basic, ●● solid, ●●● deep).
        <span className="mx-2 rounded bg-emerald-900/30 px-1">green</span> = strong ·
        <span className="mx-2 rounded bg-amber-900/30 px-1">amber</span> = thin ·
        <span className="mx-2 rounded bg-red-900/30 px-1">red</span> = gap ·
        <span className="mx-2 rounded bg-cyan-900/30 px-1">blue</span> = redundant
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
