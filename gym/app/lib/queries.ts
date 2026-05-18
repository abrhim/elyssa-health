import { supabase } from "./supabase";
import type { WorkoutPlan, PlannedExercise, ExerciseResult, WeekSchedule } from "./types";

const t = () => supabase.schema("training");

export async function fetchTodayPlan(date: string): Promise<{
  plan: (WorkoutPlan & { planned_exercises: PlannedExercise[] }) | null;
  results: ExerciseResult[];
}> {
  const { data: plan } = await t()
    .from("workout_plans")
    .select("*, planned_exercises(*, exercise:exercise_id(id, name, muscle_group, equipment, is_seated, form_cues, notes))")
    .eq("workout_date", date)
    .in("status", ["planned", "partial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return { plan: null, results: [] };

  // Sort exercises by exercise_order
  plan.planned_exercises.sort(
    (a: PlannedExercise, b: PlannedExercise) => a.exercise_order - b.exercise_order,
  );

  const { data: results } = await t()
    .from("exercise_results")
    .select("*")
    .eq("workout_plan_id", plan.id);

  return { plan, results: results ?? [] };
}

export async function fetchWeekSchedule(): Promise<WeekSchedule[]> {
  const { data } = await t()
    .from("week_schedule")
    .select("day_of_week, session_type, notes")
    .order("day_of_week");
  return (data ?? []) as WeekSchedule[];
}

export async function fetchPlannedExercise(planExId: string): Promise<PlannedExercise | null> {
  const { data } = await t()
    .from("planned_exercises")
    .select("*, exercise:exercise_id(id, name, muscle_group, equipment, is_seated, form_cues, notes)")
    .eq("id", planExId)
    .maybeSingle();
  return data as PlannedExercise | null;
}

export async function fetchExistingSets(planId: string, exerciseId: string): Promise<ExerciseResult[]> {
  const { data } = await t()
    .from("exercise_results")
    .select("*")
    .eq("workout_plan_id", planId)
    .eq("exercise_id", exerciseId)
    .order("set_number");
  return (data ?? []) as ExerciseResult[];
}

export async function saveSets(
  sets: {
    exercise_id: string;
    workout_plan_id: string;
    planned_exercise_id: string;
    workout_date: string;
    set_number: number;
    set_type: string;
    weight: number | null;
    reps: number;
    rpe: number | null;
    is_per_hand: boolean;
  }[],
): Promise<{ error: string | null }> {
  // Delete existing sets for this exercise/plan first (re-save pattern)
  if (sets.length > 0) {
    await t()
      .from("exercise_results")
      .delete()
      .eq("workout_plan_id", sets[0].workout_plan_id)
      .eq("exercise_id", sets[0].exercise_id);
  }

  const rows = sets.map((s) => ({ ...s, logged_by: "web_app" }));
  const { error } = await t().from("exercise_results").insert(rows);
  return { error: error?.message ?? null };
}

export async function completeWorkout(
  planId: string,
  status: "completed" | "partial" | "skipped",
  notes?: string,
): Promise<{ error: string | null }> {
  const update: Record<string, unknown> = {
    status,
    completed_at: new Date().toISOString(),
  };
  if (notes) update.completion_notes = notes;

  const { error } = await t().from("workout_plans").update(update).eq("id", planId);
  return { error: error?.message ?? null };
}

export async function fetchHistory(days: number): Promise<
  (WorkoutPlan & { planned_exercises: { count: number }[] })[]
> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];

  const { data } = await t()
    .from("workout_plans")
    .select("*, planned_exercises(count)")
    .gte("workout_date", sinceStr)
    .order("workout_date", { ascending: false });

  return (data ?? []) as (WorkoutPlan & { planned_exercises: { count: number }[] })[];
}

export async function fetchWorkoutDetail(planId: string): Promise<{
  plan: WorkoutPlan | null;
  exercises: PlannedExercise[];
  results: ExerciseResult[];
}> {
  const { data: plan } = await t()
    .from("workout_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (!plan) return { plan: null, exercises: [], results: [] };

  const [{ data: exercises }, { data: results }] = await Promise.all([
    t()
      .from("planned_exercises")
      .select("*, exercise:exercise_id(id, name, muscle_group, equipment, is_seated, form_cues, notes)")
      .eq("workout_plan_id", planId)
      .order("exercise_order"),
    t()
      .from("exercise_results")
      .select("*")
      .eq("workout_plan_id", planId)
      .order("set_number"),
  ]);

  return {
    plan: plan as WorkoutPlan,
    exercises: (exercises ?? []) as PlannedExercise[],
    results: (results ?? []) as ExerciseResult[],
  };
}
