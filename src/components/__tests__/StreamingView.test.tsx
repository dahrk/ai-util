import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { StreamingView } from "../StreamingView";

vi.mock("../../lib/tauri", () => ({
  cancelCompletion: vi.fn(async () => undefined),
}));

import { cancelCompletion } from "../../lib/tauri";

afterEach(() => {
  vi.clearAllMocks();
});

describe("<StreamingView />", () => {
  it("renders the action label as a progressive verb", () => {
    render(
      <StreamingView action="summarize" tokens="" provider="fireworks" />,
    );
    expect(screen.getByText(/Summarizing/i)).toBeInTheDocument();
  });

  it("renders the streamed tokens text", () => {
    render(
      <StreamingView
        action="edit"
        tokens="Hello, world"
        provider="fireworks"
      />,
    );
    expect(screen.getByText(/Hello, world/)).toBeInTheDocument();
  });

  it("shows the Fireworks status by default", () => {
    render(
      <StreamingView action="edit" tokens="" provider="fireworks" />,
    );
    expect(screen.getByText(/Generating with Fireworks/i)).toBeInTheDocument();
  });

  it("shows OpenRouter status when provider is openrouter", () => {
    render(
      <StreamingView action="edit" tokens="some" provider="openrouter" />,
    );
    expect(screen.getByText(/Generating with OpenRouter/i)).toBeInTheDocument();
  });

  it("shows the switching status when `switching` is true", () => {
    render(
      <StreamingView
        action="edit"
        tokens="some"
        provider="openrouter"
        switching
      />,
    );
    expect(screen.getByText(/Switching to OpenRouter/i)).toBeInTheDocument();
  });

  it("Cancel button invokes cancelCompletion", () => {
    render(
      <StreamingView action="edit" tokens="some" provider="fireworks" />,
    );
    fireEvent.click(screen.getByTestId("streaming-cancel"));
    expect(cancelCompletion).toHaveBeenCalledTimes(1);
  });

  it("Back button invokes onBack handler", () => {
    const onBack = vi.fn();
    render(
      <StreamingView
        action="edit"
        tokens=""
        provider="fireworks"
        onBack={onBack}
      />,
    );
    fireEvent.click(screen.getByLabelText("Back to actions"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
