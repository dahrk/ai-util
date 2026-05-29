// Telemetry overlay sample buffer + delta computation.
//
// Subscribes to four Tauri events emitted by hot paths:
//   - telemetry_hotkey_received  → user pressed hotkey
//   - telemetry_panel_visible    → panel finished `show()` after capture
//   - telemetry_first_token      → first streamed token of a completion
//   - telemetry_completion_done  → completion finished successfully
//
// Computes:
//   - hotkey→visible (target <150ms)
//   - actionStart→firstToken (target <500ms)
//   - firstToken→done
//
// Buffers the last N samples in memory; the overlay renders the latest.

import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const MAX_SAMPLES = 10;

export interface TelemetrySample {
  hotkeyToVisibleMs: number | null;
  firstTokenMs: number | null;
  tokenToDoneMs: number | null;
  capturedAt: number;
}

export interface TelemetryBuffer {
  samples: TelemetrySample[];
}

export function emptyBuffer(): TelemetryBuffer {
  return { samples: [] };
}

interface InternalState {
  hotkeyAt: number | null;
  visibleAt: number | null;
  firstTokenAt: number | null;
}

function freshState(): InternalState {
  return { hotkeyAt: null, visibleAt: null, firstTokenAt: null };
}

/**
 * Accept an incoming telemetry event, returning the updated state and (when
 * a sample completes) the new sample. Pure function — exported for testing.
 */
export function reduce(
  state: InternalState,
  event: "hotkey" | "visible" | "first_token" | "done",
  ts: number,
): { state: InternalState; sample: TelemetrySample | null } {
  switch (event) {
    case "hotkey":
      // New event window. Reset prior partial samples.
      return { state: { ...freshState(), hotkeyAt: ts }, sample: null };
    case "visible":
      return { state: { ...state, visibleAt: ts }, sample: null };
    case "first_token":
      return { state: { ...state, firstTokenAt: ts }, sample: null };
    case "done": {
      const sample: TelemetrySample = {
        hotkeyToVisibleMs:
          state.hotkeyAt !== null && state.visibleAt !== null
            ? Math.max(0, state.visibleAt - state.hotkeyAt)
            : null,
        firstTokenMs:
          state.visibleAt !== null && state.firstTokenAt !== null
            ? Math.max(0, state.firstTokenAt - state.visibleAt)
            : null,
        tokenToDoneMs:
          state.firstTokenAt !== null ? Math.max(0, ts - state.firstTokenAt) : null,
        capturedAt: ts,
      };
      return { state: freshState(), sample };
    }
  }
}

/**
 * Append a sample to the buffer, evicting the oldest if at capacity. Pure.
 */
export function push(buffer: TelemetryBuffer, sample: TelemetrySample): TelemetryBuffer {
  const samples = [...buffer.samples, sample];
  while (samples.length > MAX_SAMPLES) samples.shift();
  return { samples };
}

/** Live subscription. Returns an unsubscribe function. */
export function subscribe(
  onSample: (s: TelemetrySample, buffer: TelemetryBuffer) => void,
): () => void {
  let state = freshState();
  let buf = emptyBuffer();
  const unlisteners: UnlistenFn[] = [];
  // `listen` is async; if the caller unsubscribes before the promises resolve,
  // we must still detach once they do — otherwise the listeners leak. Track a
  // cancelled flag (same pattern as `useTauriEvent`).
  let cancelled = false;
  const handle = (event: "hotkey" | "visible" | "first_token" | "done") => (payload: unknown) => {
    const ts =
      typeof payload === "number"
        ? payload
        : typeof payload === "object" && payload !== null && "payload" in payload
          ? Number((payload as { payload: unknown }).payload)
          : Date.now();
    const next = reduce(state, event, ts);
    state = next.state;
    if (next.sample) {
      buf = push(buf, next.sample);
      onSample(next.sample, buf);
    }
  };
  void Promise.all([
    listen<number>("telemetry_hotkey_received", (e) => handle("hotkey")(e.payload)),
    listen<number>("telemetry_panel_visible", (e) => handle("visible")(e.payload)),
    listen<number>("telemetry_first_token", (e) => handle("first_token")(e.payload)),
    listen<number>("telemetry_completion_done", (e) => handle("done")(e.payload)),
  ]).then((fns) => {
    if (cancelled) fns.forEach((u) => u());
    else unlisteners.push(...fns);
  });

  return () => {
    cancelled = true;
    unlisteners.forEach((u) => u());
  };
}
