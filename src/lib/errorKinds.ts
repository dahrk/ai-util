// Extensible error registry — mirrors design-reference/project/panel.jsx
// `ERROR_KINDS`. Adding a new error state = one entry here.
//
// The classifier `classify(error)` reads a `CompletionError` from Rust and
// returns the registry key whose UI should render. The registry is the
// single source of truth for header copy, body bullets, hint, primary, and
// secondary actions.

import type { CompletionError } from "./types";

export type ErrorActionKind =
  | "retry"
  | "dismiss"
  | "settings"
  | "fallback"
  | "upgrade"
  | "chunk"
  | "switch-model";

export type ErrorTone = "amber" | "red";

export interface ErrorActionDef {
  label: string;
  kind: ErrorActionKind;
  icon?: "retry" | "settings" | "sparkle";
}

export interface ErrorKindDef {
  /** Header strip title — shown next to the warning glyph. */
  headerTitle: string;
  /** One-line title shown in the body. */
  title: string;
  tone: ErrorTone;
  /** Diagnostic log rows: `[provider/category, detail]`. */
  log: Array<[string, string]>;
  /** Friendly explanation/help text shown below the log. */
  hint: string;
  primary: ErrorActionDef;
  secondary: ErrorActionDef;
}

export const ERROR_KINDS = {
  "both-failed": {
    headerTitle: "Couldn't complete",
    title: "We couldn't reach either provider.",
    tone: "red",
    log: [], // populated dynamically from the CompletionError
    hint:
      "Check your connection or API keys in Settings. Your selection is still captured — retry to try again.",
    primary: { label: "Retry", kind: "retry", icon: "retry" },
    secondary: { label: "Dismiss", kind: "dismiss" },
  },
  "rate-limit": {
    headerTitle: "Usage limit hit",
    title: "Provider rate limit reached.",
    tone: "amber",
    log: [],
    hint:
      "Wait a bit and retry, or switch providers in Settings. OpenRouter is available as a fallback.",
    primary: { label: "Use fallback", kind: "fallback", icon: "sparkle" },
    secondary: { label: "Dismiss", kind: "dismiss" },
  },
  "invalid-key": {
    headerTitle: "Authentication failed",
    title: "Your API key looks invalid.",
    tone: "amber",
    log: [],
    hint:
      "Paste a fresh key in Settings → API keys. Until then, the other provider keeps working.",
    primary: { label: "Open Settings", kind: "settings", icon: "settings" },
    secondary: { label: "Dismiss", kind: "dismiss" },
  },
  "no-connection": {
    headerTitle: "You're offline",
    title: "No network connection.",
    tone: "red",
    log: [["Network", "navigator.onLine === false"]],
    hint: "Reconnect, then retry. Your selection is preserved.",
    primary: { label: "Retry", kind: "retry", icon: "retry" },
    secondary: { label: "Dismiss", kind: "dismiss" },
  },
  "context-overflow": {
    headerTitle: "Selection too long",
    title: "Your selection exceeds the model context.",
    tone: "amber",
    log: [],
    hint: "Pick a longer-context model in Settings, or shorten the selection.",
    primary: { label: "Switch model", kind: "switch-model", icon: "settings" },
    secondary: { label: "Dismiss", kind: "dismiss" },
  },
} satisfies Record<string, ErrorKindDef>;

export type ErrorKindKey = keyof typeof ERROR_KINDS;

const RATE_LIMIT_RE = /(rate.?limit|\b429\b|too many requests|quota)/i;
const AUTH_RE = /(\b401\b|\b403\b|unauthorized|forbidden|invalid api key)/i;
const CONTEXT_RE = /(context.?length|context.?window|maximum context|too many tokens)/i;
const OFFLINE_RE = /\boffline\b/i;

/**
 * Classify a CompletionError into a registry key, using the dominant signal
 * across both provider messages. The order of checks matters: offline wins
 * if present (we set that string explicitly in the preflight); otherwise
 * specific signals win over the generic "both-failed".
 */
export function classify(err: CompletionError): ErrorKindKey {
  const blob = `${err.fireworks_error ?? ""}\n${err.openrouter_error ?? ""}`;
  if (OFFLINE_RE.test(blob)) return "no-connection";
  if (CONTEXT_RE.test(blob)) return "context-overflow";
  if (AUTH_RE.test(blob)) return "invalid-key";
  if (RATE_LIMIT_RE.test(blob)) return "rate-limit";
  return "both-failed";
}

/**
 * Build the diagnostic log rows for a given CompletionError. The base
 * registry entries leave `log` empty; this function fills it in dynamically.
 */
export function buildLog(err: CompletionError): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (err.fireworks_error) out.push(["Fireworks", err.fireworks_error]);
  if (err.openrouter_error) out.push(["OpenRouter", err.openrouter_error]);
  return out;
}
