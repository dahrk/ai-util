// First-run onboarding window: A11y permission → Fireworks key (required)
// → OpenRouter key (skippable) → default model selection. Step 3 is
// skippable because only one provider key is required.

import { useCallback, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowRight, Check, Shield, Sparkles } from "lucide-react";

import { ApiKeyInput } from "../components/ApiKeyInput";
import { ProviderIndicator } from "../components/ProviderIndicator";
import { ShortcutChip } from "../components/ShortcutChip";
import { defaultModelId, PROVIDER_MODELS } from "../lib/models";
import {
  completeOnboarding,
  getSettings,
  probeAccessibility,
  setApiKey,
  setModel,
} from "../lib/tauri";
import type { AppSettings } from "../lib/types";
import "./Onboarding.css";

type Step = 1 | 2 | 3 | 4;

const A11Y_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

const FIREWORKS_DOC = "https://fireworks.ai/account/api-keys";
const OPENROUTER_DOC = "https://openrouter.ai/keys";

export default function Onboarding() {
  const [step, setStep] = useState<Step>(1);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [a11yOk, setA11yOk] = useState(false);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  // Poll A11y while on step 1; bail out as soon as it's granted.
  useEffect(() => {
    if (step !== 1) return;
    let cancelled = false;
    const tick = async () => {
      const ok = await probeAccessibility().catch(() => false);
      if (cancelled) return;
      setA11yOk(ok);
    };
    void tick();
    const id = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step]);

  const handleFinish = useCallback(async () => {
    await completeOnboarding();
  }, []);

  if (!settings) {
    return (
      <div className="onboarding">
        <div className="onboarding__loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="onboarding">
      <header className="onboarding__header">
        <span className="onboarding__brand">
          <Sparkles size={14} /> AI Text Actions
        </span>
        <span className="onboarding__steps">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={`onboarding__step-dot${step === n ? " is-active" : ""}${step > n ? " is-done" : ""}`}
              data-testid={`step-dot-${n}`}
            />
          ))}
        </span>
      </header>

      {step === 1 && (
        <StepWelcome
          a11yOk={a11yOk}
          onContinue={() => setStep(2)}
          onOpenSettings={() => void openUrl(A11Y_URL)}
        />
      )}
      {step === 2 && (
        <StepFireworks
          existing={settings.fireworks_key}
          onSaved={async (s) => setSettings(s)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepOpenRouter
          existing={settings.openrouter_key}
          onSaved={async (s) => setSettings(s)}
          onNext={() => setStep(4)}
          onSkip={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <StepDefaultModels
          settings={settings}
          onSaved={async (s) => setSettings(s)}
          onFinish={() => void handleFinish()}
        />
      )}
    </div>
  );
}

function StepWelcome({
  a11yOk,
  onContinue,
  onOpenSettings,
}: {
  a11yOk: boolean;
  onContinue: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <main className="onboarding__step" data-testid="step-1">
      <div className="onboarding__icon-tile">
        <Shield size={20} />
      </div>
      <h1 className="onboarding__title">Welcome to AI Text Actions</h1>
      <p className="onboarding__body">
        Select text in any app, press <ShortcutChip>⌘⇧Space</ShortcutChip>, and apply an AI
        action: <em>Summarize, Edit, Elaborate, Research</em>. Results stream into a floating
        panel and paste back into your source app.
      </p>
      <p className="onboarding__body">
        First — macOS needs your permission to read your selection. Grant{" "}
        <strong>Accessibility</strong> access in System Settings → Privacy &amp; Security.
      </p>
      <div className="onboarding__actions">
        <button type="button" onClick={onOpenSettings} className="onboarding__secondary">
          Open System Settings
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="onboarding__primary"
          disabled={!a11yOk}
          data-testid="step-1-next"
        >
          {a11yOk ? (
            <>
              <Check size={11} /> Continue
            </>
          ) : (
            "Waiting for permission…"
          )}
        </button>
      </div>
    </main>
  );
}

