import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmationBanner } from "~/components/ConfirmationBanner";

describe("ConfirmationBanner", () => {
  it("displays the provided message", () => {
    render(<ConfirmationBanner message="Dead Bug sets saved" onDismiss={() => {}} />);
    expect(screen.getByText("Dead Bug sets saved")).toBeInTheDocument();
  });

  it("shows a checkmark indicator", () => {
    render(<ConfirmationBanner message="Sets saved" onDismiss={() => {}} />);
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<ConfirmationBanner message="Sets saved" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText("Dismiss confirmation"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("has an accessible dismiss button", () => {
    render(<ConfirmationBanner message="Sets saved" onDismiss={() => {}} />);
    expect(screen.getByLabelText("Dismiss confirmation")).toBeInTheDocument();
  });
});
