interface Props {
  children: string;
  tone?: "challenge" | "partner" | "neutral";
}

const TONES = {
  challenge: "bg-cyan-900/40 text-cyan-200",
  partner: "bg-emerald-900/40 text-emerald-200",
  neutral: "bg-neutral-800 text-neutral-200",
};

export default function TagChip({ children, tone = "neutral" }: Props) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${TONES[tone]}`}>
      {children}
    </span>
  );
}
