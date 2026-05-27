// Side-effect entrypoint: installs `window.__TEST__` once, idempotent.
// Imported by every other shim file so anywhere the app touches one of
// the @tauri-apps/* imports, `__TEST__` becomes available to Playwright.

import { dispatch, currentLabel } from "./event-bus";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  mutateSettings,
  saveSettings,
  type CompletionOverride,
  type AppSettingsShape,
} from "./state";

function install() {
  if (typeof window === "undefined") return;
  if (window.__TEST__) return;

  // Make sure logs exist even if state.ts hasn't been imported yet via
  // another path (it has, but be defensive).
  window.__TEST_CLIPBOARD__ ??= [];
  window.__TEST_OPENS__ ??= [];
  window.__TEST_PASTES__ ??= [];
  window.__TEST_HOTKEY_REREGISTERED__ ??= [];
  window.__TEST_PANEL_VISIBLE__ ??= false;
  window.__TEST_COMPLETION_OVERRIDE__ ??= null;

  window.__TEST__ = {
    reset() {
      sessionStorage.removeItem("__ai_text_actions_test_settings__");
      saveSettings({ ...DEFAULT_SETTINGS });
      window.__TEST_CLIPBOARD__.length = 0;
      window.__TEST_OPENS__.length = 0;
      window.__TEST_PASTES__.length = 0;
      window.__TEST_HOTKEY_REREGISTERED__.length = 0;
      window.__TEST_PANEL_VISIBLE__ = false;
      window.__TEST_COMPLETION_OVERRIDE__ = null;
    },
    setSettings(partial: Partial<AppSettingsShape>) {
      return mutateSettings((s) => {
        Object.assign(s, partial);
      });
    },
    getSettings() {
      return loadSettings();
    },
    emitSelectionCaptured(text: string, source_app: string | null = null) {
      dispatch("selection_captured", { text, source_app }, currentLabel());
    },
    emitPermissionRequired() {
      dispatch("permission_required", null, currentLabel());
    },
    setCompletionOverride(o: CompletionOverride | null) {
      window.__TEST_COMPLETION_OVERRIDE__ = o;
    },
    clipboard() {
      return [...window.__TEST_CLIPBOARD__];
    },
    opens() {
      return [...window.__TEST_OPENS__];
    },
    pastes() {
      return [...window.__TEST_PASTES__];
    },
    isPanelVisible() {
      return window.__TEST_PANEL_VISIBLE__;
    },
    hotkeyHistory() {
      return [...window.__TEST_HOTKEY_REREGISTERED__];
    },
    emit(name, payload) {
      dispatch(name, payload, currentLabel());
    },
    currentLabel() {
      return currentLabel();
    },
  };
}

install();
