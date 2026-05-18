import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { fetchTodayPlan, completeWorkout } from "~/lib/queries";
import type { WorkoutPlan, PlannedExercise, ExerciseResult } from "~/lib/types";

export default function CompleteWorkout() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<(WorkoutPlan & { planned_exercises: PlannedExercise[] }) | null>(null);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [status, setStatus] = useState<"completed" | "partial" | "skipped">("completed");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchTodayPlan(today);
      if (cancelled) return;
      setPlan(data.plan);
      setResults(data.results);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [today]);

  async function handleComplete() {
    if (!plan) return;
    setSaving(true);
    await completeWorkout(plan.id, status, notes || undefined);
    if (navigator.vibrate) navigator.vibrate(100);
    navigate("/?finished=true");
  }

  if (loading || !plan) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading workout summary…</div>
      </div>
    );
  }

  const exerciseSummary = plan.planned_exercises.map((pe) => {
    const exResults = results.filter((r) => r.exercise_id === pe.exercise_id);
    const workingSets = exResults.filter((r) => r.set_type === "working" || r.set_type === "test_set");
    const volume = workingSets.reduce((sum, s) => sum + (s.weight ?? 0) * s.reps, 0);
    return {
      name: pe.exercise.name,
      goalSets: pe.goal_sets ?? 3,
      loggedSets: workingSets.length,
      volume: Math.round(volume),
      bestWeight: workingSets.reduce((max, s) => Math.max(max, s.weight ?? 0), 0),
      bestReps: workingSets.length > 0
        ? workingSets.reduce((best, s) => {
            if ((s.weight ?? 0) > (best.weight ?? 0)) return s;
            if ((s.weight ?? 0) === (best.weight ?? 0) && s.reps > best.reps) return s;
            return best;
          }, workingSets[0])
        : null,
    };
  });

  const totalVolume = exerciseSummary.reduce((sum, e) => sum + e.volume, 0);
  const exercisesDone = exerciseSummary.filter((e) => e.loggedSets > 0).length;

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 pt-5 pb-3 border-b border-zinc-800">
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 mb-2 py-1 active:text-zinc-200">
          <span className="text-base leading-none">‹</span> Back to workout
        </button>
        <h1 className="text-xl font-bold">Workout Summary</h1>
        <div className="flex gap-4 mt-2 text-sm">
          <div>
            <span className="text-zinc-500">Exercises: </span>
            <span className="text-zinc-200">{exercisesDone}/{plan.planned_exercises.length}</span>
          </div>
          <div>
            <span className="text-zinc-500">Volume: </span>
            <span className="text-zinc-200">{totalVolume.toLocaleString()} lbs</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {exerciseSummary.map((e) => (
          <div key={e.name} className="flex items-center justify-between py-2 border-b border-zinc-800/50">
            <div>
              <div className="text-sm font-medium">{e.name}</div>
              <div className="text-xs text-zinc-500">
                {e.loggedSets}/{e.goalSets} sets
                {e.bestWeight > 0 && ` · best ${e.bestWeight} lbs`}
              </div>
            </div>
            <div className="text-xs text-zinc-400">
              {e.volume > 0 ? `${e.volume.toLocaleString()} lbs` : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-4 border-t border-zinc-800 space-y-3">
        <div className="flex gap-2">
          {(["completed", "partial", "skipped"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                status === s
                  ? s === "completed" ? "bg-accent text-white"
                    : s === "partial" ? "bg-note text-white"
                    : "bg-phase-menstrual text-white"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-action focus:outline-none resize-none"
        />

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-3.5 bg-accent hover:bg-accent-hover active:bg-accent-active text-white font-semibold rounded-xl text-base transition-colors"
          >
            Finish Workout
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-zinc-400 text-center">
              Mark workout as {status}? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-3 bg-zinc-800 text-zinc-300 font-medium rounded-xl text-sm active:bg-zinc-700"
              >
                Go Back
              </button>
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 py-3 bg-accent hover:bg-accent-hover active:bg-accent-active disabled:bg-zinc-700 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {saving ? "Saving…" : "Yes, Finish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
