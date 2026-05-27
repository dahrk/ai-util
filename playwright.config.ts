import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.test (FIREWORKS_API_KEY, optional OPENROUTER_API_KEY) before
// the workers boot so the webServer + tests see them.
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

const PORT = 1420;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // shared vite dev server + single sessionStorage namespace per page is fine,
  // but Playwright spinning multiple workers against the same dev server has shown flakiness.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // Each test starts on a fresh page → fresh sessionStorage → fresh shim
    // state. Tests can also call `__TEST__.reset()` for an in-test wipe.
    contextOptions: {
      ignoreHTTPSErrors: true,
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_TEST_MODE: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  },
});
