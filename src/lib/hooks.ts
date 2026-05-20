// Shared React hooks. Pulled out of route/component files so the listener
// and keydown wiring patterns aren't reinvented per component.

import { useEffect } from "react";

/** A function returned by Tauri's `listen` that detaches the subscription. */
export type UnlistenFn = () => void;

/**
 * Subscribe to a Tauri event for the lifetime of the component, with proper
 * cancel-safe cleanup. `subscribe` is the wrapper from `src/lib/tauri.ts`
 * (or a raw `listen<T>(name, cb)` call) — it must accept the callback and
 * return a promise of an unlisten function.
 *
 * Why the dance: `listen()` is async, so an unmount before it resolves
 * would leak the subscription. We track a `cancelled` flag and invoke the
 * unlisten as soon as it arrives if we've already unmounted.
 */
export function useTauriEvent<TArgs extends unknown[]>(
  subscribe: (cb: (...args: TArgs) => void) => Promise<UnlistenFn>,
  callback: (...args: TArgs) => void,
  deps: unknown[],
) {
  useEffect(() => {
    let unlistenFn: UnlistenFn | undefined;
    let cancelled = false;
    void subscribe(callback).then((fn) => {
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

/**
 * One window-level `keydown` listener per call. `handlers` maps `event.key`
 * to a handler; matched keys have `preventDefault()` called automatically.
 *
 * Pass `enabled: false` to bypass — useful for components that condition
 * their keybindings on local state (e.g., ActionPicker disables shortcuts
 * when the selection is empty).
 */
export function useGlobalKeydown(
  handlers: Partial<Record<string, (e: KeyboardEvent) => void>>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const handler = handlers[e.key];
      if (!handler) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
