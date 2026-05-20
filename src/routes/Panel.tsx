// The floating panel root.
//
// Subscribes to the state machine and renders the appropriate sub-view.
// **All Tauri event listeners are registered here at mount,** so that
// streaming events emitted by the Rust gateway never arrive at a
// not-yet-mounted child (listeners-before-invokes contract).

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";

import { usePanelStore } from "../lib/store";
import {
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

/** Small helper for registering a listener inside a `useEffect` with cancel safety. */
function useTauriEvent<T>(
  subscribe: ((cb: T) => Promise<() => void>) | null,
  cb: T,
  deps: unknown[],
) {
  useEffect(() => {
    if (!subscribe) return;
    let unlistenFn: (() => void) | undefined;
    let cancelled = false;
    void subscribe(cb).then((fn) => {
      if (cancelled) fn();
      else unlistenFn = fn;
    });
    return () => {
      cancelled = true;
      unlistenFn?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

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

  // Selection event subscription.
  useTauriEvent(onSelectionCaptured, (sel) => {
    setNeedsPermission(false);
    setSelection(sel);
  }, [setSelection]);

  // Permission-required subscription.
  useTauriEvent(onPermissionRequired, () => setNeedsPermission(true), []);

  // Completion event listeners — registered ONCE at mount, before any
  // `runCompletion` invocation, so the first token never beats the listener.
  useTauriEvent(onCompletionToken, (token) => appendToken(token), [appendToken]);
  useTauriEvent(
    onProviderSwitched,
    (_from, to) => {
      const next: Provider = to.toLowerCase() === "openrouter" ? "openrouter" : "fireworks";
      switchProvider(next);
      // Surface the "switching…" status briefly so the user sees the change.
      setSwitching(true);
      window.setTimeout(() => setSwitching(false), 900);
    },
    [switchProvider],
  );
  useTauriEvent(onCompletionDone, (text) => {
    setSwitching(false);
    completeResult(text);
  }, [completeResult]);
  useTauriEvent(
    onCompletionError,
    (err) => {
      setSwitching(false);
      fail(err);
    },
    [fail],
  );

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

  // Track in-flight action so accidental double-invokes are no-ops.
  const inFlight = useRef(false);
  const handlePick = useCallback(
    (action: Action) => {
      if (state.kind !== "picking") return;
      if (inFlight.current) return;

      // Offline preflight (M4 contract; we do it here so the gateway never
      // sees the request).
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
              return; // Stay in error if still offline.
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
