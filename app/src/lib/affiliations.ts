export const AFFILIATION_COLORS: Record<string, string> = {
  "Academic institution": "#4f46e5",
  "For-profit company": "#059669",
  "DOE National Lab": "#d97706",
  "Non-profit": "#9333ea",
  "Independent": "#dc2626",
};

export function affiliationColor(a?: string): string {
  if (!a) return "#64748b";
  return AFFILIATION_COLORS[a] ?? "#64748b";
}
