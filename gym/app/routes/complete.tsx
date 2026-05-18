import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { fetchTodayPlan, completeWorkout } from "~/lib/queries";
import type { WorkoutPlan, PlannedExercise, ExerciseResult } from "~/lib/types";
import { isTimed, formatDuration } from "~/lib/format";

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
        <div className="text-ink-muted text-base">Loading workout summary…</div>
      </div>
    );
  }

  const exerciseSummary = plan.planned_exercises.map((pe) => {
    const timed = isTimed(pe);
    const exResults = results.filter((r) => r.exercise_id === pe.exercise_id);
    const countableSets = exResults.filter((r) => r.set_type === "working" || r.set_type === "test_set" || r.set_type === "timed");
    const volume = timed ? 0 : countableSets.reduce((sum, s) => sum + (s.weight ?? 0) * s.reps, 0);
    return {
      name: pe.exercise.name,
      timed,
      goalSets: pe.goal_sets ?? 3,
      loggedSets: countableSets.length,
      volume: Math.round(volume),
      bestWeight: timed ? 0 : countableSets.reduce((max, s) => Math.max(max, s.weight ?? 0), 0),
      bestDuration: timed && countableSets.length > 0
        ? countableSets.reduce((max, s) => Math.max(max, s.reps), 0)
        : 0,
    };
  });

  const totalVolume = exerciseSummary.reduce((sum, e) => sum + e.volume, 0);
  const exercisesDone = exerciseSummary.filter((e) => e.loggedSets > 0).length;

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 pt-5 pb-3 border-b border-cream-border">
        <button onClick={() => navigate("/")} className="inline-flex items-center gap-1.5 text-base text-ink-muted mb-2 py-1 active:text-ink min-h-[44px]">
          <span className="text-lg leading-none">‹</span> Back to workout
        </button>
        <h1 className="text-2xl font-bold leading-tight">Workout Summary</h1>
        <div className="flex gap-4 mt-2 text-base">
          <div>
            <span className="text-ink-muted">Exercises: </span>
            <span className="text-ink">{exercisesDone}/{plan.planned_exercises.length}</span>
          </div>
          <div>
            <span className="text-ink-muted">Volume: </span>
            <span className="text-ink">{totalVolume.toLocaleString()} lbs</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {exerciseSummary.map((e) => (
          <div key={e.name} className="flex items-center justify-between py-2 border-b border-cream-border/50">
            <div>
              <div className="text-base font-medium">{e.name}</div>
              <div className="text-sm text-ink-muted">
                {e.loggedSets}/{e.goalSets} sets
                {e.bestWeight > 0 && ` · best ${e.bestWeight} lbs`}
                {e.timed && e.bestDuration > 0 && ` · best ${formatDuration(e.bestDuration)}`}
              </div>
            </div>
            <div className="text-sm text-ink-muted">
              {e.timed
                ? (e.loggedSets > 0 ? `${formatDuration(e.bestDuration)}` : "—")
                : (e.volume > 0 ? `${e.volume.toLocaleString()} lbs` : "—")}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-4 border-t border-cream-border space-y-3">
        <div className="flex gap-2">
          {(["completed", "partial", "skipped"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`flex-1 py-2.5 rounded-lg text-base font-medium transition-colors min-h-[44px] ${
                status === s
                  ? s === "completed" ? "bg-accent text-white"
                    : s === "partial" ? "bg-note text-white"
                    : "bg-phase-menstrual text-white"
                  : "bg-cream-dark text-ink-muted"
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
          className="w-full bg-cream-card border border-cream-border rounded-xl px-3 py-2.5 text-base text-ink placeholder:text-ink-muted focus:border-action focus:outline-none resize-none"
        />

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-3.5 bg-accent hover:bg-accent-hover active:bg-accent-active text-white font-semibold rounded-xl text-base transition-colors min-h-[44px]"
          >
            Finish Workout
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-base text-ink-muted text-center">
              Mark workout as {status}? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-3 bg-cream-dark text-ink-light font-medium rounded-xl text-base active:bg-cream-border min-h-[44px]"
              >
                Go Back
              </button>
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 py-3 bg-accent hover:bg-accent-hover active:bg-accent-active disabled:bg-cream-dark text-white font-semibold rounded-xl text-base transition-colors min-h-[44px]"
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
