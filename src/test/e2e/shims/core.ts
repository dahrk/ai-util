// Shim for `@tauri-apps/api/core`.
import { dispatchInvoke } from "./commands";
import "./index"; // ensure window.__TEST__ is installed even if only core.ts loads

export function invoke<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return dispatchInvoke(cmd, args) as Promise<T>;
}
