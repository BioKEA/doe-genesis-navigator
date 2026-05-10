import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingOverlay } from "../../src/canvas/OnboardingOverlay";

const KEY = "canvas:onboarding-dismissed-v1";

describe("<OnboardingOverlay>", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("renders on first visit (no localStorage flag)", () => {
    render(<OnboardingOverlay />);
    expect(screen.getByText(/how to read this graph/i)).toBeInTheDocument();
  });

  it("does not render when localStorage flag is set", () => {
    localStorage.setItem(KEY, "1");
    const { container } = render(<OnboardingOverlay />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dismisses and persists when 'Got it' is clicked", () => {
    render(<OnboardingOverlay />);
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(screen.queryByText(/how to read this graph/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(KEY)).toBe("1");
  });

  it("dismisses on the X button too", () => {
    render(<OnboardingOverlay />);
    fireEvent.click(screen.getByLabelText(/dismiss onboarding/i));
    expect(localStorage.getItem(KEY)).toBe("1");
  });
});
