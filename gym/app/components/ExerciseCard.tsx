import { useNavigate } from "react-router";
import type { PlannedExercise, ExerciseResult } from "~/lib/types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  exercise: PlannedExercise;
  results: ExerciseResult[];
}

export function ExerciseCard({ exercise, results }: Props) {
  const navigate = useNavigate();
  const ex = exercise.exercise;
  const workingSets = results.filter((r) => r.set_type === "working" || r.set_type === "test_set");

  const status: "pending" | "in_progress" | "done" =
    workingSets.length === 0 ? "pending"
    : workingSets.length >= (exercise.goal_sets ?? 3) ? "done"
    : "in_progress";

  const perHand = exercise.is_per_hand ? "/hand" : "";
  const parts: string[] = [];
  if (exercise.goal_weight) parts.push(`${exercise.goal_weight} lbs${perHand}`);
  if (exercise.goal_reps) parts.push(`${exercise.goal_reps}`);
  if (exercise.goal_sets) parts.push(`${exercise.goal_sets}`);
  const goalStr = parts.join(" × ") || "See notes";

  const actualStr = workingSets.length > 0
    ? workingSets.map((s) => `${s.weight ?? 0}×${s.reps}`).join(", ")
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
            <h3 className="font-semibold text-base truncate">{ex.name}</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted mb-2">
            <span>{ex.muscle_group}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${exercise.layer === 1 ? "bg-layer-1/20 text-layer-1" : "bg-layer-2/20 text-layer-2"}`}>
              L{exercise.layer}
            </span>
            {ex.is_seated && <span className="text-accent/70">seated</span>}
          </div>
        </div>
      </div>

      <div className="text-sm text-ink mb-1">
        <span className="text-ink-muted">Goal: </span>{goalStr}
      </div>

      {exercise.previous_weight && (
        <div className="text-xs text-ink-muted">
          Prev: {exercise.previous_weight} lbs{perHand} × {exercise.previous_reps}
          {exercise.previous_best_note && ` — ${exercise.previous_best_note}`}
        </div>
      )}

      {actualStr && (
        <div className="text-sm text-accent mt-1.5">
          Done: {actualStr}
        </div>
      )}

      {exercise.coaching_note && (
        <div className="text-xs text-note mt-1.5 italic whitespace-pre-line">
          {exercise.coaching_note.replace(/\\n/g, "\n")}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-cream-border flex items-center justify-between">
        <span className="text-xs text-action font-medium">
          {status === "pending" ? "Log Sets" : "Edit Sets"}
        </span>
        <span className="text-action text-sm">›</span>
      </div>
    </button>
  );
}
