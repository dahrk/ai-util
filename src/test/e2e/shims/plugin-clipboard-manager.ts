// Shim for `@tauri-apps/plugin-clipboard-manager`.
//
// Pushes every writeText into window.__TEST_CLIPBOARD__ so tests can
// assert on what would have been put on the OS clipboard. readText
// returns the latest entry (or "").

import "./index";

export async function writeText(text: string): Promise<void> {
  window.__TEST_CLIPBOARD__.push({ text, at: Date.now() });
}

export async function readText(): Promise<string> {
  const arr = window.__TEST_CLIPBOARD__;
  return arr.length > 0 ? arr[arr.length - 1].text : "";
}
