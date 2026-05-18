import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { fetchPlannedExercise, fetchExistingSets, saveSets } from "~/lib/queries";
import type { PlannedExercise, ExerciseResult, SetInput as SetInputType } from "~/lib/types";
import { isTimed, formatDuration } from "~/lib/format";
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
        const timed = isTimed(ex);
        const numSets = ex.goal_sets ?? 3;
        setSets(
          Array.from({ length: numSets }, (_, i) => ({
            set_number: i + 1,
            type: timed ? "timed" : "working",
            weight: timed ? null : ex.goal_weight,
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
    const timed = exercise ? isTimed(exercise) : false;
    setSets((prev) => [
      ...prev,
      {
        set_number: prev.length + 1,
        type: timed ? "timed" : "working",
        weight: timed ? null : (exercise?.goal_weight ?? null),
        reps: null,
        rpe: null,
      },
    ]);
  }

  async function handleSave() {
    if (!exercise) return;
    const timed = isTimed(exercise);
    const validSets = sets.filter((s) => s.reps !== null && s.reps > 0);
    if (validSets.length === 0) {
      setError(timed
        ? "Enter a duration for at least one set, then tap Save"
        : "Fill in the reps for at least one set, then tap Save");
      return;
    }

    setSaving(true);
    setError(null);

    const ex = exercise.exercise;
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
        <div className="text-ink-muted text-base">Loading exercise…</div>
      </div>
    );
  }

  const ex = exercise.exercise;
  const timed = isTimed(exercise);
  const perHand = exercise.is_per_hand ? "/hand" : "";

  let goalStr: string;
  if (timed) {
    goalStr = exercise.coaching_note ?? `${exercise.goal_sets ?? 1} sets`;
  } else {
    goalStr = exercise.goal_weight
      ? `${exercise.goal_weight} lbs${perHand} × ${exercise.goal_reps} × ${exercise.goal_sets}`
      : `${exercise.goal_reps} × ${exercise.goal_sets}`;
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-cream-border">
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-1.5 text-base text-ink-muted mb-2 py-1 active:text-ink min-h-[44px]">
          <span className="text-lg leading-none">‹</span> Back to workout
        </button>
        <h1 className="text-2xl font-bold leading-tight">{ex.name}</h1>

        {/* Exercise metadata */}
        <div className="flex items-center gap-2 text-sm text-ink-muted mt-1">
          <span>{ex.muscle_group}</span>
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${exercise.layer === 1 ? "bg-layer-1/20 text-layer-1" : "bg-layer-2/20 text-layer-2"}`}>
            L{exercise.layer}
          </span>
          {ex.equipment !== "bodyweight" && <span>{ex.equipment}</span>}
          {ex.is_seated && <span className="text-accent/70">seated</span>}
        </div>

        <div className="text-base text-ink-muted mt-1.5">Goal: {goalStr}</div>
        {exercise.previous_weight && (
          <div className="text-sm text-ink-muted mt-0.5">
            Prev: {exercise.previous_weight} lbs{perHand} × {exercise.previous_reps}
            {exercise.previous_best_note && ` — ${exercise.previous_best_note}`}
          </div>
        )}
        {!timed && exercise.coaching_note && (
          <div className="text-sm text-ink-light mt-1.5 font-medium leading-relaxed whitespace-pre-line">{exercise.coaching_note.replace(/\\n/g, "\n")}</div>
        )}
        {ex.form_cues && ex.form_cues.length > 0 && (
          <details className="mt-2">
            <summary className="text-sm text-ink-muted cursor-pointer">Form cues</summary>
            <ul className="text-sm text-ink-light mt-1 space-y-0.5 pl-4 list-disc">
              {ex.form_cues.map((cue, i) => <li key={i}>{cue}</li>)}
            </ul>
          </details>
        )}
      </div>

      {/* Set Labels */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wide">
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
      </div>

      {/* Set Rows */}
      <div className="px-4 flex-1 overflow-y-auto">
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
      </div>

      {/* Save */}
      <div className="px-4 py-4 border-t border-cream-border">
        {error && (
          <div className="flex items-start gap-2 bg-phase-menstrual/10 border border-phase-menstrual/30 rounded-lg px-3 py-2.5 mb-3">
            <span className="text-phase-menstrual text-base shrink-0">!</span>
            <span className="text-base text-phase-menstrual">{error}</span>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 bg-accent hover:bg-accent-hover active:bg-accent-active disabled:bg-cream-dark disabled:text-ink-muted text-white font-semibold rounded-xl text-base transition-colors min-h-[44px]"
        >
          {saving ? "Saving sets…" : "Save Sets and Go Back"}
        </button>
      </div>
    </div>
  );
}
