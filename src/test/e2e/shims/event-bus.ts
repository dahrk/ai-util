// Event bus for the test-mode shim. Mirrors Tauri's `emit_to(label, ...)`
// semantics: each page acts as one "window" identified by a label derived
// from its route. Events targeted at a different label are dropped — this
// is how the backend keeps Playground tokens from leaking into the Panel
// state machine.

export type Unlisten = () => void;
export type Listener = (payload: unknown) => void;

interface SubKey {
  event: string;
  listener: Listener;
}

const subs: SubKey[] = [];

/** Compute the window label for this page from `location.pathname`.
 *  Matches the Tauri config's window labels in src-tauri/tauri.conf.json. */
export function currentLabel(): string {
  if (typeof window === "undefined") return "panel";
  const p = window.location.pathname;
  if (p.startsWith("/playground")) return "playground";
  if (p.startsWith("/settings")) return "settings";
  if (p.startsWith("/onboarding")) return "onboarding";
  return "panel";
}

/** Subscribe. Returns an unlisten fn matching @tauri-apps/api/event's shape. */
export function subscribe(event: string, listener: Listener): Unlisten {
  const k = { event, listener };
  subs.push(k);
  return () => {
    const i = subs.indexOf(k);
    if (i !== -1) subs.splice(i, 1);
  };
}

/**
 * Dispatch an event. `target` follows the Tauri convention: when omitted,
 * the event is delivered to this window unconditionally. When provided, the
 * event is dropped unless it matches the current page's label.
 */
export function dispatch(event: string, payload: unknown, target?: string) {
  if (target && target !== currentLabel()) return;
  // Snapshot to avoid mutation-during-iteration if a handler unsubscribes.
  const snapshot = subs.filter((s) => s.event === event);
  for (const s of snapshot) {
    try {
      s.listener(payload);
    } catch (e) {
      // Don't let one bad listener kill the bus.
      // eslint-disable-next-line no-console
      console.error("[shim event-bus] listener threw:", e);
    }
  }
}
