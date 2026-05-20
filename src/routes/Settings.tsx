// Settings window. Hotkey, API keys, default model per provider, enable
// /disable per action, and per-action prompt override (`{text}`
// interpolation) with "Restore default" to clear an override.

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

import { ActionIcon } from "../components/ActionIcon";
import { ApiKeyInput } from "../components/ApiKeyInput";
import { HotkeyRecorder } from "../components/HotkeyRecorder";
import { defaultModelId } from "../lib/models";
import {
  getSettings,
  setApiKey,
  setEnabledActions,
  setHotkey,
  setModel,
  setPromptOverride,
} from "../lib/tauri";
import { ACTIONS, ACTION_META, type Action, type AppSettings } from "../lib/types";
import "./Settings.css";

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  if (!settings) {
    return (
      <div className="settings">
        <div className="settings__loading">Loading…</div>
      </div>
    );
  }

  const applied = (next: AppSettings) => setSettings(next);

  return (
    <div className="settings">
      <header className="settings__header">
        <h1>Settings</h1>
      </header>

      <Section title="Hotkey" hint="Press the keys you'd like to use to open the panel.">
        <HotkeyRecorder
          value={settings.hotkey}
          onChange={async (chord) => {
            try {
              const next = await setHotkey(chord);
              applied(next);
            } catch (e) {
              console.error("set hotkey failed:", e);
            }
          }}
        />
      </Section>

      <Section title="API keys" hint="Fireworks is required. OpenRouter is an optional fallback.">
        <ApiKeyInput
          provider="fireworks"
          label="Fireworks"
          helpUrl="https://fireworks.ai/account/api-keys"
          value={settings.fireworks_key}
          onSave={async (k) => applied(await setApiKey("fireworks", k))}
        />
        <ApiKeyInput
          provider="openrouter"
          label="OpenRouter"
          helpUrl="https://openrouter.ai/keys"
          value={settings.openrouter_key}
          onSave={async (k) => applied(await setApiKey("openrouter", k))}
        />
      </Section>

      <Section title="Default models" hint="Per-provider model used unless overridden.">
        <ModelField
          label="Fireworks"
          value={settings.fireworks_model ?? defaultModelId("fireworks")}
          onSave={async (m) => applied(await setModel("fireworks", m))}
        />
        <ModelField
          label="OpenRouter"
          value={settings.openrouter_model ?? defaultModelId("openrouter")}
          onSave={async (m) => applied(await setModel("openrouter", m))}
        />
      </Section>

      <Section title="Actions" hint="Enable/disable actions and edit their default prompt.">
        <ActionList
          enabled={settings.enabled_actions}
          prompts={settings.prompts}
          onToggle={async (next) => applied(await setEnabledActions(next))}
          onPromptChange={async (action, prompt) =>
            applied(await setPromptOverride(action, prompt))
          }
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings__section">
      <div className="settings__section-head">
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
      <div className="settings__section-body">{children}</div>
    </section>
  );
}

function ModelField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (model: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="settings__row">
      <label className="settings__row-label">{label}</label>
      <input
        type="text"
        className="settings__row-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft);
        }}
        spellCheck={false}
        data-testid={`model-input-${label.toLowerCase()}`}
      />
    </div>
  );
}

function ActionList({
  enabled,
  prompts,
  onToggle,
  onPromptChange,
}: {
  enabled: string[];
  prompts: Record<string, string>;
  onToggle: (next: string[]) => void;
  onPromptChange: (action: Action, prompt: string | null) => void;
}) {
  const toggle = useCallback(
    (a: Action) => {
      const isOn = enabled.includes(a);
      const next = isOn ? enabled.filter((x) => x !== a) : [...enabled, a];
      onToggle(next);
    },
    [enabled, onToggle],
  );

  const isEnabled = (a: Action) => enabled.includes(a);

  return (
    <ul className="settings__actions">
      {ACTIONS.map((action) => {
        const meta = ACTION_META[action];
        return (
          <li key={action} className="settings__action">
            <div className="settings__action-row">
              <span className="settings__action-icon">
                <ActionIcon action={action} />
              </span>
              <div className="settings__action-text">
                <div className="settings__action-label">{meta.label}</div>
                <div className="settings__action-hint">{meta.hint}</div>
              </div>
              <label className="settings__toggle">
                <input
                  type="checkbox"
                  checked={isEnabled(action)}
                  onChange={() => toggle(action)}
                  data-testid={`action-toggle-${action}`}
                />
                <span>{isEnabled(action) ? "Enabled" : "Disabled"}</span>
              </label>
            </div>
            <PromptOverride
              action={action}
              value={prompts[action] ?? ""}
              onChange={(p) => onPromptChange(action, p)}
            />
          </li>
        );
      })}
    </ul>
  );
}

function PromptOverride({
  action,
  value,
  onChange,
}: {
  action: Action;
  value: string;
  onChange: (prompt: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  const hasOverride = value.length > 0;
  return (
    <div className="settings__prompt">
      <textarea
        className="settings__prompt-input"
        value={draft}
        placeholder="Override the default prompt. Use {text} to interpolate the selection."
        rows={2}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        data-testid={`prompt-input-${action}`}
      />
      <div className="settings__prompt-actions">
        <button
          type="button"
          className="settings__prompt-restore"
          onClick={() => {
            setDraft("");
            onChange(null);
          }}
          disabled={!hasOverride && !draft}
          data-testid={`prompt-restore-${action}`}
        >
          <RotateCcw size={11} /> Restore default
        </button>
        <button
          type="button"
          className="settings__prompt-save"
          onClick={() => onChange(draft.trim() ? draft : null)}
          disabled={!dirty}
          data-testid={`prompt-save-${action}`}
        >
          Save override
        </button>
      </div>
    </div>
  );
}
