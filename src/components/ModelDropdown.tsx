// Live-fetched model picker for Fireworks / OpenRouter. Hits the Rust
// `fetch_models` command (which proxies the provider's /v1/models). If the
// fetch fails or no key is configured, falls back to the static
// PROVIDER_MODELS list so the dropdown is never empty.
//
// Stale-saved value: if the persisted model is no longer in the live list,
// we keep showing it as a disabled option and surface a warning. The user
// must explicitly pick a new model — we don't silently swap, since that
// would hide a real configuration drift from them.
//
// UI: a trigger button opens a searchable modal (ModelPickerModal). Native
// <select> isn't usable for the 50+ entry Fireworks catalog — its popup
// isn't scrollable past the first page and has no search.

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

import { PROVIDER_MODELS } from "../lib/models";
import { fetchModels, type ModelInfo } from "../lib/tauri";
import type { Provider } from "../lib/types";
import { ModelPickerModal } from "./ModelPickerModal";
import "./ModelDropdown.css";

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; models: ModelInfo[] }
  | { phase: "offline"; models: ModelInfo[]; reason: "no-key" | "fetch-failed" };

interface Props {
  provider: Provider;
  value: string;
  hasKey: boolean;
  onChange: (id: string) => void;
  testIdPrefix?: string;
}

function staticFallback(provider: Provider): ModelInfo[] {
  return PROVIDER_MODELS[provider].map((m) => ({ id: m.id, label: m.label }));
}

export function ModelDropdown({
  provider,
  value,
  hasKey,
  onChange,
  testIdPrefix,
}: Props) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasKey) {
      setState({
        phase: "offline",
        models: staticFallback(provider),
        reason: "no-key",
      });
      return () => {
        cancelled = true;
      };
    }

    setState({ phase: "loading" });
    fetchModels(provider)
      .then((models) => {
        if (cancelled) return;
        if (models.length === 0) {
          // Empty live list is implausible but we shouldn't render an
          // empty dropdown. Fall back so the user can still pick something.
          setState({
            phase: "offline",
            models: staticFallback(provider),
            reason: "fetch-failed",
          });
          return;
        }
        setState({ phase: "ready", models });
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(`fetchModels(${provider}) failed:`, err);
        setState({
          phase: "offline",
          models: staticFallback(provider),
          reason: "fetch-failed",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [provider, hasKey]);

  // When the parent has no saved value and we've resolved a list, surface
  // the first option as the implicit selection so the saved field gets
  // populated on next save.
  useEffect(() => {
    if (value !== "") return;
    if (state.phase === "loading") return;
    const first = state.models[0]?.id;
    if (first) onChange(first);
  }, [value, state, onChange]);

  if (state.phase === "loading") {
    return (
      <div className="model-dropdown">
        <button
          type="button"
          className="model-dropdown__trigger"
          disabled
          data-testid={testIdPrefix ? `${testIdPrefix}-trigger` : undefined}
        >
          <span className="model-dropdown__trigger-label">Loading models…</span>
        </button>
      </div>
    );
  }

  const models = state.models;
  const staleSaved = value !== "" && !models.some((m) => m.id === value);

  // Build the list shown in the modal — include the stale value so the user
  // can see what they had selected, even if it's no longer in the catalog.
  const modalModels: ModelInfo[] = staleSaved
    ? [{ id: value, label: "(no longer available)" }, ...models]
    : models;

  const triggerLabel =
    value === "" ? "Choose a model…" : value;

  return (
    <div className="model-dropdown">
      {staleSaved && (
        <div className="model-dropdown__warning" role="alert">
          <AlertTriangle size={12} />
          <span>Saved model is no longer available — pick a new one.</span>
        </div>
      )}
      {state.phase === "offline" && state.reason === "fetch-failed" && (
        <div className="model-dropdown__notice">
          Couldn't load latest model list — showing built-in defaults.
        </div>
      )}
      <button
        type="button"
        className="model-dropdown__trigger"
        onClick={() => setOpen(true)}
        data-testid={testIdPrefix ? `${testIdPrefix}-trigger` : undefined}
        title={value || undefined}
      >
        <span className="model-dropdown__trigger-label">{triggerLabel}</span>
        <ChevronDown size={14} className="model-dropdown__trigger-icon" />
      </button>
      {open && (
        <ModelPickerModal
          provider={provider}
          models={modalModels}
          value={value}
          onPick={onChange}
          onClose={() => setOpen(false)}
          testIdPrefix={testIdPrefix}
        />
      )}
    </div>
  );
}
