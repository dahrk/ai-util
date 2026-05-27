// Typed wrappers around Tauri commands and events — the single source of
// truth for the IPC boundary.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Action, AppSettings, CompletionError, Selection } from "./types";

// ── Commands ────────────────────────────────────────────────

export const getSelection = (): Promise<Selection> =>
  invoke("get_selection");

// `target` is the window label that should receive streaming events. Omit
// to default to the panel window. Pass "playground" from the dev surface so
// Panel.tsx's state machine isn't disturbed.
export const runCompletion = (
  action: Action,
  text: string,
  target?: string,
): Promise<void> => invoke("run_completion", { action, text, target });

export const cancelCompletion = (): Promise<void> =>
  invoke("cancel_completion");

export const pasteBack = (text: string): Promise<void> =>
  invoke("paste_back", { text });

export const hidePanel = (): Promise<void> =>
  invoke("hide_panel");

export const getSettings = (): Promise<AppSettings> =>
  invoke("get_settings");

export const setApiKey = (
  provider: "fireworks" | "openrouter",
  key: string,
): Promise<AppSettings> => invoke("set_api_key", { provider, key });

export const setHotkey = (shortcut: string): Promise<AppSettings> =>
  invoke("set_hotkey", { shortcut });

export const setDevPanelPersistent = (value: boolean): Promise<AppSettings> =>
  invoke("set_dev_panel_persistent", { value });

export const setModel = (
  provider: "fireworks" | "openrouter",
  model: string,
): Promise<AppSettings> => invoke("set_model", { provider, model });

export const setPromptOverride = (
  action: string,
  prompt: string | null,
): Promise<AppSettings> => invoke("set_prompt_override", { action, prompt });

export const setEnabledActions = (actions: string[]): Promise<AppSettings> =>
  invoke("set_enabled_actions", { actions });

export const completeOnboarding = (): Promise<AppSettings> =>
  invoke("complete_onboarding");

export interface ValidationResult {
  ok: boolean;
  status: number | null;
  message: string | null;
}

export const validateApiKey = (
  provider: "fireworks" | "openrouter",
  key: string,
): Promise<ValidationResult> => invoke("validate_api_key", { provider, key });

export const probeAccessibility = (): Promise<boolean> =>
  invoke("probe_accessibility");

export interface ModelInfo {
  id: string;
  label: string | null;
}

export const fetchModels = (
  provider: "fireworks" | "openrouter",
): Promise<ModelInfo[]> => invoke("fetch_models", { provider });

export const showPanel = (): Promise<void> => invoke("show_panel");

// ── Events ──────────────────────────────────────────────────

export const onSelectionCaptured = (cb: (s: Selection) => void): Promise<UnlistenFn> =>
  listen<Selection>("selection_captured", (e) => cb(e.payload));

export const onPermissionRequired = (cb: () => void): Promise<UnlistenFn> =>
  listen<unknown>("permission_required", () => cb());

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
