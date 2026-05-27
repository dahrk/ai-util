// Shim for `@tauri-apps/api/window`.
//
// Panel.tsx uses getCurrentWindow().listen("tauri://blur"|"focus", ...) to
// dismiss the panel on outside-click. In browser mode there's no real
// window blur signal we want to honor, so we register the listeners on the
// shim event bus — tests can fire them explicitly via `__TEST__.emit("tauri://blur", null)`.

import { subscribe, currentLabel, type Unlisten } from "./event-bus";
import "./index";

interface EventEnvelope<T> {
  event: string;
  payload: T;
  id: number;
  windowLabel: string;
}

interface WindowHandle {
  label: string;
  listen<T>(
    event: string,
    cb: (e: EventEnvelope<T>) => void,
  ): Promise<Unlisten>;
  hide(): Promise<void>;
  show(): Promise<void>;
  close(): Promise<void>;
}

export function getCurrentWindow(): WindowHandle {
  const label = currentLabel();
  let nextId = 1;
  return {
    label,
    listen: async <T,>(event: string, cb: (e: EventEnvelope<T>) => void) => {
      return subscribe(event, (payload) => {
        cb({ event, payload: payload as T, id: nextId++, windowLabel: label });
      });
    },
    hide: async () => {
      window.__TEST_PANEL_VISIBLE__ = false;
    },
    show: async () => {
      window.__TEST_PANEL_VISIBLE__ = true;
    },
    close: async () => {
      /* no-op */
    },
  };
}
