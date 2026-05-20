// The floating panel root.
//
// Subscribes to the state machine and renders the appropriate sub-view.
// Per DESIGN_BRIEF.md, transitions between sub-views are crossfades (≤200ms).
//
// Sub-views land per milestone:
//   M1: placeholder.
//   M2: ActionPicker.
//   M3: StreamingView.
//   M4: ResultView, ErrorView.

import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { usePanelStore } from "../lib/store";
import { hidePanel, onSelectionCaptured } from "../lib/tauri";

export default function Panel() {
  const { state, setSelection } = usePanelStore();

  // M2: Rust hotkey handler emits this when it has captured a selection.
  useEffect(() => {
    const unlisten = onSelectionCaptured(setSelection);
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [setSelection]);

  // Dismiss on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void hidePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Dismiss on window blur (click-outside). Tauri emits `tauri://blur` on the
  // panel window when it loses focus.
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let cancelled = false;

    const win = getCurrentWindow();
    void win
      .listen<unknown>("tauri://blur", () => {
        void hidePanel();
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlistenFn = fn;
      });

    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);

  return (
    <div className="panel-root">
      {/* M1 placeholder; sub-views ship per milestone. */}
      <div style={{ padding: "var(--panel-padding)" }}>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Panel works. State: <code>{state.kind}</code>
        </p>
      </div>
    </div>
  );
}
