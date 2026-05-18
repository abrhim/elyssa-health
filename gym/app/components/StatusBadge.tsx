const STATUS_CONFIG = {
  done: { dot: "bg-status-done", text: "text-status-done", label: "Logged" },
  in_progress: { dot: "bg-status-progress", text: "text-status-progress", label: "In progress" },
  pending: { dot: "bg-status-pending", text: "text-ink-muted", label: "Not started" },
};

export function StatusBadge({ status }: { status: "pending" | "in_progress" | "done" }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${cfg.dot} inline-block shrink-0`} />
      <span className={`text-[10px] font-medium ${cfg.text}`}>{cfg.label}</span>
    </span>
  );
}

export function WorkoutStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    planned: "bg-cream-dark text-ink-muted",
    completed: "bg-accent/15 text-accent",
    partial: "bg-note/15 text-note",
    skipped: "bg-phase-menstrual/15 text-phase-menstrual",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? styles.planned}`}>
      {status}
    </span>
  );
}
