interface Props {
  message: string;
  onDismiss: () => void;
}

export function ConfirmationBanner({ message, onDismiss }: Props) {
  return (
    <div className="mx-4 mt-3 flex items-center justify-between gap-2 bg-accent/15 border border-accent/30 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-accent text-sm shrink-0">✓</span>
        <span className="text-sm text-accent font-medium truncate">{message}</span>
      </div>
      <button
        onClick={onDismiss}
        className="text-accent/60 text-lg shrink-0 px-1 active:text-accent"
        aria-label="Dismiss confirmation"
      >
        ×
      </button>
    </div>
  );
}
