import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { fetchPlannedExercise, fetchExistingSets, saveSets } from "~/lib/queries";
import type { PlannedExercise, ExerciseResult, SetInput as SetInputType } from "~/lib/types";
import { SetInput } from "~/components/SetInput";

export default function LogExercise() {
  const { planExId } = useParams();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState<PlannedExercise | null>(null);
  const [sets, setSets] = useState<SetInputType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!planExId) return;
      const ex = await fetchPlannedExercise(planExId);
      if (cancelled || !ex) return;
      setExercise(ex);

      const existing = await fetchExistingSets(ex.workout_plan_id, ex.exercise_id);
      if (cancelled) return;

      if (existing.length > 0) {
        setSets(existing.map((r: ExerciseResult) => ({
          set_number: r.set_number,
          type: r.set_type,
          weight: r.weight,
          reps: r.reps,
          rpe: r.rpe,
        })));
      } else {
        const numSets = ex.goal_sets ?? 3;
        setSets(
          Array.from({ length: numSets }, (_, i) => ({
            set_number: i + 1,
            type: "working",
            weight: ex.goal_weight,
            reps: null,
            rpe: null,
          })),
        );
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [planExId]);

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
        type: "working",
        weight: exercise?.goal_weight ?? null,
        reps: null,
        rpe: null,
      },
    ]);
  }

  async function handleSave() {
    if (!exercise) return;
    const validSets = sets.filter((s) => s.reps !== null && s.reps > 0);
    if (validSets.length === 0) {
      setError("Fill in the reps for at least one set, then tap Save");
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
      set_type: s.type,
      weight: s.weight,
      reps: s.reps!,
      rpe: s.rpe,
      is_per_hand: exercise.is_per_hand,
    }));

    const result = await saveSets(rows);
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    if (navigator.vibrate) navigator.vibrate(50);
    navigate(`/?saved=${encodeURIComponent(ex.name)}`);
  }

  if (loading || !exercise) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-ink-muted text-sm">Loading exercise…</div>
      </div>
    );
  }

  const ex = exercise.exercise;
  const perHand = exercise.is_per_hand ? "/hand" : "";
  const goalStr = exercise.goal_weight
    ? `${exercise.goal_weight} lbs${perHand} × ${exercise.goal_reps} × ${exercise.goal_sets}`
    : `${exercise.goal_reps} × ${exercise.goal_sets}`;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-cream-border">
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-1.5 text-sm text-ink-muted mb-2 py-1 active:text-ink">
          <span className="text-base leading-none">‹</span> Back to workout
        </button>
        <h1 className="text-xl font-bold">{ex.name}</h1>
        <div className="text-sm text-ink-muted mt-1">Goal: {goalStr}</div>
        {exercise.previous_weight && (
          <div className="text-xs text-ink-muted mt-0.5">
            Prev: {exercise.previous_weight} lbs{perHand} × {exercise.previous_reps}
            {exercise.previous_best_note && ` — ${exercise.previous_best_note}`}
          </div>
        )}
        {exercise.coaching_note && (
          <div className="text-xs text-note/80 mt-1 italic whitespace-pre-line">{exercise.coaching_note.replace(/\\n/g, "\n")}</div>
        )}
        {ex.form_cues && ex.form_cues.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-ink-muted cursor-pointer">Form cues</summary>
            <ul className="text-xs text-ink-light mt-1 space-y-0.5 pl-4 list-disc">
              {ex.form_cues.map((cue, i) => <li key={i}>{cue}</li>)}
            </ul>
          </details>
        )}
      </div>

      {/* Set Labels */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 text-[10px] text-ink-muted uppercase tracking-wider">
          <div className="w-8 text-center">#</div>
          <div className="w-20">Type</div>
          <div className="flex-1 text-center">Weight</div>
          <div className="w-14 text-center">Reps</div>
          <div className="w-12 text-center">RPE</div>
          {sets.length > 1 && <div className="w-8" />}
        </div>
      </div>

      {/* Set Rows */}
      <div className="px-4 flex-1 overflow-y-auto">
        {sets.map((set, i) => (
          <SetInput
            key={i}
            set={set}
            index={i}
            equipment={ex.equipment}
            onChange={handleChange}
            onRemove={handleRemove}
            canRemove={sets.length > 1}
          />
        ))}

        <button
          type="button"
          onClick={addSet}
          className="w-full py-2.5 mt-2 border border-dashed border-cream-border rounded-xl text-sm text-ink-muted active:bg-cream-dark"
        >
          + Add Set
        </button>
      </div>

      {/* Save */}
      <div className="px-4 py-4 border-t border-cream-border">
        {error && (
          <div className="flex items-start gap-2 bg-phase-menstrual/10 border border-phase-menstrual/30 rounded-lg px-3 py-2.5 mb-3">
            <span className="text-phase-menstrual text-sm shrink-0">!</span>
            <span className="text-sm text-phase-menstrual">{error}</span>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 bg-action hover:bg-action-hover active:bg-action-hover disabled:bg-cream-dark disabled:text-ink-muted text-white font-semibold rounded-xl text-base transition-colors"
        >
          {saving ? "Saving sets…" : "Save Sets and Go Back"}
        </button>
      </div>
    </div>
  );
}
