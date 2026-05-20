import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ErrorView } from "../ErrorView";
import { classify } from "../../lib/errorKinds";

const handlers = () => ({
  onRetry: vi.fn(),
  onDismiss: vi.fn(),
  onOpenSettings: vi.fn(),
  onUseFallback: vi.fn(),
});

describe("<ErrorView />", () => {
  it("renders both provider errors in the diagnostic log when present", () => {
    render(
      <ErrorView
        error={{
          fireworks_error: "timed out after 12s",
          openrouter_error: "503 Service Unavailable",
        }}
        {...handlers()}
      />,
    );
    const log = screen.getByTestId("error-log");
    expect(log).toHaveTextContent("Fireworks");
    expect(log).toHaveTextContent("timed out after 12s");
    expect(log).toHaveTextContent("OpenRouter");
    expect(log).toHaveTextContent("503 Service Unavailable");
  });

  it("renders only the present error when one provider is null", () => {
    render(
      <ErrorView
        error={{ fireworks_error: "boom", openrouter_error: null }}
        {...handlers()}
      />,
    );
    const log = screen.getByTestId("error-log");
    expect(log).toHaveTextContent("Fireworks");
    expect(log).not.toHaveTextContent("OpenRouter");
  });

  it("Retry button calls onRetry for both-failed", () => {
    const h = handlers();
    render(
      <ErrorView
        error={{ fireworks_error: "x", openrouter_error: "y" }}
        {...h}
      />,
    );
    fireEvent.click(screen.getByTestId("error-primary"));
    expect(h.onRetry).toHaveBeenCalled();
  });

  it("Enter triggers the primary action", () => {
    const h = handlers();
    render(
      <ErrorView
        error={{ fireworks_error: "x", openrouter_error: "y" }}
        {...h}
      />,
    );
    fireEvent.keyDown(window, { key: "Enter" });
    expect(h.onRetry).toHaveBeenCalled();
  });

  it("Esc triggers onDismiss", () => {
    const h = handlers();
    render(
      <ErrorView
        error={{ fireworks_error: "x", openrouter_error: "y" }}
        {...h}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(h.onDismiss).toHaveBeenCalled();
  });

  it("auth signal in the error string classifies as invalid-key and links to settings", () => {
    const h = handlers();
    render(
      <ErrorView
        error={{ fireworks_error: "401 Unauthorized", openrouter_error: null }}
        {...h}
      />,
    );
    expect(screen.getByText(/Open Settings/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("error-primary"));
    expect(h.onOpenSettings).toHaveBeenCalled();
  });

  it("rate-limit error routes the primary action to onUseFallback", () => {
    const h = handlers();
    render(
      <ErrorView
        error={{
          fireworks_error: "429 Too Many Requests — daily token cap",
          openrouter_error: null,
        }}
        {...h}
      />,
    );
    fireEvent.click(screen.getByTestId("error-primary"));
    expect(h.onUseFallback).toHaveBeenCalled();
  });

  it("offline message renders the You're offline header", () => {
    const h = handlers();
    render(
      <ErrorView
        error={{ fireworks_error: "You appear to be offline.", openrouter_error: null }}
        {...h}
      />,
    );
    expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
  });
});

describe("classify()", () => {
  it("offline string wins over everything", () => {
    expect(
      classify({ fireworks_error: "401 Unauthorized — but I appear to be offline.", openrouter_error: null }),
    ).toBe("no-connection");
  });
  it("auth wins over rate-limit when both signals present", () => {
    expect(
      classify({ fireworks_error: "401 Unauthorized", openrouter_error: "429 too many" }),
    ).toBe("invalid-key");
  });
  it("rate-limit when only rate-limit signal", () => {
    expect(classify({ fireworks_error: "429 rate limit", openrouter_error: null })).toBe(
      "rate-limit",
    );
  });
  it("context overflow signal", () => {
    expect(
      classify({ fireworks_error: "context_length_exceeded", openrouter_error: null }),
    ).toBe("context-overflow");
  });
  it("falls back to both-failed", () => {
    expect(classify({ fireworks_error: "boom", openrouter_error: "splat" })).toBe(
      "both-failed",
    );
  });
});
