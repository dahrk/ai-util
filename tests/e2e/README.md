# E2E tests

Browser-driven Playwright suite. The Tauri runtime is swapped out for an
in-browser shim under `src/test/e2e/shims/` whenever Vite is booted with
`VITE_TEST_MODE=1`. This means the entire React frontend runs in real
Chromium against the real Vite dev server, with `@tauri-apps/*` imports
resolved to JS-only fakes.

## Running

```
pnpm e2e            # headless
pnpm e2e:headed     # see the browser
pnpm e2e:ui         # interactive UI mode
pnpm e2e:report     # open the last HTML report
```

`playwright.config.ts` boots `pnpm dev` (with `VITE_TEST_MODE=1`) as its
`webServer`. If you already have a dev server on port 1420, Playwright
reuses it.

## Real Fireworks vs mocked

- `panel.spec.ts` is fully **mocked** via `setCompletionOverride` — no
  network. This is the fast inner loop for the panel state machine.
- `playground.spec.ts` and one case in `settings.spec.ts` hit
  **api.fireworks.ai for real**. They require `FIREWORKS_API_KEY` in
  `.env.test`; otherwise they self-skip.
- `onboarding.spec.ts` and the rest of `settings.spec.ts` are mocked.

## How a test talks to the app

Every shim file imports `./shims/index.ts`, which installs
`window.__TEST__` — the test surface the helpers in `helpers.ts` wrap.

- `gotoRoute(page, "/panel")` — navigate + wipe state.
- `gotoWithSettings(page, "/settings", { ... })` — seed the in-memory
  settings store, reload, then mount. Use this when the route reads
  settings during its first render.
- `emitSelection(page, text, app)` — dispatches the same
  `selection_captured` event the backend's `commands/selection.rs`
  emits.
- `setCompletionOverride(page, override)` — swap the shim's
  `run_completion` for a deterministic stream or error. Has to be set
  **after** any reload (the override lives on `window`, not
  sessionStorage).

## Adding a shim for a new Tauri import

1. Add the alias entry in `vite.config.ts` under `testAliases`.
2. Create `src/test/e2e/shims/<name>.ts` re-exporting the same surface
   the real plugin offers. Import `./index` for the side-effect.
3. If the new surface has observable side-effects you want tests to
   assert on, add a `__TEST_*__` log in `state.ts` and surface it
   through `window.__TEST__`.

## When a spec fails

- `pnpm e2e:report` opens the trace viewer. Each failing test has a
  `.trace.zip` you can drag into [trace.playwright.dev](https://trace.playwright.dev/).
- For listener races: confirm the panel UI is fully mounted before
  emitting events (`waitForPanelMount` is the pattern in panel.spec.ts).
- For shim drift: if a frontend feature is failing in browser mode but
  works in `pnpm tauri dev`, the shim's `commands.ts` dispatch table
  has likely fallen behind the real Tauri command surface.
