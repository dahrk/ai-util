import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

import { ModelDropdown } from "../ModelDropdown";

vi.mock("../../lib/tauri", () => ({
  fetchModels: vi.fn(),
}));

import { fetchModels } from "../../lib/tauri";

afterEach(() => vi.clearAllMocks());

const mockFetchModels = fetchModels as ReturnType<typeof vi.fn>;

async function openModal(testIdPrefix: string) {
  fireEvent.click(screen.getByTestId(`${testIdPrefix}-trigger`));
  await waitFor(() => {
    expect(screen.getByTestId(`${testIdPrefix}-modal`)).toBeInTheDocument();
  });
}

describe("<ModelDropdown />", () => {
  it("shows the live list when fetch succeeds", async () => {
    mockFetchModels.mockResolvedValueOnce([
      { id: "live-a", label: "Live A" },
      { id: "live-b", label: null },
    ]);
    render(
      <ModelDropdown
        provider="fireworks"
        value="live-a"
        hasKey={true}
        onChange={vi.fn()}
        testIdPrefix="fw"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("fw-trigger")).not.toBeDisabled();
    });

    await openModal("fw");
    expect(screen.getByText("Live A")).toBeInTheDocument();
    expect(screen.getByText("live-b")).toBeInTheDocument();
    expect(mockFetchModels).toHaveBeenCalledWith("fireworks");
  });

  it("surfaces a warning when saved value isn't in the live list", async () => {
    mockFetchModels.mockResolvedValueOnce([
      { id: "current-1", label: "Current 1" },
    ]);
    render(
      <ModelDropdown
        provider="fireworks"
        value="retired-id"
        hasKey={true}
        onChange={vi.fn()}
        testIdPrefix="fw"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/no longer available/i);
    });

    // The stale value should still be reachable inside the modal so the user
    // sees what they had picked. Scope to the modal — the trigger label also
    // renders the stale id text.
    await openModal("fw");
    const modal = screen.getByTestId("fw-modal");
    expect(within(modal).getByText("retired-id")).toBeInTheDocument();
    expect(within(modal).getByText("(no longer available)")).toBeInTheDocument();
  });

  it("falls back to PROVIDER_MODELS with an offline notice when fetch rejects", async () => {
    mockFetchModels.mockRejectedValueOnce(new Error("net down"));
    render(
      <ModelDropdown
        provider="fireworks"
        value=""
        hasKey={true}
        onChange={vi.fn()}
        testIdPrefix="fw"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Couldn't load latest model list/i)).toBeInTheDocument();
    });
  });

  it("skips fetch and uses static fallback when hasKey is false", async () => {
    render(
      <ModelDropdown
        provider="fireworks"
        value=""
        hasKey={false}
        onChange={vi.fn()}
        testIdPrefix="fw"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("fw-trigger")).not.toBeDisabled();
    });
    expect(mockFetchModels).not.toHaveBeenCalled();
  });

  it("auto-fires onChange with the first model when value starts empty", async () => {
    mockFetchModels.mockResolvedValueOnce([
      { id: "auto-pick", label: "Auto Pick" },
      { id: "other", label: "Other" },
    ]);
    const onChange = vi.fn();
    render(
      <ModelDropdown
        provider="fireworks"
        value=""
        hasKey={true}
        onChange={onChange}
        testIdPrefix="fw"
      />,
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("auto-pick");
    });
  });

  it("propagates user selection via onChange when picking from the modal", async () => {
    mockFetchModels.mockResolvedValueOnce([
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ]);
    const onChange = vi.fn();
    render(
      <ModelDropdown
        provider="fireworks"
        value="a"
        hasKey={true}
        onChange={onChange}
        testIdPrefix="fw"
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("fw-trigger")).not.toBeDisabled(),
    );

    await openModal("fw");
    fireEvent.mouseDown(screen.getByText("B"));
    expect(onChange).toHaveBeenLastCalledWith("b");
    // Modal closes on pick.
    await waitFor(() => {
      expect(screen.queryByTestId("fw-modal")).not.toBeInTheDocument();
    });
  });

  it("search filters the list, Enter picks the highlighted row", async () => {
    mockFetchModels.mockResolvedValueOnce([
      { id: "alpha-model", label: null },
      { id: "beta-model", label: null },
      { id: "gamma-model", label: null },
    ]);
    const onChange = vi.fn();
    render(
      <ModelDropdown
        provider="fireworks"
        value="alpha-model"
        hasKey={true}
        onChange={onChange}
        testIdPrefix="fw"
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("fw-trigger")).not.toBeDisabled(),
    );
    await openModal("fw");

    const search = screen.getByTestId("fw-search");
    fireEvent.change(search, { target: { value: "beta" } });

    // Only beta-model should remain. Scope to the modal — the trigger button
    // still shows the currently-saved "alpha-model" outside the modal.
    const modal = screen.getByTestId("fw-modal");
    expect(within(modal).getByText("beta-model")).toBeInTheDocument();
    expect(within(modal).queryByText("alpha-model")).not.toBeInTheDocument();
    expect(within(modal).queryByText("gamma-model")).not.toBeInTheDocument();

    // Enter on the highlighted (first, beta) row.
    fireEvent.keyDown(screen.getByTestId("fw-modal"), { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("beta-model");
  });

  it("Esc closes the modal without picking", async () => {
    mockFetchModels.mockResolvedValueOnce([
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ]);
    const onChange = vi.fn();
    render(
      <ModelDropdown
        provider="fireworks"
        value="a"
        hasKey={true}
        onChange={onChange}
        testIdPrefix="fw"
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("fw-trigger")).not.toBeDisabled(),
    );
    await openModal("fw");

    fireEvent.keyDown(screen.getByTestId("fw-modal"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("fw-modal")).not.toBeInTheDocument();
    });
    // onChange was called once on mount for the auto-pick path? No — value
    // was non-empty so the auto-pick effect doesn't fire. Verify nothing
    // beyond that happened.
    expect(onChange).not.toHaveBeenCalled();
  });
});
