// Per-provider model menu — single source of truth for Onboarding step 4
// and the Settings → Default models section. The first option in each list
// is treated as the provider's default.

import type { Provider } from "./types";

export interface ModelOption {
  id: string;
  label: string;
}

// Offline fallback for ModelDropdown. The live catalog (via `fetchModels`
// → Rust `provider_for(kind).fetch_models()`) is canonical at runtime; this
// list is only used when no key is configured yet (pre-onboarding) or the
// live fetch fails. The first entry of each list also seeds the Rust-side
// `default_model()` (see `src-tauri/src/llm/provider_impl.rs`), used as the
// completion fallback when the user's saved model is None.
export const PROVIDER_MODELS: Record<Provider, ModelOption[]> = {
  fireworks: [
    {
      id: "accounts/fireworks/models/gpt-oss-20b",
      label: "GPT-OSS 20B (fast)",
    },
    {
      id: "accounts/fireworks/models/gpt-oss-120b",
      label: "GPT-OSS 120B (quality)",
    },
    {
      id: "accounts/fireworks/models/kimi-k2p6",
      label: "Kimi K2.6",
    },
  ],
  openrouter: [
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct" },
    { id: "meta-llama/llama-4-scout", label: "Llama 4 Scout (fast)" },
    { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
};

export function defaultModelId(provider: Provider): string {
  return PROVIDER_MODELS[provider][0].id;
}
