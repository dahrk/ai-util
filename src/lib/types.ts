// Shared types between frontend and Rust backend.
// Keep in sync with src-tauri/src/commands/*.rs

export type Action = "summarize" | "edit" | "elaborate" | "research";

export type Provider = "fireworks" | "openrouter";

export interface Selection {
  text: string;
  source_app: string | null;
}

export interface AppSettings {
  hotkey: string | null;
  fireworks_key: string | null;
  openrouter_key: string | null;
  fireworks_model: string | null;
  openrouter_model: string | null;
  onboarding_complete: boolean;
}

export interface CompletionError {
  fireworks_error: string | null;
  openrouter_error: string | null;
}

// Panel state machine (see DESIGN_BRIEF.md states 1–4)
export type PanelState =
  | { kind: "idle" }
  | { kind: "picking"; selection: Selection }
  | { kind: "streaming"; selection: Selection; action: Action; tokens: string; provider: Provider }
  | { kind: "result"; selection: Selection; action: Action; result: string }
  | { kind: "error"; selection: Selection; action: Action; error: CompletionError };
