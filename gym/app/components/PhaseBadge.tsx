const PHASE_COLORS: Record<string, string> = {
  menstrual: "bg-phase-menstrual/20 text-phase-menstrual",
  follicular: "bg-phase-follicular/20 text-phase-follicular",
  ovulatory: "bg-phase-ovulatory/20 text-phase-ovulatory",
  luteal: "bg-phase-luteal/20 text-phase-luteal",
  period_flu: "bg-phase-menstrual/20 text-phase-menstrual",
};

export function PhaseBadge({ phase, day }: { phase: string | null; day: number | null }) {
  if (!phase) return null;
  const colors = PHASE_COLORS[phase] ?? "bg-zinc-800 text-zinc-400";
  const label = phase.charAt(0).toUpperCase() + phase.slice(1);
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors}`}>
      {label}{day ? ` Day ${day}` : ""}
    </span>
  );
}
