import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ResultView } from "../ResultView";
import type { Selection } from "../../lib/types";

vi.mock("../../lib/tauri", () => ({
  pasteBack: vi.fn(async () => undefined),
}));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: vi.fn(async () => undefined),
}));

import { pasteBack } from "../../lib/tauri";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

const SEL: Selection = { text: "original sentence", source_app: null };

const handlers = () => ({
  onRetry: vi.fn(),
  onBack: vi.fn(),
  onDismiss: vi.fn(),
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("<ResultView />", () => {
  it("renders the result text", () => {
    render(
      <ResultView
        action="summarize"
        result="The summary."
        selection={SEL}
        {...handlers()}
      />,
    );
    expect(screen.getByTestId("result-text")).toHaveTextContent("The summary.");
  });

  it("Enter triggers Replace which calls pasteBack with the result", () => {
    render(
      <ResultView action="edit" result="hello" selection={SEL} {...handlers()} />,
    );
    fireEvent.keyDown(window, { key: "Enter" });
    expect(pasteBack).toHaveBeenCalledWith("hello");
  });

  it("Replace button click also calls pasteBack", () => {
    render(
      <ResultView action="edit" result="hi" selection={SEL} {...handlers()} />,
    );
    fireEvent.click(screen.getByTestId("result-replace"));
    expect(pasteBack).toHaveBeenCalledWith("hi");
  });

  it("nonEditable swaps Replace for Copy result", async () => {
    render(
      <ResultView
        action="edit"
        result="x"
        selection={SEL}
        nonEditable
        {...handlers()}
      />,
    );
    expect(screen.getByTestId("result-replace")).toHaveTextContent("Copy result");
    fireEvent.click(screen.getByTestId("result-replace"));
    expect(writeText).toHaveBeenCalledWith("x");
    expect(pasteBack).not.toHaveBeenCalled();
  });

  it("C copies the result and shows 'Copied'", async () => {
    const { waitFor } = await import("@testing-library/react");
    render(
      <ResultView action="edit" result="hi" selection={SEL} {...handlers()} />,
    );
    fireEvent.keyDown(window, { key: "c" });
    expect(writeText).toHaveBeenCalledWith("hi");
    await waitFor(() =>
      expect(screen.getByTestId("result-copy")).toHaveTextContent("Copied"),
    );
  });

  it("R triggers onRetry", () => {
    const h = handlers();
    render(
      <ResultView action="edit" result="hi" selection={SEL} {...h} />,
    );
    fireEvent.keyDown(window, { key: "r" });
    expect(h.onRetry).toHaveBeenCalled();
  });

  it("Backspace triggers onBack", () => {
    const h = handlers();
    render(
      <ResultView action="edit" result="hi" selection={SEL} {...h} />,
    );
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(h.onBack).toHaveBeenCalled();
  });

  it("Esc triggers onDismiss", () => {
    const h = handlers();
    render(
      <ResultView action="edit" result="hi" selection={SEL} {...h} />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(h.onDismiss).toHaveBeenCalled();
  });

  it("does NOT show refusal flag by default", () => {
    render(
      <ResultView
        action="edit"
        result="Here is your edit, refined."
        selection={SEL}
        {...handlers()}
      />,
    );
    expect(screen.queryByTestId("refusal-flag")).not.toBeInTheDocument();
  });

  it("shows refusal flag for 'I can't ...'", () => {
    render(
      <ResultView
        action="edit"
        result="I can't help with that request."
        selection={SEL}
        {...handlers()}
      />,
    );
    expect(screen.getByTestId("refusal-flag")).toBeInTheDocument();
  });

  it("shows refusal flag for 'I'm sorry, ...'", () => {
    render(
      <ResultView
        action="edit"
        result="I'm sorry, but that's outside policy."
        selection={SEL}
        {...handlers()}
      />,
    );
    expect(screen.getByTestId("refusal-flag")).toBeInTheDocument();
  });

  it("'Show original' toggles the SelectionPreview", () => {
    render(
      <ResultView action="edit" result="x" selection={SEL} {...handlers()} />,
    );
    expect(screen.queryByText(SEL.text)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Show original"));
    expect(screen.getByText(SEL.text)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hide original"));
    expect(screen.queryByText(SEL.text)).not.toBeInTheDocument();
  });
});
