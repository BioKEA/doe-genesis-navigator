interface Props {
  children: string;
  tone?: "challenge" | "partner" | "neutral";
}

const TONES = {
  challenge: "bg-indigo-100 text-indigo-800",
  partner: "bg-emerald-100 text-emerald-800",
  neutral: "bg-slate-100 text-slate-700",
};

export default function TagChip({ children, tone = "neutral" }: Props) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${TONES[tone]}`}>
      {children}
    </span>
  );
}
