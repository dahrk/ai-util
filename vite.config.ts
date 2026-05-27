import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(async () => {
  // When VITE_TEST_MODE=1 the dev server serves the same React app but with
  // @tauri-apps/* swapped for an in-browser shim under src/test/e2e/shims/.
  // This lets Playwright drive the UI in plain Chromium — no Tauri runtime,
  // no native rebuild. The production bundle is unaffected; this branch only
  // changes resolution under that one env var.
  const testMode = process.env.VITE_TEST_MODE === "1";

  const shim = (file: string) =>
    path.resolve(__dirname, `src/test/e2e/shims/${file}`);

  const testAliases = testMode
    ? {
        "@tauri-apps/api/core": shim("core.ts"),
        "@tauri-apps/api/event": shim("event.ts"),
        "@tauri-apps/api/window": shim("window.ts"),
        "@tauri-apps/plugin-clipboard-manager": shim(
          "plugin-clipboard-manager.ts",
        ),
        "@tauri-apps/plugin-opener": shim("plugin-opener.ts"),
        "@tauri-apps/plugin-store": shim("plugin-store.ts"),
      }
    : {};

  return {
    plugins: [react()],
    resolve: { alias: testAliases },

    // prevent vite from obscuring rust errors
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: "0.0.0.0",
      hmr: { protocol: "ws", host: "localhost", port: 1421 },
      watch: { ignored: ["**/src-tauri/**"] },
    },
  };
});
