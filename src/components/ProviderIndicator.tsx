import type { Provider } from "../lib/types";
import "./ProviderIndicator.css";

export type ProviderStatus = "idle" | "switching" | "error";

interface Props {
  provider: Provider;
  status?: ProviderStatus;
}

const LABELS: Record<Provider, string> = {
  fireworks: "Fireworks",
  openrouter: "OpenRouter",
};

/**
 * Tiny dot + label in the panel header. Muted by default so it doesn't draw
 * the eye, but the dot color flips to accent (switching) or red (error) when
 * something is happening worth surfacing.
 */
export function ProviderIndicator({ provider, status = "idle" }: Props) {
  return (
    <span className="provider-indicator" data-status={status}>
      <span className="provider-indicator__dot" />
      <span className="provider-indicator__label">{LABELS[provider]}</span>
    </span>
  );
}
