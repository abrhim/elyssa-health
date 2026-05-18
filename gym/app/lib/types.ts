export interface WorkoutPlan {
  id: string;
  workout_date: string;
  session_type: string;
  cycle_day: number | null;
  cycle_phase: string | null;
  training_mode: string | null;
  rir_target: string | null;
  coach_notes: string | null;
  status: "planned" | "completed" | "partial" | "skipped";
  skip_reason: string | null;
  completion_notes: string | null;
  completed_at: string | null;
}

export interface PlannedExercise {
  id: string;
  workout_plan_id: string;
  exercise_id: string;
  exercise_order: number;
  layer: number;
  warmup_sets: { weight: number; reps: number }[] | null;
  goal_weight: number | null;
  goal_reps: number | null;
  goal_sets: number | null;
  previous_weight: number | null;
  previous_reps: number | null;
  previous_best_note: string | null;
  coaching_note: string | null;
  rest_seconds: number | null;
  is_per_hand: boolean;
  exercise: Exercise;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  is_seated: boolean;
  form_cues: string[] | null;
  notes: string | null;
}

export interface ExerciseResult {
  id: string;
  planned_exercise_id: string | null;
  exercise_id: string;
  workout_plan_id: string | null;
  workout_date: string;
  set_number: number;
  set_type: string;
  weight: number | null;
  reps: number;
  rpe: number | null;
  is_per_hand: boolean;
  notes: string | null;
  logged_by: string;
}

export interface WeekSchedule {
  day_of_week: number;
  session_type: string;
  notes: string | null;
}

export type SetInput = {
  set_number: number;
  type: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
};
