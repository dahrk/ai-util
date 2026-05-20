import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { HotkeyRecorder, chordFromEvent, prettyChord } from "../HotkeyRecorder";

describe("chordFromEvent()", () => {
  function ev(opts: Partial<KeyboardEvent>): KeyboardEvent {
    return {
      key: "",
      code: "",
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      ...opts,
    } as KeyboardEvent;
  }

  it("canonicalizes Cmd+Shift+J", () => {
    expect(chordFromEvent(ev({ code: "KeyJ", metaKey: true, shiftKey: true }))).toBe(
      "CommandOrControl+Shift+KeyJ",
    );
  });

  it("canonicalizes Ctrl+Shift+Space", () => {
    expect(chordFromEvent(ev({ code: "Space", ctrlKey: true, shiftKey: true }))).toBe(
      "CommandOrControl+Shift+Space",
    );
  });

  it("requires at least one modifier", () => {
    expect(chordFromEvent(ev({ code: "KeyJ" }))).toBeNull();
  });

  it("ignores modifier-only presses", () => {
    expect(chordFromEvent(ev({ code: "MetaLeft", metaKey: true }))).toBeNull();
    expect(chordFromEvent(ev({ code: "ShiftLeft", shiftKey: true }))).toBeNull();
  });

  it("preserves order: CommandOrControl > Shift > Alt > Control", () => {
    expect(
      chordFromEvent(ev({ code: "KeyA", metaKey: true, shiftKey: true, altKey: true })),
    ).toBe("CommandOrControl+Shift+Alt+KeyA");
  });
});

describe("prettyChord()", () => {
  it("renders symbols and strips Key prefix", () => {
    expect(prettyChord("CommandOrControl+Shift+KeyJ")).toBe("⌘⇧J");
  });
  it("renders digits", () => {
    expect(prettyChord("CommandOrControl+Digit5")).toBe("⌘5");
  });
  it("falls back gracefully", () => {
    expect(prettyChord(null)).toBe("Not set");
  });
});

describe("<HotkeyRecorder />", () => {
  it("enters recording mode on click and captures the next chord", () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("hotkey-recorder"));
    expect(screen.getByText("Press keys…")).toBeInTheDocument();
    fireEvent.keyDown(window, {
      code: "KeyJ",
      metaKey: true,
      shiftKey: true,
    });
    expect(onChange).toHaveBeenCalledWith("CommandOrControl+Shift+KeyJ");
    // Recording stopped, label restored.
    expect(screen.queryByText("Press keys…")).not.toBeInTheDocument();
  });

  it("Esc cancels recording without invoking onChange", () => {
    const onChange = vi.fn();
    render(<HotkeyRecorder value="CommandOrControl+Shift+Space" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("hotkey-recorder"));
    fireEvent.keyDown(window, { code: "Escape", key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("displays the prettified current value when not recording", () => {
    render(<HotkeyRecorder value="CommandOrControl+Shift+Space" onChange={() => undefined} />);
    expect(screen.getByText("⌘⇧Space")).toBeInTheDocument();
  });
});
