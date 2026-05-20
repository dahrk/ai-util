// Shared types between frontend and Rust backend.
// Keep in sync with src-tauri/src/commands/*.rs

export type Action = "summarize" | "edit" | "elaborate" | "research";

export const ACTIONS: readonly Action[] = [
  "summarize",
  "edit",
  "elaborate",
  "research",
] as const;

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
  prompts: Record<string, string>;
  enabled_actions: string[];
  onboarding_complete: boolean;
}

export interface CompletionError {
  fireworks_error: string | null;
  openrouter_error: string | null;
}

/** Panel state machine (mirrors design-reference/project/panel.jsx states). */
export type PanelState =
  | { kind: "idle" }
  | { kind: "picking"; selection: Selection }
  | {
      kind: "streaming";
      selection: Selection;
      action: Action;
      tokens: string;
      provider: Provider;
    }
  | { kind: "result"; selection: Selection; action: Action; result: string }
  | { kind: "error"; selection: Selection | null; action: Action | null; error: CompletionError };

/** UI labels for the four built-in actions. */
export const ACTION_META: Record<Action, { label: string; hint: string; shortcut: string }> = {
  summarize: { label: "Summarize", hint: "Condense to 2–3 sentences", shortcut: "1" },
  edit:      { label: "Edit",      hint: "Tighten for clarity",       shortcut: "2" },
  elaborate: { label: "Elaborate", hint: "Add detail and context",    shortcut: "3" },
  research:  { label: "Research",  hint: "Factual context",           shortcut: "4" },
};
