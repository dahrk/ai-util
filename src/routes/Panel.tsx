// Floating-panel route. All streaming-event listeners are registered here
// once at mount — children read from the Zustand store. This keeps the
// listeners-before-invokes contract intact: by the time `ActionPicker`
// dispatches `runCompletion`, Panel is mounted and listening.

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";

import { useGlobalKeydown, useTauriEvent } from "../lib/hooks";
import { usePanelStore } from "../lib/store";
import {
  getSettings,
  hidePanel,
  onCompletionDone,
  onCompletionError,
  onCompletionToken,
  onPermissionRequired,
  onProviderSwitched,
  onSelectionCaptured,
  runCompletion,
} from "../lib/tauri";
import type { Action, Provider } from "../lib/types";

import { ActionPicker } from "../components/ActionPicker";
import { ErrorView } from "../components/ErrorView";
import { PermissionPrompt } from "../components/PermissionPrompt";
import { ResultView } from "../components/ResultView";
import { StreamingView } from "../components/StreamingView";
import { TelemetryOverlay } from "../components/TelemetryOverlay";

const A11Y_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

const SWITCHING_FADE_MS = 900;

export default function Panel() {
  const {
    state,
    setSelection,
    startAction,
    appendToken,
    switchProvider,
    completeResult,
    fail,
    back,
    retry,
  } = usePanelStore();

  const [needsPermission, setNeedsPermission] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [persistent, setPersistent] = useState(false);

  // Refresh the dev_panel_persistent flag on focus so toggling it in Settings
  // takes effect next time the panel is shown.
  useEffect(() => {
    const refresh = () => {
      void getSettings().then((s) => setPersistent(s.dev_panel_persistent));
    };
    refresh();
    let unlistenFn: (() => void) | undefined;
    let cancelled = false;
    void getCurrentWindow()
      .listen<unknown>("tauri://focus", refresh)
      .then((fn) => {
        if (cancelled) fn();
        else unlistenFn = fn;
      });
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
  }, []);

  useTauriEvent(
    onSelectionCaptured,
    (sel) => {
      setNeedsPermission(false);
      setSelection(sel);
    },
    [setSelection],
  );
  useTauriEvent(onPermissionRequired, () => setNeedsPermission(true), []);
  useTauriEvent(onCompletionToken, (token) => appendToken(token), [appendToken]);
  useTauriEvent(
    onProviderSwitched,
    (_from, to) => {
      const next: Provider = to.toLowerCase() === "openrouter" ? "openrouter" : "fireworks";
      switchProvider(next);
      setSwitching(true);
    },
    [switchProvider],
  );
  useTauriEvent(
    onCompletionDone,
    (text) => {
      setSwitching(false);
      completeResult(text);
    },
    [completeResult],
  );
  useTauriEvent(
    onCompletionError,
    (err) => {
      setSwitching(false);
      fail(err);
    },
    [fail],
  );

  // Auto-clear the "switching…" banner after the crossfade. Effect-based so
  // the timeout is canceled if the panel unmounts mid-fade.
  useEffect(() => {
    if (!switching) return;
    const id = window.setTimeout(() => setSwitching(false), SWITCHING_FADE_MS);
    return () => clearTimeout(id);
  }, [switching]);

  useGlobalKeydown({ Escape: () => void hidePanel() }, []);

  // Dismiss on window blur (click-outside). Wired through useTauriEvent for
  // the same cancel-safe cleanup pattern. When `dev_panel_persistent` is on,
  // skip the auto-hide so the panel stays put for inspection/dragging.
  useTauriEvent(
    (cb) => getCurrentWindow().listen<unknown>("tauri://blur", () => cb()),
    () => {
      if (persistent) return;
      void hidePanel();
    },
    [persistent],
  );

  // Track in-flight action so accidental double-invokes are no-ops.
  const inFlight = useRef(false);
  const handlePick = useCallback(
    (action: Action) => {
      if (state.kind !== "picking") return;
      if (inFlight.current) return;

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        fail({
          fireworks_error: "You appear to be offline.",
          openrouter_error: null,
        });
        return;
      }

      inFlight.current = true;
      startAction(action, "fireworks");
      void runCompletion(action, state.selection.text).finally(() => {
        inFlight.current = false;
      });
    },
    [state, startAction, fail],
  );

  const openA11y = useCallback(() => void openUrl(A11Y_URL), []);

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
    <div
      className="panel-root"
      data-tauri-drag-region={persistent ? "" : undefined}
    >
      {state.kind === "picking" && (
        <ActionPicker selection={state.selection} onPick={handlePick} />
      )}
      {state.kind === "streaming" && (
        <StreamingView
          action={state.action}
          tokens={state.tokens}
          provider={state.provider}
          switching={switching}
          onBack={back}
        />
      )}
      {state.kind === "result" && (
        <ResultView
          action={state.action}
          result={state.result}
          selection={state.selection}
          onRetry={() => {
            retry();
            void runCompletion(state.action, state.selection.text);
          }}
          onBack={back}
          onDismiss={() => void hidePanel()}
        />
      )}
      {state.kind === "error" && (
        <ErrorView
          error={state.error}
          onRetry={() => {
            if (typeof navigator !== "undefined" && navigator.onLine === false) {
              return;
            }
            if (state.action && state.selection) {
              retry();
              void runCompletion(state.action, state.selection.text);
            } else {
              back();
            }
          }}
          onDismiss={() => void hidePanel()}
        />
      )}
      {state.kind === "idle" && (
        <div style={{ padding: "var(--panel-padding)" }}>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
            Press <code>⌘⇧Space</code> to capture a selection.
          </p>
        </div>
      )}
      <TelemetryOverlay />
    </div>
  );
}
