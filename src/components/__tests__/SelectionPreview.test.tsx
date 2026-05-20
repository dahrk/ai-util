import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LONG_SELECTION_THRESHOLD, SelectionPreview } from "../SelectionPreview";

const make = (n: number) => "x".repeat(n);

describe("<SelectionPreview />", () => {
  it("renders the text", () => {
    render(<SelectionPreview text="hello" />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("does not show the long-selection badge for normal selections", () => {
    render(<SelectionPreview text="hello world" />);
    expect(screen.queryByTestId("long-selection-badge")).not.toBeInTheDocument();
  });

  it("auto-shows the long-selection badge when text exceeds the threshold", () => {
    render(<SelectionPreview text={make(LONG_SELECTION_THRESHOLD + 1)} />);
    expect(screen.getByTestId("long-selection-badge")).toBeInTheDocument();
  });

  it("respects an explicit longSelection prop override", () => {
    render(<SelectionPreview text="short" longSelection />);
    expect(screen.getByTestId("long-selection-badge")).toBeInTheDocument();
  });

  it("truncates inline text past the inline limit", () => {
    const text = make(500);
    render(<SelectionPreview text={text} />);
    // The original text length is 500; the rendered inline span ends with ellipsis.
    // We can't easily query by partial DOM, but the badge appears for long selections.
    // Sanity: the inline text element exists.
    const preview = screen.getByText((content) => content.endsWith("…"));
    expect(preview).toBeInTheDocument();
  });
});
