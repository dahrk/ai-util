// Typed wrappers around Tauri commands. One source of truth for IPC.
//
// Build this out as the corresponding Rust commands come online (Phase 2, 5, 6, 8, 9).

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Action, AppSettings, CompletionError, Selection } from "./types";

// ── Commands ────────────────────────────────────────────────

export const getSelection = (): Promise<Selection> =>
  invoke("get_selection");

export const runCompletion = (action: Action, text: string): Promise<void> =>
  invoke("run_completion", { action, text });

export const cancelCompletion = (): Promise<void> =>
  invoke("cancel_completion");

export const pasteBack = (text: string): Promise<void> =>
  invoke("paste_back", { text });

export const hidePanel = (): Promise<void> =>
  invoke("hide_panel");

export const getSettings = (): Promise<AppSettings> =>
  invoke("get_settings");

// ── Events ──────────────────────────────────────────────────

export const onSelectionCaptured = (
  cb: (s: Selection) => void
): Promise<UnlistenFn> => listen<Selection>("selection_captured", (e) => cb(e.payload));

export const onCompletionToken = (
  cb: (token: string) => void
): Promise<UnlistenFn> =>
  listen<{ token: string }>("completion_token", (e) => cb(e.payload.token));

export const onProviderSwitched = (
  cb: (from: string, to: string) => void
): Promise<UnlistenFn> =>
  listen<{ from: string; to: string }>("provider_switched", (e) =>
    cb(e.payload.from, e.payload.to)
  );

export const onCompletionDone = (
  cb: (text: string) => void
): Promise<UnlistenFn> =>
  listen<{ text: string }>("completion_done", (e) => cb(e.payload.text));

export const onCompletionError = (
  cb: (err: CompletionError) => void
): Promise<UnlistenFn> =>
  listen<CompletionError>("completion_error", (e) => cb(e.payload));
