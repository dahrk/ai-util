// Shim for `@tauri-apps/api/event`.
//
// The real API wraps every payload in `{ event, payload, id, windowLabel }`.
// Our app code uses `e.payload`, so we replicate that envelope here.

import { subscribe, dispatch, currentLabel, type Unlisten } from "./event-bus";
import "./index";

export type UnlistenFn = () => void;

interface EventEnvelope<T> {
  event: string;
  payload: T;
  id: number;
  windowLabel: string;
}

let nextId = 1;

export async function listen<T>(
  event: string,
  cb: (e: EventEnvelope<T>) => void,
): Promise<UnlistenFn> {
  const un: Unlisten = subscribe(event, (payload) => {
    cb({
      event,
      payload: payload as T,
      id: nextId++,
      windowLabel: currentLabel(),
    });
  });
  return un;
}

export async function emit(event: string, payload?: unknown): Promise<void> {
  dispatch(event, payload, currentLabel());
}
