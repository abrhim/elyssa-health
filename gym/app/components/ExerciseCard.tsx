import { useNavigate } from "react-router";
import type { PlannedExercise, ExerciseResult } from "~/lib/types";
import { isTimed, formatDuration } from "~/lib/format";
import { StatusBadge } from "./StatusBadge";

interface Props {
  exercise: PlannedExercise;
  results: ExerciseResult[];
}

export function ExerciseCard({ exercise, results }: Props) {
  const navigate = useNavigate();
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

  return (
    <button
      onClick={() => navigate(`/log/${exercise.id}`)}
      className="w-full text-left bg-cream-card border border-cream-border rounded-xl p-4 active:bg-cream-dark transition-colors"
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

      {actualStr && (
        <div className="text-base text-accent mt-1.5 font-medium">
          Done: {actualStr}
        </div>
      )}

      {exercise.coaching_note && (
        <div className="text-sm text-ink-light mt-2 font-medium leading-relaxed whitespace-pre-line">
          {exercise.coaching_note.replace(/\\n/g, "\n")}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-cream-border flex items-center justify-between min-h-[44px]">
        <span className="text-sm text-action font-medium">
          {status === "pending" ? "Log Sets" : "Edit Sets"}
        </span>
        <span className="text-action text-base">›</span>
      </div>
    </button>
  );
}
