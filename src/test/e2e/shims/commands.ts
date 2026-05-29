// Dispatch table for `invoke(commandName, args)`.
//
// Mirrors the Tauri command surface in src-tauri/src/commands/*. Each entry
// has the same return shape as the real backend so the frontend doesn't
// know the difference.
//
// Notable mirror points:
//   - run_completion spawns an async task and emits stream events;
//     `Ok(())` is returned synchronously
//   - validate_api_key / fetch_models hit real network (Fireworks CORS OK)
//   - paste_back / clipboard.writeText record into `__TEST_*__` arrays so
//     tests can assert on side-effects

import { PROVIDER_MODELS } from "../../../lib/models";
import { buildMessages, maxTokensFor } from "./prompts";
import {
  fetchModels as fetchModelsLive,
  streamCompletion,
  validateKey,
} from "./fireworks";
import { dispatch } from "./event-bus";
import {
  loadSettings,
  mutateSettings,
  type AppSettingsShape,
} from "./state";
import type { Action } from "../../../lib/types";

type Args = Record<string, unknown>;

let activeAbort: AbortController | null = null;

function unknownProvider(p: unknown): string {
  return `unknown provider: ${String(p)}`;
}

/** Backend `now_ms` helper analog. */
function nowMs(): number {
  return Date.now();
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

// ── command handlers ──────────────────────────────────────────────────

async function get_settings(): Promise<AppSettingsShape> {
  return loadSettings();
}

async function set_api_key({ provider, key }: Args): Promise<AppSettingsShape> {
  return mutateSettings((s) => {
    const value = (key as string).length === 0 ? null : (key as string);
    if (provider === "fireworks") s.fireworks_key = value;
    else if (provider === "openrouter") s.openrouter_key = value;
    else throw new Error(unknownProvider(provider));
  });
}

async function set_hotkey({ shortcut }: Args): Promise<AppSettingsShape> {
  const next = mutateSettings((s) => {
    s.hotkey = shortcut as string;
  });
  window.__TEST_HOTKEY_REREGISTERED__.push(shortcut as string);
  return next;
}

async function set_model({ provider, model }: Args): Promise<AppSettingsShape> {
  return mutateSettings((s) => {
    const value = (model as string).length === 0 ? null : (model as string);
    if (provider === "fireworks") s.fireworks_model = value;
    else if (provider === "openrouter") s.openrouter_model = value;
    else throw new Error(unknownProvider(provider));
  });
}

async function set_prompt_override({
  action,
  prompt,
}: Args): Promise<AppSettingsShape> {
  return mutateSettings((s) => {
    const a = action as string;
    if (typeof prompt === "string" && prompt.trim().length > 0) {
      s.prompts[a] = prompt;
    } else {
      delete s.prompts[a];
    }
  });
}

async function set_enabled_actions({
  actions,
}: Args): Promise<AppSettingsShape> {
  return mutateSettings((s) => {
    s.enabled_actions = actions as string[];
  });
}

async function set_dev_panel_persistent({
  value,
}: Args): Promise<AppSettingsShape> {
  return mutateSettings((s) => {
    s.dev_panel_persistent = value as boolean;
  });
}

async function complete_onboarding(): Promise<AppSettingsShape> {
  return mutateSettings((s) => {
    s.onboarding_complete = true;
  });
}

async function validate_api_key({ provider, key }: Args) {
  return validateKey(provider as "fireworks" | "openrouter", key as string);
}

async function fetch_models({ provider }: Args) {
  const settings = loadSettings();
  const key =
    provider === "fireworks" ? settings.fireworks_key : settings.openrouter_key;
  if (!key) {
    // Match the real backend behavior: return static fallback if no key.
    return PROVIDER_MODELS[provider as "fireworks" | "openrouter"].map((m) => ({
      id: m.id,
      label: m.label,
    }));
  }
  // A thrown error propagates to the frontend, which falls back to the static
  // list — preserving that path exercises the offline UX under flaky network.
  return await fetchModelsLive(provider as "fireworks" | "openrouter", key);
}

async function probe_accessibility(): Promise<boolean> {
  // No OS to probe in browser mode. Always grant — onboarding step 1 advances.
  return true;
}

async function get_selection() {
  return { text: "", source_app: null };
}

async function show_panel(): Promise<void> {
  window.__TEST_PANEL_VISIBLE__ = true;
}

async function hide_panel(): Promise<void> {
  window.__TEST_PANEL_VISIBLE__ = false;
}

async function paste_back({ text }: Args): Promise<void> {
  window.__TEST_PASTES__.push(text as string);
  // Real backend also writes to the clipboard on completion; paste-back
  // doesn't touch the clipboard itself. Mirror that here.
}

async function cancel_completion(): Promise<void> {
  if (activeAbort) {
    activeAbort.abort();
    activeAbort = null;
  }
}

async function run_completion({ action, text, target }: Args): Promise<void> {
  const targetLabel =
    (typeof target === "string" && target.length > 0 ? target : "panel") ||
    "panel";

  // Cancel any in-flight call — mirrors the backend's cancel-and-replace.
  if (activeAbort) activeAbort.abort();
  const abort = new AbortController();
  activeAbort = abort;

  const settings = loadSettings();
  if (!settings.fireworks_key && !settings.openrouter_key) {
    dispatch(
      "completion_error",
      {
        fireworks_error: "No Fireworks key configured.",
        openrouter_error: "No OpenRouter key configured.",
      },
      targetLabel,
    );
    return;
  }

  // Background — return Ok(()) immediately to match the backend's signature.
  void (async () => {
    const override = window.__TEST_COMPLETION_OVERRIDE__;

    // ── deterministic mock path ─────────────────────────────────────
    if (override) {
      try {
        if (override.kind === "error") {
          if (override.delayMs) await sleep(override.delayMs, abort.signal);
          dispatch(
            "completion_error",
            {
              fireworks_error: override.fireworks_error,
              openrouter_error: override.openrouter_error,
            },
            targetLabel,
          );
          return;
        }
        // stream
        const tokens = override.tokens;
        const interval = override.tokenIntervalMs ?? 5;
        let buf = "";
        let firstEmitted = false;
        for (let i = 0; i < tokens.length; i++) {
          if (abort.signal.aborted) return;
          if (
            override.providerSwitchAfter &&
            i === override.providerSwitchAfter.afterToken
          ) {
            dispatch(
              "provider_switched",
              {
                from: "fireworks",
                to: override.providerSwitchAfter.to,
              },
              targetLabel,
            );
            buf = ""; // mirror gateway contract: reset before first new-provider token
          }
          if (i > 0) await sleep(interval, abort.signal);
          if (!firstEmitted) {
            firstEmitted = true;
            dispatch("telemetry_first_token", nowMs(), targetLabel);
          }
          dispatch("completion_token", { token: tokens[i] }, targetLabel);
          buf += tokens[i];
        }
        // Auto-clipboard mirror of backend behavior.
        window.__TEST_CLIPBOARD__.push({ text: buf, at: nowMs() });
        dispatch("telemetry_completion_done", nowMs(), targetLabel);
        dispatch("completion_done", { text: buf }, targetLabel);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          dispatch(
            "completion_error",
            { fireworks_error: String(e), openrouter_error: null },
            targetLabel,
          );
        }
      } finally {
        if (activeAbort === abort) activeAbort = null;
      }
      return;
    }

    // ── real Fireworks path ─────────────────────────────────────────
    const model =
      settings.fireworks_model ?? PROVIDER_MODELS.fireworks[0].id;
    const messages = buildMessages(
      action as Action,
      text as string,
      settings.prompts[action as string] ?? null,
    );
    let firstEmitted = false;
    let buf = "";
    try {
      buf = await streamCompletion({
        provider: "fireworks",
        apiKey: settings.fireworks_key!,
        model,
        messages,
        maxTokens: maxTokensFor(action as Action, (text as string).length),
        signal: abort.signal,
        onToken: (tok) => {
          if (!firstEmitted) {
            firstEmitted = true;
            dispatch("telemetry_first_token", nowMs(), targetLabel);
          }
          dispatch("completion_token", { token: tok }, targetLabel);
        },
      });
      window.__TEST_CLIPBOARD__.push({ text: buf, at: nowMs() });
      dispatch("telemetry_completion_done", nowMs(), targetLabel);
      dispatch("completion_done", { text: buf }, targetLabel);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      dispatch(
        "completion_error",
        {
          fireworks_error: String(e),
          openrouter_error: settings.openrouter_key
            ? "OpenRouter fallback not implemented in browser shim."
            : null,
        },
        targetLabel,
      );
    } finally {
      if (activeAbort === abort) activeAbort = null;
    }
  })();
}

// ── dispatch table ────────────────────────────────────────────────────

const HANDLERS: Record<string, (a: Args) => Promise<unknown>> = {
  get_settings,
  set_api_key,
  set_hotkey,
  set_model,
  set_prompt_override,
  set_enabled_actions,
  set_dev_panel_persistent,
  complete_onboarding,
  validate_api_key,
  fetch_models,
  probe_accessibility,
  get_selection,
  show_panel,
  hide_panel,
  paste_back,
  run_completion,
  cancel_completion,
};

export async function dispatchInvoke(
  cmd: string,
  args: Args | undefined,
): Promise<unknown> {
  const h = HANDLERS[cmd];
  if (!h) {
    // Keep the message close to the Tauri runtime error so frontends that
    // surface it get something recognizable.
    throw new Error(`shim: no handler for command "${cmd}"`);
  }
  return h(args ?? {});
}

// Re-export for window.__TEST__.currentLabel().
export { currentLabel } from "./event-bus";
