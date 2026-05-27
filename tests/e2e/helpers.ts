// Playwright helpers for the AI Text Actions E2E suite.
//
// All tests go through `gotoRoute(page, "/onboarding")` etc. so the shim
// has time to install `__TEST__` before any assertion runs. State is wiped
// at the start of every test (see beforeEach in each spec).

import type { Page, Route } from "@playwright/test";
import type { CompletionOverride, AppSettingsShape } from "../../src/test/e2e/shims/state";

export type Route_ = "/panel" | "/onboarding" | "/settings" | "/playground";

/** Navigate, wait for the shim, and reset state. */
export async function gotoRoute(page: Page, route: Route_): Promise<void> {
  await page.goto(route);
  await page.waitForFunction(() => !!window.__TEST__);
  await page.evaluate(() => window.__TEST__.reset());
  // Force a reload so route components remount with cleared sessionStorage.
  await page.goto(route);
  await page.waitForFunction(() => !!window.__TEST__);
}

/** Seed settings before mounting a route — useful when the route's first
 *  render reads them (e.g. Settings, Onboarding, Panel). */
export async function gotoWithSettings(
  page: Page,
  route: Route_,
  partial: Partial<AppSettingsShape>,
): Promise<void> {
  await page.goto(route);
  await page.waitForFunction(() => !!window.__TEST__);
  await page.evaluate((p) => {
    window.__TEST__.reset();
    window.__TEST__.setSettings(p);
  }, partial as Partial<AppSettingsShape>);
  // Reload so components pick up the seeded settings on mount.
  await page.goto(route);
  await page.waitForFunction(() => !!window.__TEST__);
}

/** Drive the panel's `selection_captured` event. */
export async function emitSelection(
  page: Page,
  text: string,
  source_app: string | null = "TextEdit",
): Promise<void> {
  await page.evaluate(
    ([t, s]) => window.__TEST__.emitSelectionCaptured(t as string, s as string | null),
    [text, source_app] as const,
  );
}

export async function setCompletionOverride(
  page: Page,
  override: CompletionOverride | null,
): Promise<void> {
  await page.evaluate(
    (o) => window.__TEST__.setCompletionOverride(o as CompletionOverride | null),
    override,
  );
}

export async function getSettings(page: Page): Promise<AppSettingsShape> {
  return page.evaluate(() => window.__TEST__.getSettings());
}

export async function getClipboard(page: Page): Promise<{ text: string; at: number }[]> {
  return page.evaluate(() => window.__TEST__.clipboard());
}

export async function getPastes(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__TEST__.pastes());
}

export async function getOpens(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__TEST__.opens());
}

export async function isPanelVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => window.__TEST__.isPanelVisible());
}

/** The real Fireworks key for live tests. Falls back to skip via the env. */
export const FIREWORKS_KEY = process.env.FIREWORKS_API_KEY ?? "";

/** Throw if no real key — used as a guard in beforeAll for live specs. */
export function requireFireworksKey(): string {
  if (!FIREWORKS_KEY)
    throw new Error(
      "FIREWORKS_API_KEY not set — add it to .env.test or skip these specs.",
    );
  return FIREWORKS_KEY;
}

/** Block all real network requests except to a whitelisted host. Useful for
 *  the panel spec where we want to make sure nothing leaks out. */
export async function isolateFromNetwork(page: Page) {
  await page.route("**/*", (route: Route) => {
    const url = route.request().url();
    if (url.startsWith("http://localhost:1420")) return route.continue();
    if (url.startsWith("ws://localhost:1421")) return route.continue();
    if (url.startsWith("data:") || url.startsWith("blob:"))
      return route.continue();
    return route.abort();
  });
}
