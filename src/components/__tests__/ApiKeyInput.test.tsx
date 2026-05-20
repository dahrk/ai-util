import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ApiKeyInput } from "../ApiKeyInput";

vi.mock("../../lib/tauri", () => ({
  validateApiKey: vi.fn(),
}));

import { validateApiKey } from "../../lib/tauri";

afterEach(() => vi.clearAllMocks());

describe("<ApiKeyInput />", () => {
  it("renders empty by default with Save disabled", () => {
    render(
      <ApiKeyInput provider="fireworks" label="Fireworks" value={null} onSave={vi.fn()} />,
    );
    expect(screen.getByTestId("api-key-input-fireworks")).toHaveValue("");
    expect(screen.getByTestId("api-key-save-fireworks")).toBeDisabled();
  });

  it("Save becomes enabled when the draft differs from the saved value", () => {
    render(
      <ApiKeyInput provider="fireworks" label="Fireworks" value={null} onSave={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("api-key-input-fireworks"), {
      target: { value: "fw-key-123" },
    });
    expect(screen.getByTestId("api-key-save-fireworks")).toBeEnabled();
  });

  it("clicking Save invokes onSave with the current draft", () => {
    const onSave = vi.fn();
    render(
      <ApiKeyInput provider="fireworks" label="Fireworks" value={null} onSave={onSave} />,
    );
    fireEvent.change(screen.getByTestId("api-key-input-fireworks"), {
      target: { value: "fw-key-123" },
    });
    fireEvent.click(screen.getByTestId("api-key-save-fireworks"));
    expect(onSave).toHaveBeenCalledWith("fw-key-123");
  });

  it("Validate calls the IPC and renders the ok state on 200", async () => {
    vi.mocked(validateApiKey).mockResolvedValueOnce({
      ok: true,
      status: 200,
      message: null,
    });
    render(
      <ApiKeyInput provider="fireworks" label="Fireworks" value={null} onSave={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("api-key-input-fireworks"), {
      target: { value: "fw-key-123" },
    });
    fireEvent.click(screen.getByTestId("api-key-validate-fireworks"));
    await waitFor(() => {
      expect(screen.getByTestId("api-key-status-ok-fireworks")).toBeInTheDocument();
    });
    expect(validateApiKey).toHaveBeenCalledWith("fireworks", "fw-key-123");
  });

  it("Validate renders the error state with the message on 401", async () => {
    vi.mocked(validateApiKey).mockResolvedValueOnce({
      ok: false,
      status: 401,
      message: "Invalid API key",
    });
    render(
      <ApiKeyInput provider="openrouter" label="OpenRouter" value={null} onSave={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("api-key-input-openrouter"), {
      target: { value: "bad-key" },
    });
    fireEvent.click(screen.getByTestId("api-key-validate-openrouter"));
    await waitFor(() => {
      expect(screen.getByTestId("api-key-status-err-openrouter")).toHaveTextContent(
        "Invalid API key",
      );
    });
  });

  it("toggling reveal switches the input type between password and text", () => {
    render(
      <ApiKeyInput provider="fireworks" label="Fireworks" value="fw-key" onSave={vi.fn()} />,
    );
    const field = screen.getByTestId("api-key-input-fireworks");
    expect(field).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByLabelText("Reveal key"));
    expect(field).toHaveAttribute("type", "text");
  });
});
