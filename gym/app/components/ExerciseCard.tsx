import { useState, useEffect } from "react";
import type { PlannedExercise, ExerciseResult, SetInput as SetInputType } from "~/lib/types";
import { isTimed, formatDuration } from "~/lib/format";
import { saveSets } from "~/lib/queries";
import { StatusBadge } from "./StatusBadge";
import { SetInput } from "./SetInput";

interface Props {
  exercise: PlannedExercise;
  results: ExerciseResult[];
  expanded: boolean;
  onToggle: () => void;
  onSaved: (exerciseName: string) => void;
}

export function ExerciseCard({ exercise, results, expanded, onToggle, onSaved }: Props) {
  const ex = exercise.exercise;
  const timed = isTimed(exercise);
  const countableSets = results.filter((r) => r.set_type === "working" || r.set_type === "test_set" || r.set_type === "timed");

  const status: "pending" | "in_progress" | "done" =
    countableSets.length === 0 ? "pending"
    : countableSets.length >= (exercise.goal_sets ?? 3) ? "done"
    : "in_progress";

  const perHand = exercise.is_per_hand ? "/hand" : "";

  let goalStr: string;
  if (timed) {
    goalStr = exercise.coaching_note ?? `${exercise.goal_sets ?? 1} sets`;
  } else {
    const parts: string[] = [];
    if (exercise.goal_weight) parts.push(`${exercise.goal_weight} lbs${perHand}`);
    if (exercise.goal_reps) parts.push(`${exercise.goal_reps}`);
    if (exercise.goal_sets) parts.push(`${exercise.goal_sets}`);
    goalStr = parts.join(" × ") || "See notes";
  }

  const actualStr = countableSets.length > 0
    ? timed
      ? countableSets.map((s) => formatDuration(s.reps)).join(", ")
      : countableSets.map((s) => `${s.weight ?? 0}×${s.reps}`).join(", ")
    : null;

  // --- Inline logging state ---
  const [sets, setSets] = useState<SetInputType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    if (results.length > 0) {
      setSets(results.map((r) => ({
        set_number: r.set_number,
        type: r.set_type,
        weight: r.weight,
        reps: r.reps,
        rpe: r.rpe,
      })));
    } else {
      const numSets = exercise.goal_sets ?? 3;
      setSets(
        Array.from({ length: numSets }, (_, i) => ({
          set_number: i + 1,
          type: timed ? "timed" : "working",
          weight: timed ? null : exercise.goal_weight,
          reps: null,
          rpe: null,
        })),
      );
    }
    setError(null);
  }, [expanded]);

  function handleChange(index: number, field: keyof SetInputType, value: number | string | null) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function handleRemove(index: number) {
    setSets((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, set_number: i + 1 }));
    });
  }

  function addSet() {
    setSets((prev) => [
      ...prev,
      {
        set_number: prev.length + 1,
        type: timed ? "timed" : "working",
        weight: timed ? null : (exercise.goal_weight ?? null),
        reps: null,
        rpe: null,
      },
    ]);
  }

  async function handleSave() {
    const validSets = sets.filter((s) => s.reps !== null && s.reps > 0);
    if (validSets.length === 0) {
      setError(timed
        ? "Enter a duration for at least one set, then tap Save"
        : "Fill in the reps for at least one set, then tap Save");
      return;
    }

    setSaving(true);
    setError(null);

    const rows = validSets.map((s) => ({
      exercise_id: exercise.exercise_id,
      workout_plan_id: exercise.workout_plan_id,
      planned_exercise_id: exercise.id,
      workout_date: new Date().toISOString().split("T")[0],
      set_number: s.set_number,
      set_type: timed ? "timed" : "working",
      weight: timed ? null : s.weight,
      reps: s.reps!,
      rpe: timed ? null : s.rpe,
      is_per_hand: exercise.is_per_hand,
    }));

    const result = await saveSets(rows);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (navigator.vibrate) navigator.vibrate(50);
    onSaved(ex.name);
  }

  return (
    <div className="bg-cream-card border border-cream-border rounded-xl overflow-hidden">
      {/* Tappable header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 active:bg-cream-dark transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={status} />
              <h3 className="font-semibold text-lg leading-snug truncate">{ex.name}</h3>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-muted mb-2">
              <span>{ex.muscle_group}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${exercise.layer === 1 ? "bg-layer-1/20 text-layer-1" : "bg-layer-2/20 text-layer-2"}`}>
                L{exercise.layer}
              </span>
              {ex.is_seated && <span className="text-accent/70">seated</span>}
            </div>
          </div>
          <span className={`text-ink-muted text-lg transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
        </div>

        <div className="text-base text-ink mb-1">
          <span className="text-ink-muted">Goal: </span>{goalStr}
        </div>

        {exercise.previous_weight && (
          <div className="text-sm text-ink-muted">
            Prev: {exercise.previous_weight} lbs{perHand} × {exercise.previous_reps}
            {exercise.previous_best_note && ` — ${exercise.previous_best_note}`}
          </div>
        )}

        {actualStr && !expanded && (
          <div className="text-base text-accent mt-1.5 font-medium">
            Done: {actualStr}
          </div>
        )}

        {!timed && exercise.coaching_note && !expanded && (
          <div className="text-sm text-ink-light mt-2 font-medium leading-relaxed whitespace-pre-line">
            {exercise.coaching_note.replace(/\\n/g, "\n")}
          </div>
        )}
      </button>

      {/* Expanded inline logging */}
      {expanded && (
        <div className="border-t border-cream-border px-4 pb-4">
          {!timed && exercise.coaching_note && (
            <div className="text-sm text-ink-light mt-3 mb-2 font-medium leading-relaxed whitespace-pre-line">
              {exercise.coaching_note.replace(/\\n/g, "\n")}
            </div>
          )}

          {ex.form_cues && ex.form_cues.length > 0 && (
            <details className="mt-2 mb-2">
              <summary className="text-sm text-ink-muted cursor-pointer">Form cues</summary>
              <ul className="text-sm text-ink-light mt-1 space-y-0.5 pl-4 list-disc">
                {ex.form_cues.map((cue, i) => <li key={i}>{cue}</li>)}
              </ul>
            </details>
          )}

          {/* Column labels */}
          <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wide mt-3 mb-1">
            <div className="w-7 text-center">#</div>
            {timed ? (
              <div className="flex-1 text-center">Duration</div>
            ) : (
              <>
                <div className="flex-1 text-center">Weight</div>
                <div className="w-16 text-center">Reps</div>
                <div className="w-14 text-center">RPE</div>
              </>
            )}
            {sets.length > 1 && <div className="w-10" />}
          </div>

          {sets.map((set, i) => (
            <SetInput
              key={i}
              set={set}
              index={i}
              equipment={ex.equipment}
              timed={timed}
              onChange={handleChange}
              onRemove={handleRemove}
              canRemove={sets.length > 1}
            />
          ))}

          <button
            type="button"
            onClick={addSet}
            className="w-full py-3 mt-2 border border-dashed border-cream-border rounded-xl text-base text-ink-muted active:bg-cream-dark min-h-[44px]"
          >
            + Add Set
          </button>

          {error && (
            <div className="flex items-start gap-2 bg-phase-menstrual/10 border border-phase-menstrual/30 rounded-lg px-3 py-2.5 mt-3">
              <span className="text-phase-menstrual text-base shrink-0">!</span>
              <span className="text-base text-phase-menstrual">{error}</span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 mt-3 bg-accent hover:bg-accent-hover active:bg-accent-active disabled:bg-cream-dark disabled:text-ink-muted text-white font-semibold rounded-xl text-base transition-colors min-h-[44px]"
          >
            {saving ? "Saving…" : "Save Sets"}
          </button>
        </div>
      )}
    </div>
  );
}
