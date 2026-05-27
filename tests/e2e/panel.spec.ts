// Floating-panel state machine, driven by a deterministic completion
// override so streaming is fast and offline. The Playground spec covers the
// real-Fireworks streaming path end-to-end; this one focuses on UI states
// and side-effects (paste-back, copy, error registry).

import { test, expect } from "@playwright/test";
import {
  emitSelection,
  getClipboard,
  getPastes,
  gotoWithSettings,
  setCompletionOverride,
} from "./helpers";

// All panel tests need at least one provider key configured — otherwise the
// shim's run_completion short-circuits into an error before our override
// can fire. We use a fake string; the override is what actually streams.
const SEEDED = { fireworks_key: "fw_test_key_e2e" };

async function waitForPanelMount(page: import("@playwright/test").Page) {
  // Idle state shows "Press ⌘⇧Space …" — proves listeners are mounted.
  await expect(page.getByText(/Press/i).first()).toBeVisible();
}

test.describe("Panel state machine", () => {
  test("idle state shows the empty hint", async ({ page }) => {
    await gotoWithSettings(page, "/panel", SEEDED);
    await waitForPanelMount(page);
    await expect(page.locator("code", { hasText: "⌘⇧Space" })).toBeVisible();
  });

  test("selection_captured → picking shows preview + four actions", async ({
    page,
  }) => {
    await gotoWithSettings(page, "/panel", SEEDED);
    await waitForPanelMount(page);
    await emitSelection(page, "Hello e2e world.", "TextEdit");

    await expect(page.getByRole("listbox", { name: "AI actions" })).toBeVisible();
    await expect(page.getByText("Hello e2e world.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Summarize/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Edit/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Elaborate/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Research/ })).toBeVisible();
  });

  test("picking → streaming → result with mocked tokens", async ({ page }) => {
    await gotoWithSettings(page, "/panel", SEEDED);
    await waitForPanelMount(page);
    await setCompletionOverride(page, {
      kind: "stream",
      tokens: ["Hello", " ", "world", "."],
      tokenIntervalMs: 5,
    });
    await emitSelection(page, "input text");
    await page.getByRole("button", { name: /Summarize/ }).click();

    // Result view shows the concatenated text.
    await expect(page.getByTestId("result-text")).toHaveText("Hello world.", {
      timeout: 5_000,
    });

    // Auto-clipboard mirror from the shim's run_completion.
    const cb = await getClipboard(page);
    expect(cb.at(-1)?.text).toBe("Hello world.");
  });

  test("provider_switched resets the streaming buffer", async ({ page }) => {
    await gotoWithSettings(page, "/panel", {
      ...SEEDED,
      openrouter_key: "or_test_key_e2e",
    });
    await waitForPanelMount(page);
    await setCompletionOverride(page, {
      kind: "stream",
      tokens: ["AAA", "BBB", "CCC", "DDD"],
      tokenIntervalMs: 30,
      providerSwitchAfter: { afterToken: 2, to: "openrouter" },
    });
    await emitSelection(page, "input");
    await page.getByRole("button", { name: /Edit/ }).click();

    // Final result is only the post-switch chunk (gateway resets the buffer
    // on provider_switched).
    await expect(page.getByTestId("result-text")).toHaveText("CCCDDD", {
      timeout: 5_000,
    });
  });

  test("completion_error → ErrorView with classified kind", async ({
    page,
  }) => {
    await gotoWithSettings(page, "/panel", SEEDED);
    await waitForPanelMount(page);
    await setCompletionOverride(page, {
      kind: "error",
      fireworks_error: "HTTP 401 unauthorized",
      openrouter_error: null,
      delayMs: 10,
    });
    await emitSelection(page, "input");
    await page.getByRole("button", { name: /Elaborate/ }).click();

    // classify() returns "invalid-key" for /401|unauthorized/.
    await expect(page.locator('[data-error-kind="invalid-key"]')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByTestId("error-log")).toContainText("Fireworks");
    await expect(page.getByTestId("error-primary")).toContainText(/Settings/);
  });

  test("Copy in result view writes to the clipboard plugin", async ({
    page,
  }) => {
    await gotoWithSettings(page, "/panel", SEEDED);
    await waitForPanelMount(page);
    await setCompletionOverride(page, {
      kind: "stream",
      tokens: ["copied content"],
      tokenIntervalMs: 1,
    });
    await emitSelection(page, "src");
    await page.getByRole("button", { name: /Summarize/ }).click();
    await expect(page.getByTestId("result-text")).toHaveText("copied content");

    // Clear the auto-copy entry so we can isolate the explicit Copy click.
    await page.evaluate(() => (window.__TEST_CLIPBOARD__.length = 0));
    await page.getByTestId("result-copy").click();

    const cb = await getClipboard(page);
    expect(cb.length).toBe(1);
    expect(cb[0].text).toBe("copied content");
  });

  test("Replace selection invokes paste_back", async ({ page }) => {
    await gotoWithSettings(page, "/panel", SEEDED);
    await waitForPanelMount(page);
    await setCompletionOverride(page, {
      kind: "stream",
      tokens: ["replaced text"],
      tokenIntervalMs: 1,
    });
    await emitSelection(page, "original");
    await page.getByRole("button", { name: /Edit/ }).click();
    await expect(page.getByTestId("result-text")).toHaveText("replaced text");

    await page.getByTestId("result-replace").click();

    const pastes = await getPastes(page);
    expect(pastes).toEqual(["replaced text"]);
  });

  test("permission_required swaps to the PermissionPrompt view", async ({
    page,
  }) => {
    await gotoWithSettings(page, "/panel", SEEDED);
    await waitForPanelMount(page);
    await page.evaluate(() => window.__TEST__.emitPermissionRequired());

    await expect(
      page.getByText(/Accessibility access needed/i),
    ).toBeVisible();
  });
});
