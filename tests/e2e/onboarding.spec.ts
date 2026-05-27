// First-run flow. The shim's `probe_accessibility` always returns true, so
// step 1's "Continue" button arms within the first 1500ms poll tick.

import { test, expect } from "@playwright/test";
import { getOpens, getSettings, gotoRoute, gotoWithSettings } from "./helpers";

test.describe("Onboarding", () => {
  test("step 1 → 2: A11y unlocks and Continue advances", async ({ page }) => {
    await gotoRoute(page, "/onboarding");

    // Step 1 dot is active, "Continue" button starts disabled then arms.
    await expect(page.getByTestId("step-1")).toBeVisible();
    const next = page.getByTestId("step-1-next");
    await expect(next).toBeEnabled(); // shim probe returns true on first tick

    await next.click();
    await expect(page.getByTestId("step-2")).toBeVisible();
  });

  test("step 1: 'Open System Settings' invokes the opener plugin", async ({
    page,
  }) => {
    await gotoRoute(page, "/onboarding");
    await page.getByRole("button", { name: /Open System Settings/ }).click();
    const opens = await getOpens(page);
    expect(opens.length).toBeGreaterThan(0);
    expect(opens[0]).toContain("x-apple.systempreferences");
  });

  test("step 2: pasting + saving a Fireworks key enables Next", async ({
    page,
  }) => {
    await gotoRoute(page, "/onboarding");
    await page.getByTestId("step-1-next").click();

    const next2 = page.getByTestId("step-2-next");
    await expect(next2).toBeDisabled();

    await page.getByTestId("api-key-input-fireworks").fill("fw_test_key_e2e");
    await page.getByTestId("api-key-save-fireworks").click();

    await expect(next2).toBeEnabled();
    const settings = await getSettings(page);
    expect(settings.fireworks_key).toBe("fw_test_key_e2e");

    await next2.click();
    await expect(page.getByTestId("step-3")).toBeVisible();
  });

  test("step 3: Skip jumps straight to step 4", async ({ page }) => {
    await gotoWithSettings(page, "/onboarding", {
      fireworks_key: "fw_test_key_e2e",
    });
    // Skip welcome + Fireworks by walking forward.
    await page.getByTestId("step-1-next").click();
    await page.getByTestId("step-2-next").click();
    await expect(page.getByTestId("step-3")).toBeVisible();

    await page.getByTestId("step-3-skip").click();
    await expect(page.getByTestId("step-4")).toBeVisible();

    // OpenRouter key was never saved.
    const s = await getSettings(page);
    expect(s.openrouter_key).toBeNull();
  });

  test("step 4: Finish flips onboarding_complete", async ({ page }) => {
    // Pre-seed key + model so step 4 is non-blocking and doesn't require live
    // model fetch round-trip to advance.
    await gotoWithSettings(page, "/onboarding", {
      fireworks_key: "fw_test_key_e2e",
      fireworks_model: "accounts/fireworks/models/gpt-oss-20b",
    });

    await page.getByTestId("step-1-next").click();
    await page.getByTestId("step-2-next").click();
    await page.getByTestId("step-3-skip").click();

    await page.getByTestId("step-4-finish").click();

    // The shim flips the bit synchronously inside complete_onboarding.
    await expect
      .poll(async () => (await getSettings(page)).onboarding_complete)
      .toBe(true);
  });
});
