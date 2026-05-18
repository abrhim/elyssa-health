import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge, WorkoutStatusBadge } from "~/components/StatusBadge";

describe("StatusBadge", () => {
  it("shows 'Not started' text for pending status", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("shows 'In progress' text for in_progress status", () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("shows 'Logged' text for done status", () => {
    render(<StatusBadge status="done" />);
    expect(screen.getByText("Logged")).toBeInTheDocument();
  });

  it("renders a colored dot alongside the text", () => {
    const { container } = render(<StatusBadge status="done" />);
    const dot = container.querySelector(".rounded-full");
    expect(dot).toBeInTheDocument();
    expect(screen.getByText("Logged")).toBeInTheDocument();
  });
});

describe("WorkoutStatusBadge", () => {
  it("renders status text", () => {
    render(<WorkoutStatusBadge status="completed" />);
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("renders unknown status with planned styling", () => {
    render(<WorkoutStatusBadge status="unknown" />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
