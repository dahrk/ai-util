// Settings window — everything except the live-fetched model dropdown,
// which has its own slower happy-path covered in playground.spec.ts.

import { test, expect } from "@playwright/test";
import {
  FIREWORKS_KEY,
  getSettings,
  gotoRoute,
  gotoWithSettings,
} from "./helpers";

test.describe("Settings", () => {
  test("renders saved settings on mount", async ({ page }) => {
    await gotoWithSettings(page, "/settings", {
      fireworks_key: "fw_existing_key",
      hotkey: "CommandOrControl+Shift+J",
      enabled_actions: ["summarize", "edit"],
    });

    // The Fireworks input is type=password so getInputValue is the path
    // (visible text is masked).
    await expect(page.getByTestId("api-key-input-fireworks")).toHaveValue(
      "fw_existing_key",
    );
    // Hotkey is displayed pretty-printed (⌘⇧J).
    await expect(page.getByTestId("hotkey-recorder")).toContainText("⌘⇧J");

    await expect(page.getByTestId("action-toggle-summarize")).toBeChecked();
    await expect(page.getByTestId("action-toggle-edit")).toBeChecked();
    await expect(page.getByTestId("action-toggle-elaborate")).not.toBeChecked();
    await expect(page.getByTestId("action-toggle-research")).not.toBeChecked();
  });

  test("HotkeyRecorder captures a chord and persists it", async ({ page }) => {
    await gotoRoute(page, "/settings");

    const recorder = page.getByTestId("hotkey-recorder");
    await recorder.click();
    await expect(recorder).toContainText(/Press keys/i);

    // Press Ctrl+Shift+K — chordFromEvent maps both ctrl and meta to
    // "CommandOrControl", which prettyChord renders as ⌘.
    await page.keyboard.press("Control+Shift+KeyK");

    await expect(recorder).toContainText("⌘⇧K");
    await expect
      .poll(async () => (await getSettings(page)).hotkey)
      .toBe("CommandOrControl+Shift+KeyK");
  });

  test("API key validate flow against real Fireworks", async ({ page }) => {
    test.skip(!FIREWORKS_KEY, "FIREWORKS_API_KEY not set");
    await gotoRoute(page, "/settings");

    await page.getByTestId("api-key-input-fireworks").fill(FIREWORKS_KEY);
    await page.getByTestId("api-key-validate-fireworks").click();

    await expect(page.getByTestId("api-key-status-ok-fireworks")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("API key validate surfaces invalid keys", async ({ page }) => {
    await gotoRoute(page, "/settings");

    await page
      .getByTestId("api-key-input-fireworks")
      .fill("fw_obviously_not_a_real_key_zzz");
    await page.getByTestId("api-key-validate-fireworks").click();

    await expect(page.getByTestId("api-key-status-err-fireworks")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("toggling an action persists into enabled_actions", async ({ page }) => {
    await gotoRoute(page, "/settings");

    const research = page.getByTestId("action-toggle-research");
    await expect(research).toBeChecked();
    await research.uncheck();

    await expect
      .poll(async () => (await getSettings(page)).enabled_actions)
      .not.toContain("research");
  });

  test("saving a prompt override persists, Restore default clears it", async ({
    page,
  }) => {
    await gotoRoute(page, "/settings");

    const ta = page.getByTestId("prompt-input-summarize");
    await ta.fill("One sentence only: {text}");
    await page.getByTestId("prompt-save-summarize").click();

    await expect
      .poll(async () => (await getSettings(page)).prompts.summarize)
      .toBe("One sentence only: {text}");

    await page.getByTestId("prompt-restore-summarize").click();
    await expect
      .poll(async () => (await getSettings(page)).prompts.summarize)
      .toBeUndefined();
  });

  test("dev_panel_persistent toggle round-trips into store", async ({
    page,
  }) => {
    await gotoRoute(page, "/settings");

    const cb = page.getByTestId("dev-panel-persistent");
    await expect(cb).not.toBeChecked();
    await cb.check();

    await expect
      .poll(async () => (await getSettings(page)).dev_panel_persistent)
      .toBe(true);
  });
});
