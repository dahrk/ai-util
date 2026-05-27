// Cross-module mutable state for the test-mode Tauri shim.
//
// Lives on `window` so Playwright can poke it via `page.evaluate` (e.g. to
// inject a deterministic completion override, or to read what was written
// to the fake clipboard). All keys are namespaced `__TEST_*__` for clarity.

import type { Action } from "../../../lib/types";

export interface AppSettingsShape {
  hotkey: string | null;
  fireworks_key: string | null;
  openrouter_key: string | null;
  fireworks_model: string | null;
  openrouter_model: string | null;
  prompts: Record<string, string>;
  enabled_actions: string[];
  onboarding_complete: boolean;
  dev_panel_persistent: boolean;
}

export const DEFAULT_SETTINGS: AppSettingsShape = {
  hotkey: "CommandOrControl+Shift+Space",
  fireworks_key: null,
  openrouter_key: null,
  fireworks_model: null,
  openrouter_model: null,
  prompts: {},
  enabled_actions: ["summarize", "edit", "elaborate", "research"],
  onboarding_complete: false,
  dev_panel_persistent: false,
};

const STORAGE_KEY = "__ai_text_actions_test_settings__";

/** Load settings from sessionStorage so each Playwright page starts fresh
 *  unless the test explicitly seeds state via `__TEST__.setSettings(...)`. */
export function loadSettings(): AppSettingsShape {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next: AppSettingsShape): AppSettingsShape {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** Replace settings wholesale; returned for invoke() chaining. */
export function mutateSettings(
  mutator: (s: AppSettingsShape) => void,
): AppSettingsShape {
  const cur = loadSettings();
  mutator(cur);
  saveSettings(cur);
  return cur;
}

// ── Side-effect logs (for tests to assert on) ──────────────────────────

/** Things pasted via the (mocked) paste-back command. */
declare global {
  interface Window {
    __TEST_CLIPBOARD__: { text: string; at: number }[];
    __TEST_OPENS__: string[];
    __TEST_PASTES__: string[];
    __TEST_PANEL_VISIBLE__: boolean;
    __TEST_HOTKEY_REREGISTERED__: string[];
    __TEST_COMPLETION_OVERRIDE__: CompletionOverride | null;
    __TEST__: TestApi;
  }
}

if (typeof window !== "undefined") {
  window.__TEST_CLIPBOARD__ ??= [];
  window.__TEST_OPENS__ ??= [];
  window.__TEST_PASTES__ ??= [];
  window.__TEST_HOTKEY_REREGISTERED__ ??= [];
  window.__TEST_PANEL_VISIBLE__ ??= false;
  window.__TEST_COMPLETION_OVERRIDE__ ??= null;
}

// ── Completion override (for the Panel state-machine tests) ────────────
//
// When set, the shim's run_completion uses this instead of hitting Fireworks.
// This is how the Panel spec stays fast and deterministic — real-network
// streaming lives in the Playground spec.

export type CompletionOverride =
  | {
      kind: "stream";
      // Tokens emitted one per tick. Use a few short strings for snappy tests.
      tokens: string[];
      // ms between each token emit (default 5ms).
      tokenIntervalMs?: number;
      // Optionally emit `provider_switched` after the Nth token.
      providerSwitchAfter?: { afterToken: number; to: "openrouter" | "fireworks" };
    }
  | {
      kind: "error";
      fireworks_error: string | null;
      openrouter_error: string | null;
      // Delay (ms) before the error fires (lets the panel render the
      // streaming state first if desired).
      delayMs?: number;
    };

// ── Test API exposed on window ─────────────────────────────────────────

export interface TestApi {
  /** Wipe all per-test state (settings, clipboard log, opens, etc.). */
  reset(): void;
  /** Pre-seed settings for tests that need a configured app. */
  setSettings(partial: Partial<AppSettingsShape>): AppSettingsShape;
  getSettings(): AppSettingsShape;
  /** Drive the Panel by emitting a fake `selection_captured` event. */
  emitSelectionCaptured(text: string, source_app?: string | null): void;
  /** Emulate the backend telling the panel to ask for a11y permission. */
  emitPermissionRequired(): void;
  /** Install a deterministic completion override for the next run_completion. */
  setCompletionOverride(o: CompletionOverride | null): void;
  /** Inspect side-effects. */
  clipboard(): { text: string; at: number }[];
  opens(): string[];
  pastes(): string[];
  isPanelVisible(): boolean;
  hotkeyHistory(): string[];
  /** Manually emit any event to the current window — escape hatch. */
  emit(name: string, payload: unknown): void;
  /** Convenience: which Tauri "window label" this page is pretending to be. */
  currentLabel(): string;
}

export type ActionKey = Action;
