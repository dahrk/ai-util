import { useCallback, useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import "./HotkeyRecorder.css";

interface Props {
  value: string | null;
  onChange: (shortcut: string) => void;
}

const MOD_PRIORITY = ["CommandOrControl", "Shift", "Alt", "Control"] as const;

/**
 * Convert a KeyboardEvent into the canonical chord string expected by
 * `tauri-plugin-global-shortcut::Shortcut::from_str`.
 *
 * Examples:
 *   { key: "j", metaKey: true, shiftKey: true }
 *     → "CommandOrControl+Shift+KeyJ"
 *   { key: "Escape", ctrlKey: true }
 *     → "Control+Escape"
 *
 * Letter and digit keys are emitted in `KeyJ` / `Digit3` form because that's
 * how `Code` in `tauri-plugin-global-shortcut` is named.
 */
export function chordFromEvent(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.metaKey || e.ctrlKey) mods.push("CommandOrControl");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey) mods.push("Alt");

  // Use the canonical Code value when available, fall back to key.
  // KeyboardEvent.code: "KeyJ", "Digit3", "Space", "Slash", etc.
  let code = e.code;
  // Ignore modifier-only presses.
  if (
    code.startsWith("Meta") ||
    code.startsWith("Control") ||
    code.startsWith("Shift") ||
    code.startsWith("Alt") ||
    code === ""
  ) {
    return null;
  }

  // Map common edge cases for friendlier display.
  if (code === "Space") code = "Space";

  // Sort modifiers consistently so equivalent chords look the same.
  mods.sort(
    (a, b) => MOD_PRIORITY.indexOf(a as never) - MOD_PRIORITY.indexOf(b as never),
  );

  if (mods.length === 0) return null; // require at least one modifier
  return [...mods, code].join("+");
}

/** Pretty-print a stored chord for display. "CommandOrControl+Shift+KeyJ" → "⌘⇧J". */
export function prettyChord(chord: string | null): string {
  if (!chord) return "Not set";
  const parts = chord.split("+");
  const sym: Record<string, string> = {
    CommandOrControl: "⌘",
    Shift: "⇧",
    Alt: "⌥",
    Control: "⌃",
  };
  return parts
    .map((p) =>
      sym[p]
        ? sym[p]
        : p.startsWith("Key")
          ? p.slice(3)
          : p.startsWith("Digit")
            ? p.slice(5)
            : p,
    )
    .join("");
}

/**
 * Record-new-hotkey input. Click "Record" to enter capture mode; the next
 * keypress with at least one modifier is canonicalized into the chord string
 * and sent to `onChange`.
 */
export function HotkeyRecorder({ value, onChange }: Props) {
  const [recording, setRecording] = useState(false);

  const stop = useCallback(() => setRecording(false), []);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      // Esc cancels without recording.
      if (e.key === "Escape") {
        e.preventDefault();
        stop();
        return;
      }
      const chord = chordFromEvent(e);
      if (!chord) return;
      e.preventDefault();
      onChange(chord);
      stop();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, onChange, stop]);

  return (
    <button
      type="button"
      className={`hotkey-recorder${recording ? " is-recording" : ""}`}
      onClick={() => setRecording((v) => !v)}
      data-testid="hotkey-recorder"
    >
      <Keyboard size={12} />
      {recording ? "Press keys…" : prettyChord(value)}
    </button>
  );
}