function StepFireworks({
  existing,
  onSaved,
  onNext,
}: {
  existing: string | null;
  onSaved: (s: AppSettings) => Promise<void>;
  onNext: () => void;
}) {
  const [savedKey, setSavedKey] = useState<string | null>(existing);
  return (
    <main className="onboarding__step" data-testid="step-2">
      <h1 className="onboarding__title">Connect Fireworks</h1>
      <p className="onboarding__body">
        Your primary provider for low-latency completions. <strong>Required.</strong> You can
        swap this any time from Settings.
      </p>
      <ApiKeyInput
        provider="fireworks"
        label="Fireworks API key"
        helpUrl={FIREWORKS_DOC}
        value={savedKey}
        onSave={async (key) => {
          const s = await setApiKey("fireworks", key);
          setSavedKey(key);
          await onSaved(s);
        }}
      />
      <div className="onboarding__actions">
        <span />
        <button
          type="button"
          onClick={onNext}
          className="onboarding__primary"
          disabled={!savedKey}
          data-testid="step-2-next"
        >
          Next <ArrowRight size={11} />
        </button>
      </div>
    </main>
  );
}

function StepOpenRouter({
  existing,
  onSaved,
  onNext,
  onSkip,
}: {
  existing: string | null;
  onSaved: (s: AppSettings) => Promise<void>;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [savedKey, setSavedKey] = useState<string | null>(existing);
  return (
    <main className="onboarding__step" data-testid="step-3">
      <h1 className="onboarding__title">Connect OpenRouter (optional)</h1>
      <p className="onboarding__body">
        Used as automatic fallback if Fireworks is rate-limited or returns an error. You can add
        this later — it's not required to start using the app.
      </p>
      <ApiKeyInput
        provider="openrouter"
        label="OpenRouter API key"
        helpUrl={OPENROUTER_DOC}
        value={savedKey}
        onSave={async (key) => {
          const s = await setApiKey("openrouter", key);
          setSavedKey(key);
          await onSaved(s);
        }}
      />
      <div className="onboarding__actions">
        <button
          type="button"
          onClick={onSkip}
          className="onboarding__secondary"
          data-testid="step-3-skip"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={onNext}
          className="onboarding__primary"
          data-testid="step-3-next"
        >
          Next <ArrowRight size={11} />
        </button>
      </div>
    </main>
  );
}

function StepDefaultModels({
  settings,
  onSaved,
  onFinish,
}: {
  settings: AppSettings;
  onSaved: (s: AppSettings) => Promise<void>;
  onFinish: () => void;
}) {
  const [fireworksModel, setFireworksModel] = useState(
    settings.fireworks_model ?? defaultModelId("fireworks"),
  );
  const [openrouterModel, setOpenrouterModel] = useState(
    settings.openrouter_model ?? defaultModelId("openrouter"),
  );

  const finish = useCallback(async () => {
    const s = await setModel("fireworks", fireworksModel);
    await onSaved(s);
    if (settings.openrouter_key) {
      const s2 = await setModel("openrouter", openrouterModel);
      await onSaved(s2);
    }
    onFinish();
  }, [fireworksModel, openrouterModel, onFinish, onSaved, settings.openrouter_key]);

  return (
    <main className="onboarding__step" data-testid="step-4">
      <h1 className="onboarding__title">Pick your default models</h1>
      <p className="onboarding__body">
        Choose which model each provider uses by default. You can change these any time from
        Settings.
      </p>

      <div className="onboarding__model-block">
        <div className="onboarding__model-header">
          <ProviderIndicator provider="fireworks" />
        </div>
        <ModelSelector
          options={PROVIDER_MODELS.fireworks}
          value={fireworksModel}
          onChange={setFireworksModel}
          testIdPrefix="fireworks-model"
        />
      </div>

      {settings.openrouter_key && (
        <div className="onboarding__model-block">
          <div className="onboarding__model-header">
            <ProviderIndicator provider="openrouter" />
          </div>
          <ModelSelector
            options={PROVIDER_MODELS.openrouter}
            value={openrouterModel}
            onChange={setOpenrouterModel}
            testIdPrefix="openrouter-model"
          />
        </div>
      )}

      <div className="onboarding__actions">
        <span />
        <button
          type="button"
          onClick={() => void finish()}
          className="onboarding__primary"
          data-testid="step-4-finish"
        >
          <Check size={11} /> Finish setup
        </button>
      </div>
    </main>
  );
}

function ModelSelector({
  options,
  value,
  onChange,
  testIdPrefix,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  testIdPrefix: string;
}) {
  return (
    <ul className="model-selector" role="radiogroup">
      {options.map((o) => (
        <li key={o.id}>
          <label
            className={`model-selector__option${value === o.id ? " is-selected" : ""}`}
            data-testid={`${testIdPrefix}-${o.id}`}
          >
            <input
              type="radio"
              name={testIdPrefix}
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
            />
            <span className="model-selector__label">{o.label}</span>
            {value === o.id && <Check size={11} className="model-selector__check" />}
          </label>
        </li>
      ))}
    </ul>
  );
}
