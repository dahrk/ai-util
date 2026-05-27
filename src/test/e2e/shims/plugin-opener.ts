// Shim for `@tauri-apps/plugin-opener`.
// Tracks what URLs/paths the app would have tried to open — used by tests
// to verify "Open System Settings" / "Get a key" links fire.

import "./index";

export async function openUrl(url: string): Promise<void> {
  window.__TEST_OPENS__.push(url);
}

export async function openPath(path: string): Promise<void> {
  window.__TEST_OPENS__.push(path);
}
