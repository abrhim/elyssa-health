import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { ExerciseCard } from "~/components/ExerciseCard";
import type { PlannedExercise, ExerciseResult } from "~/lib/types";

const mockExercise: PlannedExercise = {
  id: "pe-1",
  workout_plan_id: "wp-1",
  exercise_id: "ex-1",
  exercise_order: 1,
  layer: 1,
  warmup_sets: null,
  goal_weight: 30,
  goal_reps: 12,
  goal_sets: 3,
  previous_weight: 25,
  previous_reps: 12,
  previous_best_note: null,
  coaching_note: null,
  rest_seconds: null,
  is_per_hand: false,
  exercise: {
    id: "ex-1",
    name: "Dead Bug",
    muscle_group: "core",
    equipment: "bodyweight",
    is_seated: false,
    form_cues: null,
    notes: null,
  },
};

function makeResult(overrides: Partial<ExerciseResult> = {}): ExerciseResult {
  return {
    id: "r-1",
    planned_exercise_id: "pe-1",
    exercise_id: "ex-1",
    workout_plan_id: "wp-1",
    workout_date: "2026-05-18",
    set_number: 1,
    set_type: "working",
    weight: 30,
    reps: 12,
    rpe: 7,
    is_per_hand: false,
    notes: null,
    logged_by: "web_app",
    ...overrides,
  };
}

const noop = () => {};

function renderCard(results: ExerciseResult[] = [], expanded = false) {
  return render(
    <MemoryRouter>
      <ExerciseCard
        exercise={mockExercise}
        results={results}
        expanded={expanded}
        onToggle={noop}
        onSaved={noop}
      />
    </MemoryRouter>,
  );
}

describe("ExerciseCard", () => {
  it("shows 'Not started' status when no results exist", () => {
    renderCard([]);
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("shows 'In progress' status when some results logged", () => {
    renderCard([makeResult()]);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("shows 'Logged' status when all sets done", () => {
    const results = [
      makeResult({ id: "r-1", set_number: 1 }),
      makeResult({ id: "r-2", set_number: 2 }),
      makeResult({ id: "r-3", set_number: 3 }),
    ];
    renderCard(results);
    expect(screen.getByText("Logged")).toBeInTheDocument();
  });

  it("displays exercise name and goal", () => {
    renderCard([]);
    expect(screen.getByText("Dead Bug")).toBeInTheDocument();
    expect(screen.getByText("30 lbs × 12 × 3")).toBeInTheDocument();
  });

  it("shows previous performance when available", () => {
    renderCard([]);
    expect(screen.getByText(/Prev: 25 lbs/)).toBeInTheDocument();
  });

  it("shows set inputs when expanded", () => {
    renderCard([], true);
    expect(screen.getByText("Save Sets")).toBeInTheDocument();
    expect(screen.getByText("+ Add Set")).toBeInTheDocument();
  });

  it("shows done results when collapsed", () => {
    renderCard([makeResult()]);
    expect(screen.getByText("Done: 30×12")).toBeInTheDocument();
  });
});
