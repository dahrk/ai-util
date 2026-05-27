// Verbatim port of src-tauri/src/llm/prompts.rs.
//
// The shim has to send the SAME bytes to Fireworks that the real app
// would, otherwise the Playground spec is testing "Fireworks works" not
// "this app's Fireworks call works". If you change prompts.rs, also change
// this file (or the Playground tests start drifting from reality).

import type { Action } from "../../../lib/types";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export const SHARED_SYSTEM =
  "You output ONLY the requested rewrite. No preamble, no quotes, no markdown unless the input had it.";

function defaultUserPrompt(action: Action, text: string): string {
  switch (action) {
    case "summarize":
      return `Summarize the following in 2–3 sentences:\n\n${text}`;
    case "edit":
      return `Rewrite for clarity and concision. Preserve meaning, voice, and any formatting.\n\n${text}`;
    case "elaborate":
      return `Expand the input with more detail, examples, and context. Match the original tone.\n\n${text}`;
    case "research":
      return `Provide concise factual context for the input topic in 3–5 sentences.\n\n${text}`;
  }
}

export function buildMessages(
  action: Action,
  text: string,
  userOverride: string | null = null,
): ChatMessage[] {
  const trimmed = userOverride?.trim() ?? "";
  const userContent =
    trimmed.length > 0
      ? userOverride!.replace("{text}", text)
      : defaultUserPrompt(action, text);
  return [
    { role: "system", content: SHARED_SYSTEM },
    { role: "user", content: userContent },
  ];
}

/** Mirrors prompts.rs::max_tokens_for. */
export function maxTokensFor(action: Action, textChars: number): number {
  switch (action) {
    case "summarize":
      return 200;
    case "edit":
      return Math.max(120, Math.min(600, Math.floor(textChars / 3)));
    case "elaborate":
      return 600;
    case "research":
      return 400;
  }
}
