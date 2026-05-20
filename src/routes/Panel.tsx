// The floating panel root.
//
// Subscribes to the state machine and renders the appropriate sub-view.
// Sub-views land per milestone:
//   M1: empty placeholder.
//   M2: ActionPicker, EmptySelection, PermissionPrompt.
//   M3: StreamingView.
//   M4: ResultView, ErrorView.
//
// All Tauri event listeners are registered HERE (mount-time) so that streaming
// events emitted by the Rust gateway never arrive at a not-yet-mounted child.

import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";

import { usePanelStore } from "../lib/store";
import {
  hidePanel,
  onPermissionRequired,
  onSelectionCaptured,
} from "../lib/tauri";
import type { Action } from "../lib/types";

import { ActionPicker } from "../components/ActionPicker";
import { PermissionPrompt } from "../components/PermissionPrompt";

const A11Y_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

export default function Panel() {
  const { state, setSelection } = usePanelStore();
  const [needsPermission, setNeedsPermission] = useState(false);

  // Selection event subscription — clears the permission prompt if present.
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let cancelled = false;
    void onSelectionCaptured((sel) => {
      setNeedsPermission(false);
      setSelection(sel);
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenFn = fn;
    });
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, [setSelection]);

  // Permission-required subscription.
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let cancelled = false;
    void onPermissionRequired(() => setNeedsPermission(true)).then((fn) => {
      if (cancelled) fn();
      else unlistenFn = fn;
    });
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);

  // Dismiss on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void hidePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Dismiss on window blur (click-outside).
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

  const handlePick = useCallback((action: Action) => {
    // M3 will dispatch startAction + runCompletion here.
    // M2 logs and is otherwise a no-op so the picker is testable.
    // eslint-disable-next-line no-console
    console.log("action picked:", action);
  }, []);

  const openA11y = useCallback(() => {
    void openUrl(A11Y_URL);
  }, []);

  if (needsPermission) {
    return (
      <div className="panel-root">
        <PermissionPrompt
          onOpenSettings={openA11y}
          onDismiss={() => void hidePanel()}
        />
      </div>
    );
  }

  return (
    <div className="panel-root">
      {state.kind === "picking" && (
        <ActionPicker selection={state.selection} onPick={handlePick} />
      )}
      {state.kind === "idle" && (
        <div style={{ padding: "var(--panel-padding)" }}>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Press <code>⌘⇧Space</code> to capture a selection.
          </p>
        </div>
      )}
      {/* M3: streaming view */}
      {/* M4: result + error views */}
    </div>
  );
}
