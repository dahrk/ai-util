import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ActionPicker } from "../ActionPicker";
import type { Selection } from "../../lib/types";

const SEL: Selection = { text: "An example paragraph.", source_app: "TextEdit" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<ActionPicker />", () => {
  it("renders all four action buttons with their labels and shortcut chips", () => {
    render(<ActionPicker selection={SEL} onPick={() => undefined} />);
    expect(screen.getByText("Summarize")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Elaborate")).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    // Shortcut chips 1-4 render.
    ["1", "2", "3", "4"].forEach((n) => expect(screen.getByText(n)).toBeInTheDocument());
  });

  it("renders the selection preview", () => {
    render(<ActionPicker selection={SEL} onPick={() => undefined} />);
    expect(screen.getByText(SEL.text)).toBeInTheDocument();
  });

  it("invokes onPick with the correct action when a number key is pressed", () => {
    const onPick = vi.fn();
    render(<ActionPicker selection={SEL} onPick={onPick} />);
    fireEvent.keyDown(window, { key: "2" });
    expect(onPick).toHaveBeenCalledWith("edit");
  });

  it("ArrowDown cycles focus and Enter activates the focused row", () => {
    const onPick = vi.fn();
    render(<ActionPicker selection={SEL} onPick={onPick} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith("edit");
  });

  it("ArrowUp wraps from the top to the last item", () => {
    const onPick = vi.fn();
    render(<ActionPicker selection={SEL} onPick={onPick} />);
    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith("research");
  });

  it("clicking a button calls onPick with the right action", () => {
    const onPick = vi.fn();
    render(<ActionPicker selection={SEL} onPick={onPick} />);
    fireEvent.click(screen.getByText("Elaborate"));
    expect(onPick).toHaveBeenCalledWith("elaborate");
  });

  it("renders the empty-selection branch for whitespace-only text", () => {
    render(
      <ActionPicker
        selection={{ text: "   \n\t  ", source_app: null }}
        onPick={() => undefined}
      />,
    );
    expect(screen.getByText("Select some text first")).toBeInTheDocument();
    expect(screen.getByTestId("empty-dismiss")).toBeInTheDocument();
    // Action buttons should NOT render.
    expect(screen.queryByText("Summarize")).not.toBeInTheDocument();
  });

  it("number-key shortcuts do not fire when selection is empty", () => {
    const onPick = vi.fn();
    render(
      <ActionPicker selection={{ text: "", source_app: null }} onPick={onPick} />,
    );
    fireEvent.keyDown(window, { key: "1" });
    expect(onPick).not.toHaveBeenCalled();
  });
});
