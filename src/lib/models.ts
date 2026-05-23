// Per-provider model menu — single source of truth for Onboarding step 4
// and the Settings → Default models section. The first option in each list
// is treated as the provider's default.

import type { Provider } from "./types";

export interface ModelOption {
  id: string;
  label: string;
}

// Fireworks rotates serverless model availability; if a request 404s with
// "model ... does not exist and/or not deployed", update these IDs against
// the live catalog at https://fireworks.ai/models (or `GET /v1/models`).
// Keep `default_model()` in `src-tauri/src/llm/providers.rs` in sync with
// the first entry of each list.
export const PROVIDER_MODELS: Record<Provider, ModelOption[]> = {
  fireworks: [
    {
      id: "accounts/fireworks/models/llama-v3p3-70b-instruct",
      label: "Llama 3.3 70B Instruct (quality)",
    },
    {
      id: "accounts/fireworks/models/llama4-scout-instruct-basic",
      label: "Llama 4 Scout (fast)",
    },
    {
      id: "accounts/fireworks/models/llama4-maverick-instruct-basic",
      label: "Llama 4 Maverick (quality)",
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
