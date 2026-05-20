// Per-provider model menu — single source of truth for Onboarding step 4
// and the Settings → Default models section. The first option in each list
// is treated as the provider's default.

import type { Provider } from "./types";

export interface ModelOption {
  id: string;
  label: string;
}

export const PROVIDER_MODELS: Record<Provider, ModelOption[]> = {
  fireworks: [
    {
      id: "accounts/fireworks/models/llama-v3p1-8b-instruct",
      label: "Llama 3.1 8B Instruct (fast)",
    },
    {
      id: "accounts/fireworks/models/llama-v3p1-70b-instruct",
      label: "Llama 3.1 70B Instruct (quality)",
    },
    {
      id: "accounts/fireworks/models/mixtral-8x7b-instruct",
      label: "Mixtral 8x7B Instruct",
    },
  ],
  openrouter: [
    { id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B Instruct (fast)" },
    { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B Instruct (quality)" },
    { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
};

export function defaultModelId(provider: Provider): string {
  return PROVIDER_MODELS[provider][0].id;
}
