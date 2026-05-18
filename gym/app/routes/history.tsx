import { useState, useEffect } from "react";
import { fetchHistory, fetchWorkoutDetail } from "~/lib/queries";
import type { WorkoutPlan, PlannedExercise, ExerciseResult } from "~/lib/types";
import { WorkoutStatusBadge } from "~/components/StatusBadge";
import { Nav } from "~/components/Nav";

const SESSION_LABELS: Record<string, string> = {
  lower_a: "Lower A",
  lower_b: "Lower B",
  upper_a: "Upper A",
  upper_b: "Upper B",
  easy_run: "Easy Run",
  long_run: "Long Run",
  rest: "Rest",
  deload: "Deload",
};

interface ExpandedData {
  exercises: PlannedExercise[];
  results: ExerciseResult[];
}

export default function History() {
  const [workouts, setWorkouts] = useState<(WorkoutPlan & { planned_exercises: { count: number }[] })[]>([]);
  const [expanded, setExpanded] = useState<Record<string, ExpandedData>>({});
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchHistory(14);
      if (!cancelled) {
        setWorkouts(data);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function toggleExpand(planId: string) {
    if (expanded[planId]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      return;
    }

    const detail = await fetchWorkoutDetail(planId);
    setExpanded((prev) => ({
      ...prev,
      [planId]: { exercises: detail.exercises, results: detail.results },
    }));
  }

  if (loading) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 text-sm">Loading workout history…</div>
        </div>
        <Nav />
      </>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-xl font-bold">History</h1>
          <p className="text-xs text-zinc-500 mt-1">Last 14 days</p>
        </div>

        <div className="px-4 pb-4 space-y-2">
          {workouts.length === 0 && (
            <div className="text-center text-zinc-500 text-sm py-12">No workouts yet</div>
          )}

          {workouts.map((w) => {
            const detail = expanded[w.id];
            const exCount = w.planned_exercises?.[0]?.count ?? 0;
            const dateLabel = new Date(w.workout_date + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            return (
              <div key={w.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpand(w.id)}
                  className="w-full text-left px-4 py-3 active:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{dateLabel}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {SESSION_LABELS[w.session_type] ?? w.session_type} · {exCount} exercises
                      </div>
                    </div>
                    <WorkoutStatusBadge status={w.status} />
                  </div>
                </button>

                {detail && (
                  <div className="border-t border-zinc-800 px-4 py-2 space-y-0.5">
                    {detail.exercises.map((pe) => {
                      const exResults = detail.results.filter((r) => r.exercise_id === pe.exercise_id).sort((a, b) => a.set_number - b.set_number);
                      const workingSets = exResults.filter((r) => r.set_type === "working" || r.set_type === "test_set");
                      const isExpanded = expandedExercise === pe.id;
                      return (
                        <div key={pe.id}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedExercise(isExpanded ? null : pe.id); }}
                            className="w-full flex items-center justify-between py-1.5 active:bg-zinc-800/50"
                          >
                            <span className="text-sm text-zinc-300">{pe.exercise.name}</span>
                            <span className="text-xs text-zinc-500">
                              {workingSets.length > 0
                                ? workingSets.map((s) => `${s.weight ?? 0}×${s.reps}`).join(", ")
                                : "—"}
                            </span>
                          </button>
                          {isExpanded && exResults.length > 0 && (
                            <div className="ml-2 mb-2 pl-2 border-l border-zinc-700 space-y-1">
                              {exResults.map((r) => (
                                <div key={r.id} className="flex items-center gap-3 text-xs">
                                  <span className="text-zinc-600 w-4">{r.set_number}</span>
                                  <span className={`w-10 ${r.set_type === "working" ? "text-zinc-400" : "text-zinc-600"}`}>
                                    {r.set_type === "working" ? "Work" : r.set_type === "warmup" ? "Warm" : r.set_type === "test_set" ? "Test" : r.set_type === "drop_set" ? "Drop" : r.set_type}
                                  </span>
                                  <span className="text-zinc-300">{r.weight ?? 0} lbs</span>
                                  <span className="text-zinc-300">×{r.reps}</span>
                                  {r.rpe && <span className="text-zinc-500">RPE {r.rpe}</span>}
                                </div>
                              ))}
                              <div className="text-xs text-zinc-600 pt-0.5">
                                Vol: {workingSets.reduce((sum, s) => sum + (s.weight ?? 0) * s.reps, 0).toLocaleString()} lbs
                              </div>
                            </div>
                          )}
                          {isExpanded && exResults.length === 0 && (
                            <div className="ml-2 mb-2 pl-2 border-l border-zinc-700 text-xs text-zinc-600">
                              No sets logged
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Nav />
    </>
  );
}
