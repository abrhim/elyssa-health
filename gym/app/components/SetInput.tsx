import type { SetInput as SetInputType } from "~/lib/types";

interface Props {
  set: SetInputType;
  index: number;
  equipment: string;
  onChange: (index: number, field: keyof SetInputType, value: number | string | null) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export function SetInput({ set, index, equipment, onChange, onRemove, canRemove }: Props) {
  const step = equipment === "dumbbell" ? 2.5 : 5;

  return (
    <div className="flex items-center gap-1.5 py-2.5">
      <div className="w-7 text-center text-sm text-ink-muted shrink-0">
        {set.set_number}
      </div>

      <select
        value={set.type}
        onChange={(e) => onChange(index, "type", e.target.value)}
        className="bg-cream-dark border border-cream-border rounded-lg px-1.5 py-2.5 text-sm text-ink-light w-[4.5rem] shrink-0"
      >
        <option value="working">Work</option>
        <option value="warmup">Warm</option>
        <option value="drop_set">Drop</option>
        <option value="burn_set">Burn</option>
      </select>

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
