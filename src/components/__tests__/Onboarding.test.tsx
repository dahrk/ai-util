import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/tauri", () => ({
  getSettings: vi.fn(async () => ({
    hotkey: null,
    fireworks_key: null,
    openrouter_key: null,
    fireworks_model: null,
    openrouter_model: null,
    prompts: {},
    enabled_actions: ["summarize", "edit", "elaborate", "research"],
    onboarding_complete: false,
  })),
  probeAccessibility: vi.fn(async () => true),
  setApiKey: vi.fn(async (_p: string, k: string) => ({
    hotkey: null,
    fireworks_key: _p === "fireworks" ? k : null,
    openrouter_key: _p === "openrouter" ? k : null,
    fireworks_model: null,
    openrouter_model: null,
    prompts: {},
    enabled_actions: ["summarize", "edit", "elaborate", "research"],
    onboarding_complete: false,
  })),
  setModel: vi.fn(async () => ({
    hotkey: null,
    fireworks_key: "fw",
    openrouter_key: null,
    fireworks_model: "x",
    openrouter_model: null,
    prompts: {},
    enabled_actions: ["summarize", "edit", "elaborate", "research"],
    onboarding_complete: false,
  })),
  completeOnboarding: vi.fn(async () => ({
    hotkey: null,
    fireworks_key: "fw",
    openrouter_key: null,
    fireworks_model: "x",
    openrouter_model: null,
    prompts: {},
    enabled_actions: ["summarize", "edit", "elaborate", "research"],
    onboarding_complete: true,
  })),
  validateApiKey: vi.fn(async () => ({ ok: true, status: 200, message: null })),
}));

import Onboarding from "../../routes/Onboarding";
import {
  completeOnboarding,
  probeAccessibility,
  setApiKey,
  setModel,
} from "../../lib/tauri";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("<Onboarding />", () => {
  it("renders step 1 by default", async () => {
    render(<Onboarding />);
    await waitFor(() => expect(screen.getByTestId("step-1")).toBeInTheDocument());
  });

  it("step 1 → step 2 once accessibility is granted", async () => {
    render(<Onboarding />);
    await waitFor(() => expect(probeAccessibility).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("step-1-next")).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByTestId("step-1-next"));
    expect(screen.getByTestId("step-2")).toBeInTheDocument();
  });

  it("step 2 disables Next until Fireworks key saved", async () => {
    render(<Onboarding />);
    await waitFor(() => expect(screen.getByTestId("step-1-next")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("step-1-next"));
    expect(screen.getByTestId("step-2-next")).toBeDisabled();
    fireEvent.change(screen.getByTestId("api-key-input-fireworks"), {
      target: { value: "fw-key" },
    });
    fireEvent.click(screen.getByTestId("api-key-save-fireworks"));
    await waitFor(() => expect(setApiKey).toHaveBeenCalledWith("fireworks", "fw-key"));
    await waitFor(() => expect(screen.getByTestId("step-2-next")).not.toBeDisabled());
  });

  it("step 3 supports Skip to advance without saving an OpenRouter key", async () => {
    render(<Onboarding />);
    await waitFor(() => expect(screen.getByTestId("step-1-next")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("step-1-next"));
    fireEvent.change(screen.getByTestId("api-key-input-fireworks"), {
      target: { value: "fw-key" },
    });
    fireEvent.click(screen.getByTestId("api-key-save-fireworks"));
    await waitFor(() => expect(screen.getByTestId("step-2-next")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("step-2-next"));
    expect(screen.getByTestId("step-3")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("step-3-skip"));
    expect(screen.getByTestId("step-4")).toBeInTheDocument();
  });

  it("step 4 pre-selects the first model option per provider and finishes", async () => {
    render(<Onboarding />);
    await waitFor(() => expect(screen.getByTestId("step-1-next")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("step-1-next"));
    fireEvent.change(screen.getByTestId("api-key-input-fireworks"), {
      target: { value: "fw" },
    });
    fireEvent.click(screen.getByTestId("api-key-save-fireworks"));
    await waitFor(() => expect(screen.getByTestId("step-2-next")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("step-2-next"));
    fireEvent.click(screen.getByTestId("step-3-skip"));

    // First Fireworks model option is pre-selected.
    const firstOption = screen.getByTestId(
      "fireworks-model-accounts/fireworks/models/llama-v3p1-8b-instruct",
    );
    expect(firstOption.className).toContain("is-selected");

    fireEvent.click(screen.getByTestId("step-4-finish"));
    await waitFor(() => expect(setModel).toHaveBeenCalled());
    await waitFor(() => expect(completeOnboarding).toHaveBeenCalled());
  });
});
