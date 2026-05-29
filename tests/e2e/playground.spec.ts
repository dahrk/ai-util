// Live Fireworks smoke tests via the dev /playground surface. These hit
// api.fireworks.ai for real — they catch regressions in our SSE parsing,
// prompt assembly, and cancel semantics that mocked tests can't.
//
// Each test asserts on Fireworks output, not on specific token strings —
// the model picks the words. We assert on shape (non-empty, status label,
// clipboard mirror, error path on bad key).

import { test, expect } from "@playwright/test";
import { FIREWORKS_KEY, getClipboard, gotoWithSettings } from "./helpers";

test.describe.configure({ mode: "serial" });

const SHORT_INPUT =
  "The capybara is the largest living rodent, native to South America.";

test.beforeEach((_, testInfo) => {
  if (!FIREWORKS_KEY) testInfo.skip(true, "FIREWORKS_API_KEY not set");
});

test.describe("Playground (live Fireworks)", () => {
  test("loads in idle status", async ({ page }) => {
    await gotoWithSettings(page, "/playground", {
      fireworks_key: FIREWORKS_KEY,
    });
    await expect(page.locator(".playground__status", { hasText: "ready" }))
      .toBeVisible();
  });

  test("Summarize streams real Fireworks tokens to completion", async ({
    page,
  }) => {
    await gotoWithSettings(page, "/playground", {
      fireworks_key: FIREWORKS_KEY,
    });
    await page.locator("#pg-source").fill(SHORT_INPUT);
    await page.getByRole("button", { name: "Summarize", exact: true }).click();

    // Streaming pill should appear; then the done pill within the timeout.
    await expect(page.locator(".playground__status--active")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(".playground__status--ok")).toBeVisible({
      timeout: 45_000,
    });
    // TTFT is best-effort — `telemetry_first_token` can land after
    // `completion_done` and get dropped by the status reducer. Don't gate
    // on it here; the "done" pill is the meaningful signal.
    await expect(page.locator(".playground__status--ok")).toContainText(
      /done · copied to clipboard/,
    );

    const output = await page.locator(".playground__output").innerText();
    expect(output.trim().length).toBeGreaterThan(10);

    // Backend auto-copies the final result.
    const cb = await getClipboard(page);
    expect(cb.at(-1)?.text.length).toBeGreaterThan(10);
  });

  test("Edit + Elaborate also stream successfully", async ({ page }) => {
    await gotoWithSettings(page, "/playground", {
      fireworks_key: FIREWORKS_KEY,
    });
    await page.locator("#pg-source").fill(SHORT_INPUT);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.locator(".playground__status--ok")).toBeVisible({
      timeout: 45_000,
    });

    await page.getByRole("button", { name: "Elaborate", exact: true }).click();
    await expect(page.locator(".playground__status--active")).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.locator(".playground__status--ok")).toBeVisible({
      timeout: 60_000,
    });
  });

  test("Cancel button aborts a streaming completion", async ({ page }) => {
    await gotoWithSettings(page, "/playground", {
      fireworks_key: FIREWORKS_KEY,
    });
    await page
      .locator("#pg-source")
      .fill(
        "Write a long essay (at least 800 words) on the cultural and ecological history of the capybara, with multiple sections.",
      );
    await page.getByRole("button", { name: "Elaborate", exact: true }).click();
    await expect(page.locator(".playground__status--active")).toBeVisible({
      timeout: 5_000,
    });

    await page
      .getByRole("button", { name: /^Cancel$/, exact: false })
      .click();

    // Status returns to idle/ready (no done pill after cancel).
    await expect(
      page.locator(".playground__status", { hasText: "ready" }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("invalid Fireworks key surfaces an error pill", async ({ page }) => {
    await gotoWithSettings(page, "/playground", {
      fireworks_key: "fw_definitely_not_valid_e2e",
    });
    await page.locator("#pg-source").fill("test");
    await page.getByRole("button", { name: "Summarize", exact: true }).click();

    await expect(page.locator(".playground__status--err")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("output is auto-copied to the clipboard plugin on done", async ({
    page,
  }) => {
    await gotoWithSettings(page, "/playground", {
      fireworks_key: FIREWORKS_KEY,
    });
    await page.locator("#pg-source").fill(SHORT_INPUT);
    await page.getByRole("button", { name: "Summarize", exact: true }).click();
    await expect(page.locator(".playground__status--ok")).toBeVisible({
      timeout: 45_000,
    });

    const output = (await page.locator(".playground__output").innerText()).trim();
    const cb = await getClipboard(page);
    expect(cb.at(-1)?.text).toBe(output);
  });
});
