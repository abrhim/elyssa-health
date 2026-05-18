import { useState } from "react";
import type { SetInput as SetInputType } from "~/lib/types";
import { formatDuration, parseDuration } from "~/lib/format";

interface Props {
  set: SetInputType;
  index: number;
  equipment: string;
  timed: boolean;
  onChange: (index: number, field: keyof SetInputType, value: number | string | null) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function SetInput({ set, index, equipment, timed, onChange, onRemove, canRemove }: Props) {
  const step = equipment === "dumbbell" ? 2.5 : 5;
  const [durationText, setDurationText] = useState(
    set.reps ? formatDuration(set.reps) : "",
  );

  function handleDurationChange(text: string) {
    setDurationText(text);
    const seconds = parseDuration(text);
    onChange(index, "reps", seconds);
  }

  if (timed) {
    return (
      <div className="flex items-center gap-2 py-2.5">
        <div className="w-7 text-center text-sm text-ink-muted shrink-0">
          {set.set_number}
        </div>

        <div className="flex-1">
          <input
            type="text"
            inputMode="numeric"
            value={durationText}
            onChange={(e) => handleDurationChange(e.target.value)}
            placeholder="m:ss"
            className="w-full h-11 bg-cream-dark border border-cream-border rounded-lg text-center text-base text-ink focus:border-action focus:outline-none"
          />
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="w-10 h-11 text-ink-muted text-lg active:text-phase-menstrual shrink-0 min-h-[44px]"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 py-2.5">
      <div className="w-7 text-center text-sm text-ink-muted shrink-0">
        {set.set_number}
      </div>

      <div className="flex items-center gap-1 flex-1">
        <button
          type="button"
          onClick={() => onChange(index, "weight", Math.max(0, (set.weight ?? 0) - step))}
          className="w-10 h-11 bg-cream-dark rounded-lg text-ink-muted text-lg active:bg-cream-border shrink-0 min-h-[44px]"
        >
          -
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={set.weight ?? ""}
          onChange={(e) => onChange(index, "weight", e.target.value ? parseFloat(e.target.value) : null)}
          placeholder="lbs"
          className="w-16 h-11 bg-cream-dark border border-cream-border rounded-lg text-center text-base text-ink focus:border-action focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(index, "weight", (set.weight ?? 0) + step)}
          className="w-10 h-11 bg-cream-dark rounded-lg text-ink-muted text-lg active:bg-cream-border shrink-0 min-h-[44px]"
        >
          +
        </button>
      </div>

      <input
        type="number"
        inputMode="decimal"
        value={set.reps ?? ""}
        onChange={(e) => onChange(index, "reps", e.target.value ? parseFloat(e.target.value) : null)}
        placeholder="reps"
        className="w-16 h-11 bg-cream-dark border border-cream-border rounded-lg text-center text-base text-ink focus:border-action focus:outline-none"
      />

      <input
        type="number"
        inputMode="decimal"
        value={set.rpe ?? ""}
        onChange={(e) => onChange(index, "rpe", e.target.value ? parseFloat(e.target.value) : null)}
        placeholder="RPE"
        className="w-14 h-11 bg-cream-dark border border-cream-border rounded-lg text-center text-sm text-ink-muted focus:border-action focus:outline-none shrink-0"
      />

      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="w-10 h-11 text-ink-muted text-lg active:text-phase-menstrual shrink-0 min-h-[44px]"
        >
          ×
        </button>
      )}
    </div>
  );
}
