import type { PlannedExercise } from "./types";

export function isTimed(exercise: PlannedExercise): boolean {
  return exercise.goal_weight === null && exercise.goal_reps === null;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}:${String(Math.round(s)).padStart(2, "0")}` : `${m}:00`;
}

export function parseDuration(str: string): number | null {
  if (!str) return null;
  const parts = str.split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (isNaN(m) || isNaN(s)) return null;
    return m * 60 + s;
  }
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}
