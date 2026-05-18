import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";

vi.mock("~/lib/queries", () => ({
  fetchTodayPlan: vi.fn(),
  completeWorkout: vi.fn(),
}));

import CompleteWorkout from "~/routes/complete";
import { fetchTodayPlan, completeWorkout } from "~/lib/queries";

const mockPlan = {
  id: "wp-1",
  workout_date: "2026-05-18",
  session_type: "upper_a",
  cycle_day: 5,
  cycle_phase: "follicular",
  training_mode: "performance",
  rir_target: "1-2",
  coach_notes: null,
  status: "planned" as const,
  skip_reason: null,
  completion_notes: null,
  completed_at: null,
  planned_exercises: [
    {
      id: "pe-1",
      workout_plan_id: "wp-1",
      exercise_id: "ex-1",
      exercise_order: 1,
      layer: 1,
      warmup_sets: null,
      goal_weight: 30,
      goal_reps: 12,
      goal_sets: 3,
      previous_weight: null,
      previous_reps: null,
      previous_best_note: null,
      coaching_note: null,
      rest_seconds: null,
      is_per_hand: false,
      exercise: {
        id: "ex-1",
        name: "Bench Press",
        muscle_group: "chest",
        equipment: "barbell",
        is_seated: false,
        form_cues: null,
        notes: null,
      },
    },
  ],
};

const mockResults = [
  {
    id: "r-1",
    planned_exercise_id: "pe-1",
    exercise_id: "ex-1",
    workout_plan_id: "wp-1",
    workout_date: "2026-05-18",
    set_number: 1,
    set_type: "working",
    weight: 135,
    reps: 10,
    rpe: 7,
    is_per_hand: false,
    notes: null,
    logged_by: "web_app",
  },
];

beforeEach(() => {
  vi.mocked(fetchTodayPlan).mockResolvedValue({ plan: mockPlan, results: mockResults });
  vi.mocked(completeWorkout).mockResolvedValue({ error: null });
});

function renderComplete() {
  return render(
    <MemoryRouter>
      <CompleteWorkout />
    </MemoryRouter>,
  );
}

describe("CompleteWorkout confirmation flow", () => {
  it("shows loading state initially", () => {
    renderComplete();
    expect(screen.getByText("Loading workout summary…")).toBeInTheDocument();
  });

  it("shows Finish Workout button after loading", async () => {
    renderComplete();
    await waitFor(() => {
      expect(screen.getByText("Finish Workout")).toBeInTheDocument();
    });
  });

  it("shows confirmation prompt after tapping Finish Workout", async () => {
    renderComplete();
    await waitFor(() => screen.getByText("Finish Workout"));

    fireEvent.click(screen.getByText("Finish Workout"));

    expect(screen.getByText(/Mark workout as completed\? This cannot be undone\./)).toBeInTheDocument();
    expect(screen.getByText("Go Back")).toBeInTheDocument();
    expect(screen.getByText("Yes, Finish")).toBeInTheDocument();
  });

  it("returns to initial state when Go Back is clicked in confirmation", async () => {
    renderComplete();
    await waitFor(() => screen.getByText("Finish Workout"));

    fireEvent.click(screen.getByText("Finish Workout"));
    fireEvent.click(screen.getByText("Go Back"));

    expect(screen.getByText("Finish Workout")).toBeInTheDocument();
    expect(screen.queryByText("Yes, Finish")).not.toBeInTheDocument();
  });

  it("calls completeWorkout when Yes, Finish is clicked", async () => {
    renderComplete();
    await waitFor(() => screen.getByText("Finish Workout"));

    fireEvent.click(screen.getByText("Finish Workout"));
    fireEvent.click(screen.getByText("Yes, Finish"));

    await waitFor(() => {
      expect(completeWorkout).toHaveBeenCalledWith("wp-1", "completed", undefined);
    });
  });

  it("updates confirmation text when status is changed to partial", async () => {
    renderComplete();
    await waitFor(() => screen.getByText("Finish Workout"));

    fireEvent.click(screen.getByText("Partial"));
    fireEvent.click(screen.getByText("Finish Workout"));

    expect(screen.getByText(/Mark workout as partial\?/)).toBeInTheDocument();
  });
});
