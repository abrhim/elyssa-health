import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { fetchTodayPlan, fetchWeekSchedule } from "~/lib/queries";
import type { WorkoutPlan, PlannedExercise, ExerciseResult, WeekSchedule } from "~/lib/types";
import { ExerciseCard } from "~/components/ExerciseCard";
import { PhaseBadge } from "~/components/PhaseBadge";
import { EmptyState } from "~/components/EmptyState";
import { Nav } from "~/components/Nav";
import { ConfirmationBanner } from "~/components/ConfirmationBanner";

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

const MODE_LABELS: Record<string, string> = {
  performance: "Performance",
  survival: "Survival",
  ramp_up: "Ramp Up",
};

export default function TodayWorkout() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plan, setPlan] = useState<(WorkoutPlan & { planned_exercises: PlannedExercise[] }) | null>(null);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [schedule, setSchedule] = useState<WeekSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedExId, setExpandedExId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const workoutFinished = searchParams.get("finished") === "true";
  const confirmationMessage = workoutFinished
    ? "Workout finished and saved"
    : savedMessage;

  function dismissConfirmation() {
    setSavedMessage(null);
    if (workoutFinished) setSearchParams({}, { replace: true });
  }

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [planData, sched] = await Promise.all([
        fetchTodayPlan(today),
        fetchWeekSchedule(),
      ]);
      if (cancelled) return;
      setPlan(planData.plan);
      setResults(planData.results);
      setSchedule(sched);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [today]);

  async function handleSaved(exerciseName: string) {
    setExpandedExId(null);
    setSavedMessage(`${exerciseName} sets saved`);
    if (plan) {
      const planData = await fetchTodayPlan(today);
      if (planData.plan) {
        setResults(planData.results);
      }
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-ink-muted text-base">Loading today's workout…</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <>
        <EmptyState schedule={schedule} />
        <Nav />
      </>
    );
  }

  const exerciseResults = (exId: string) =>
    results.filter((r) => r.exercise_id === exId);

  const hasResults = results.length > 0;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {confirmationMessage && (
          <ConfirmationBanner message={confirmationMessage} onDismiss={dismissConfirmation} />
        )}

        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="px-3 py-1.5 bg-cream-dark rounded-lg text-base font-semibold">
              {SESSION_LABELS[plan.session_type] ?? plan.session_type}
            </span>
            <PhaseBadge phase={plan.cycle_phase} day={plan.cycle_day} />
            {plan.training_mode && (
              <span className="px-2.5 py-1 bg-cream-dark rounded text-sm text-ink-muted">
                {MODE_LABELS[plan.training_mode] ?? plan.training_mode}
              </span>
            )}
          </div>
          {plan.rir_target && (
            <div className="text-sm text-ink-muted mb-1">RIR target: {plan.rir_target}</div>
          )}
          {plan.coach_notes && (
            <div className="text-base text-ink-light leading-relaxed whitespace-pre-line">{plan.coach_notes.replace(/\\n/g, "\n")}</div>
          )}
        </div>

        {/* Exercise List */}
        <div className="px-4 pb-4 space-y-3">
          {plan.planned_exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              results={exerciseResults(ex.exercise_id)}
              expanded={expandedExId === ex.id}
              onToggle={() => setExpandedExId(expandedExId === ex.id ? null : ex.id)}
              onSaved={handleSaved}
            />
          ))}
        </div>

        {/* Complete Button */}
        {hasResults && (
          <div className="px-4 pb-6">
            <button
              onClick={() => navigate("/complete")}
              className="w-full py-3.5 bg-accent hover:bg-accent-hover active:bg-accent-active text-white font-semibold rounded-xl text-base transition-colors min-h-[44px]"
            >
              Review and Finish Workout
            </button>
          </div>
        )}
      </div>

      <Nav />
    </>
  );
}
