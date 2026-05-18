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
    <div className="flex items-center gap-1.5 py-2">
      <div className="w-6 text-center text-xs text-zinc-500 shrink-0">
        {set.set_number}
      </div>

      <select
        value={set.type}
        onChange={(e) => onChange(index, "type", e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-1.5 py-2.5 text-xs text-zinc-300 w-[4.2rem] shrink-0"
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
          className="w-8 h-10 bg-zinc-800 rounded-lg text-zinc-400 text-lg active:bg-zinc-700 shrink-0"
        >
          -
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={set.weight ?? ""}
          onChange={(e) => onChange(index, "weight", e.target.value ? parseFloat(e.target.value) : null)}
          placeholder="lbs"
          className="w-14 h-10 bg-zinc-800 border border-zinc-700 rounded-lg text-center text-sm text-zinc-100 focus:border-action focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onChange(index, "weight", (set.weight ?? 0) + step)}
          className="w-8 h-10 bg-zinc-800 rounded-lg text-zinc-400 text-lg active:bg-zinc-700 shrink-0"
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
        className="w-14 h-10 bg-zinc-800 border border-zinc-700 rounded-lg text-center text-base text-zinc-100 focus:border-action focus:outline-none"
      />

      <input
        type="number"
        inputMode="decimal"
        value={set.rpe ?? ""}
        onChange={(e) => onChange(index, "rpe", e.target.value ? parseFloat(e.target.value) : null)}
        placeholder="RPE"
        className="w-11 h-10 bg-zinc-800 border border-zinc-700 rounded-lg text-center text-xs text-zinc-400 focus:border-action focus:outline-none shrink-0"
      />

      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="w-8 h-10 text-zinc-600 text-lg active:text-phase-menstrual shrink-0"
        >
          ×
        </button>
      )}
    </div>
  );
}
