# E2E Coverage Gaps

A prioritised audit of behaviour that is **not** yet exercised by the
existing browser-driven Playwright suite (`panel.spec.ts`,
`settings.spec.ts`, `onboarding.spec.ts`, `playground.spec.ts`) or by the
Vitest/cargo unit layers.

The grouping is by *return on engineering minute*, not by importance of the
underlying feature: a critical path that is trivially fakeable beats a
nice-to-have that needs a new shim plumbing pass.

| Tier | Meaning |
|---|---|
| **A — High value, easy** | Pure shim/override work. No new infra. ≤ 30 min/test. |
| **B — High value, harder** | Needs new shim plumbing or a Rust hook. Hours, not days. |
| **C — Nice to have** | Polish/parity tests. Low regression risk if skipped. |

Each row gives the **target file** (where the new spec should live), a
one-line **approach**, and the rough **shape** of what to assert.

---

## A. High value / easy

### A1. Panel state-machine: `back()` from result → picking
- **Target:** `panel.spec.ts`
- **What to test:** From a completed result, clicking the back affordance
  (`Backspace` keystroke or the back button in `ResultView`) returns to
  the action picker with the **same selection** preserved.
- **Approach:** Reuse the existing mocked stream override; after
  `result-text` resolves, press `Backspace`, then assert the actions
  listbox + the selection preview are both visible again and the
  preview text matches the seeded selection.
- **Why it's easy:** `store.ts`'s `back()` action is pure; the
  observable contract is just DOM presence.

### A2. Panel state-machine: `retry()` re-streams from error and from result
- **Target:** `panel.spec.ts`
- **What to test:** Two cases:
  1. Click **Retry** on an error view → goes back to streaming with the
     same `action`/`selection`, eventually resolves to result.
  2. Click **Retry** on the result view → resets tokens to empty and
     re-streams.
- **Approach:** Two overrides in sequence — first an `error` override,
  swap to a `stream` override before clicking Retry. Or have one
  `stream` override returning different tokens on the second call (a
  call-count counter on the shim).
- **Why it's easy:** `setCompletionOverride` already supports swapping
  between calls.

### A3. Malformed SSE chunk is swallowed without crashing the stream
- **Target:** Rust unit — extend `src-tauri/src/llm/sse.rs`'s `tests`
  module. Plus one e2e check.
- **What to test:**
  - **Rust:** `parse_data_line` returns `Err` for invalid JSON, `Ok(None)`
    for `data: {} ` and `data: {"choices":[]}` — confirm `gateway` swallows
    parse errors and the stream continues (today's test only covers
    `[DONE]` and the happy path).
  - **E2E:** Add a new override shape `kind: "raw_sse"` that emits a
    mix of valid + malformed chunks. Confirm the result view still
    shows the concatenation of the *valid* tokens.
- **Approach:** Cargo-side is a direct unit test. The e2e variant needs
  one new override branch in `shims/commands.ts`.

### A4. Timeout / read-stall surfaces as a classified error
- **Target:** `panel.spec.ts`
- **What to test:** An override that resolves the HTTP call but never
  emits a token (or emits one then hangs) is treated as a
  *both-failed* (or whatever the registry settles on for timeouts).
  Today's error test only covers HTTP 401.
- **Approach:** `kind: "stall"` override → backend should bail after its
  read-timeout. If the existing gateway has no timeout for stalled
  streams, that's itself a bug worth surfacing — the test should fail
  loudly.

### A5. HTTP 429 classifies as `rate-limit`
- **Target:** `panel.spec.ts`
- **What to test:** `error` override with body `"HTTP 429 too many
  requests"` → `[data-error-kind="rate-limit"]` is visible, primary
  action label is *"Use fallback"*.
- **Approach:** Mirror the existing 401 test exactly; just change the
  error string. Cheapest test in the file.

### A6. Context-overflow classifies + primary action is "Switch model"
- **Target:** `panel.spec.ts`
- **What to test:** Error body containing `context_length_exceeded`
  classifies to `context-overflow`. Primary button label is *"Switch
  model"*.
- **Approach:** Same shape as A5. Pair with the existing
  `errorKinds.test.ts` assertion to keep classifier + UI in lockstep.

### A7. `dev_panel_persistent` change actually disables auto-hide on blur
- **Target:** `settings.spec.ts` (or a new `panel-behaviour.spec.ts`)
- **What to test:** Today the suite only checks the **persistence** of the
  toggle (round-trips into the store). It does not assert the
  **behaviour**: that `Panel.tsx` no longer calls `hide_panel` when the
  flag is on.
- **Approach:** Seed `dev_panel_persistent: true`, mount panel, emit a
  blur via `window.dispatchEvent(new Event("blur"))`, assert
  `isPanelVisible(page)` stays true. Mirror with `false`.

### A8. Settings persistence round-trip via a *real* reload
- **Target:** `settings.spec.ts`
- **What to test:** Today most settings tests poll
  `window.__TEST__.getSettings()`, which reads the in-memory shim.
  Add one regression spec that mutates a setting, calls `page.reload()`,
  and asserts the value is re-read on mount.
- **Approach:** The shim already persists to sessionStorage when
  `setSettings` is called; a reload exercises the load path. If today's
  shim doesn't, that's the gap — wire it up.

### A9. Model picker shows context-length chips
- **Target:** New `model-picker.spec.ts`
- **What to test:** Open the modal from Settings → Default models →
  Fireworks; assert each row that has `context_length` renders the
  `"… ctx"` badge with the formatted value (`131K`, `1M`).
- **Approach:** Seed the shim's `fetchModels` return with a fixed
  catalog that includes context lengths; open the picker; query
  `.model-picker__ctx`.

### A10. `SelectionPreview` expand → collapse toggle round-trip
- **Target:** `panel.spec.ts`
- **What to test:** Emit a 5,000-char selection → `long-selection-badge`
  visible → click it → full text visible **and**
  `long-selection-collapse` visible → click it → back to truncated.
  Today's `__tests__/SelectionPreview.test.tsx` covers the static
  render but not the toggle round-trip in the panel context.
- **Approach:** Trivial — wire it through `emitSelection` with a long
  text and click the two test-ids.

### A11. Disabled actions are filtered out of the picker
- **Target:** `panel.spec.ts`
- **What to test:** Seed `enabled_actions: ["summarize", "edit"]`,
  emit selection, assert only the two buttons render. Today's tests
  always assert all four.
- **Approach:** One-line settings seed; existing role-query assertions.

### A12. `cancelCompletion` mid-stream drops to idle
- **Target:** `panel.spec.ts` (the mocked twin to `playground.spec.ts`'s
  live cancel test)
- **What to test:** Mocked long stream + click cancel + assert the
  panel goes to idle and no result fires after.
- **Approach:** Long `tokenIntervalMs`; call `cancelCompletion` via the
  shim after one token; assert listbox returns or panel idles.

---

## B. High value / harder

### B1. Provider-failover contract: `provider_switched` arrives before any OpenRouter token
- **Target:** `panel.spec.ts` (assertion) + Rust unit
- **What to test:** This is the load-bearing contract called out in
  `lib.rs` / `store.ts` comments. Today's `provider_switched resets the
  streaming buffer` test asserts the *consequence* (final buffer is
  post-switch tokens) but does not pin the *order* of events.
- **Approach:** Add an in-shim event recorder that timestamps every
  `__TEST__`-observable event (`completion_token`,
  `provider_switched`, …). Assert that no `completion_token` payload
  attributed to OpenRouter is recorded before
  `provider_switched`. On the Rust side, a `wiremock` test for the
  gateway with a Fireworks 500 + OpenRouter happy stream, asserting on
  callback ordering.
- **Why it's harder:** Needs a small event-trace plumb-through on the
  shim and a new wiremock fixture.

### B2. Partial-stream abort restores clipboard
- **Target:** New `paste-back.spec.ts` (mocked) **or** a `cargo test`
- **What to test:** `paste_back` writes new text → cancel/abort
  mid-paste (e.g. by panel hide) → previous clipboard is restored. The
  current `selection.rs` has the restore logic
  (`tracing::warn!("paste_back: clipboard restore failed …")`) but
  no test covers the success path of the restore.
- **Approach:** In the shim: track every clipboard write in order;
  assert the *last* entry equals the seeded "previous" clipboard, not
  the result text, when an abort path runs.
- **Why it's harder:** Needs an abort hook in the shim — today
  `synthesize_paste` is monolithic.

### B3. Settings live-rebind survives hotkey change
- **Target:** New `hotkey-live-rebind.spec.ts`
- **What to test:** Set hotkey A, fire the chord → panel shows. Change
  to hotkey B → A no longer shows the panel, B does. Exercises the
  `set_hotkey → hotkey::reregister` path in `commands/settings.rs`.
- **Approach:** Today the shim probably doesn't synthesise a global
  shortcut. Add a fake `globalShortcut.register` table to the shim and
  let tests "press" by name.
- **Why it's harder:** Needs a new shim surface for the
  `plugin-global-shortcut` API.

### B4. A11y probe failure path
- **Target:** `onboarding.spec.ts`
- **What to test:** The shim's `probe_accessibility` is hardcoded to
  return `true` (see `tests/e2e/onboarding.spec.ts` header comment), so
  the *denied* branch of step 1 is untested: button stays disabled,
  copy reads "waiting on Accessibility", "Open System Settings" remains
  the primary CTA.
- **Approach:** Add `__TEST__.setProbeAccessibility(boolean)` to the
  shim. Seed false; assert the disabled state; flip to true and assert
  the auto-advance.
- **Why it's harder:** Needs a new shim toggle (small but new surface).

### B5. Onboarding back-navigation (negative / regression)
- **Target:** `onboarding.spec.ts`
- **What to test:** `Onboarding.tsx` is forward-only — there is no Back
  button on any step. This is a regression hazard: if a future contributor
  wires `setStep(step - 1)` on a stray key handler, we'd want to know.
- **Approach:** Add a regression test: navigate to step 3, press
  `Backspace` and `Escape`, assert the active step is still 3 and
  `step-2` is **not** visible.
- **Why it's harder:** The "test for absence" framing is fine, but
  watch for false positives if/when Back is intentionally added.

### B5b. Onboarding partial completion (window-close mid-flow)
- **Target:** `onboarding.spec.ts`
- **What to test:** If the user closes the onboarding window after step
  2 (Fireworks key saved) but before step 4 (Finish), then re-opens the
  app:
  1. `onboarding_complete` stays `false`,
  2. the saved Fireworks key is preserved (user does not have to retype),
  3. re-mounting `/onboarding` starts at step 1 (or — decide whether we
     want to resume at the highest reached step; pin the choice here).
- **Approach:** Walk to step 3, call `page.reload()`, re-assert. Today
  the route always starts at step 1 — that's worth pinning in either
  direction.
- **Why it's harder:** Forces us to decide and document the resume policy,
  not just write a passing test.

### B6. Fireworks `validate_api_key` failure modes (not just the happy/sad live tests)
- **Target:** `src-tauri/tests/` (new wiremock-backed `validate.rs`) +
  one e2e spec
- **What to test:** Today the live spec checks "real key OK" and
  "bogus key err". Cover the documented mid-life-cycle case from
  `CLAUDE.md` — a 404 with body `"… and/or not deployed"` (model
  retired) — surfaces as a classified error in the validate UI, not a
  raw error string.
- **Approach:** Stub Fireworks `/v1/models` with wiremock to return
  404+ body; assert mapped error string contains a user-readable
  "model retired" hint.

### B7. `tauri-plugin-store` migration / forward-compat at the deserialize boundary
- **Target:** Extend `src-tauri/src/settings.rs` tests
- **What to test:** Today's test covers an "unknown_field" but not the
  *removal* of a known field — e.g. an old store with the deprecated
  shape (a setting we later drop) should not panic on load. Also: an
  old store missing `dev_panel_persistent` should default to `false`.
- **Approach:** Cargo-side parametrised tests over a few historical
  JSON shapes.

### B8. OpenRouter context-length search query (`128k`, `1m`, `200000`)
- **Target:** New `model-picker.spec.ts` (paired with A9)
- **What to test:** Typing `128k` filters rows to those with
  `context_length >= 128000` *or* a literal id match; `1m` works the
  same; `70000` (bare) is below the 4-digit floor and does **not** match
  context-only. Today this lives in `parseCtxQuery` and isn't covered.
- **Approach:** Seed the modal with a mixed-context catalog (some
  rows with no `context_length` at all), type the query, assert the
  visible row count and contents. Pair with a Vitest unit test on
  `parseCtxQuery`.
- **Why it's harder:** Needs the same fixture work as A9 plus a
  parametrised set of queries.

---

## C. Nice to have

### C1. Edge-flip / clamp positioning under multi-monitor extremes
- **Target:** `src-tauri/src/window/panel.rs` (already has clamp tests,
  add edge-flip cases)
- **What to test:** Verify the *flip* branch when both X and Y would
  overflow; verify the clamp acts as last-resort after a flip still
  overflows (panel taller than monitor). Today's tests cover clamp
  alone.

### C2. Telemetry overlay toggle (`⌘⇧;`)
- **Target:** New `telemetry.spec.ts`
- **What to test:** Press the chord with the panel mounted; overlay
  becomes visible; press again; it hides. Today `telemetry.test.ts`
  covers the data plumbing but not the keybinding.

### C3. `ProviderIndicator` flips between Fireworks ↔ OpenRouter on switch
- **Target:** `panel.spec.ts`
- **What to test:** Visual regression-ish — after a provider switch
  the indicator's `data-provider` (or text) changes. The buffer
  reset test already provokes a switch; just add one more assertion.

### C4. Tray menu items wire to the right commands
- **Target:** New `tray.spec.ts` (or a unit in the shim)
- **What to test:** Open the tray, click "Settings…" → settings
  window opens via the shim's `open` log; click "Playground…" (debug
  build only) → playground opens.
- **Approach:** Shim already records `opens()`; just expose tray
  click APIs.

### C5. `Restore default` for prompt overrides clears across a reload
- **Target:** `settings.spec.ts`
- **What to test:** Set + save override, reload, restore, reload —
  override is still cleared on second mount. Partial coverage today
  (no reload).

### C6. Lint/typecheck-level: dead state branches in `store.ts`
- **Target:** `src/lib/store.test.ts`
- **What to test:** Every "intentional no-op when called from the wrong
  source state" branch — e.g. `appendToken` while `kind === "result"`,
  `completeResult` while `kind === "picking"`. The store comment promises
  these no-op; add a sweep test that asserts the state object is
  reference-equal after each illegal call.

### C7. Selection capture: empty selection produces an offline-preflight error
- **Target:** New `selection-capture.spec.ts`
- **What to test:** Emit a `selection_captured` event with empty text
  → panel surfaces an "empty selection" affordance, not a streaming
  state.

### C8. Rust gateway: HTTP/2 ALPN negotiation regression
- **Target:** `src-tauri/src/llm/gateway.rs` tests
- **What to test:** A regression guard for the comment in `init_client`
  ("`http2_prior_knowledge` is intentionally OFF"). Wiremock with TLS
  termination is fiddly; a smaller test is "the client builder does not
  enable `http2_prior_knowledge`" by asserting on its config (where
  reqwest exposes it) or by an inspection test on `Client::builder`.

---

## Rust-side gaps in `prompts.rs` and `provider_impl.rs`

The two LLM-adjacent Rust modules are already the best-covered code in
the backend (override/placeholder/max_tokens matrix; fetch_models parse
+ status mapping). Remaining gaps:

### `src-tauri/src/llm/prompts.rs`

- **P1. Multi-placeholder substitution.** `build_messages_with_override`
  uses `String::replace`, which substitutes **every** `{text}` occurrence.
  No test pins this contract — pin it so a future `replacen(.., 1)`
  refactor breaks loudly.
- **P2. Round-trip `as_key()` ↔ `from_str(…)`.** Today each
  `Action::ALL` entry asserts `as_key()` matches the lowercase string,
  but the reverse direction is only asserted via the `"invalid"` case.
  Add one explicit loop:
  `for a in Action::ALL { assert_eq!(Action::from_str(a.as_key()).unwrap(), a); }`.
- **P3. `max_tokens_for(Edit, 0)` does not panic.** The current expression
  is `((text_chars / 3) as u32).clamp(120, 600)` — division by zero
  isn't a risk, but `text_chars = 0` is an unusual input worth pinning.
- **P4. Empty `text` still produces a valid user prompt.** Pin that
  `build_messages(Summarize, "")` returns a user message whose content
  ends with `:\n\n` (does not crash, does not strip the framing).

### `src-tauri/src/llm/provider_impl.rs`

- **PI1. Forward-compat on extra fields.** Fireworks `/v1/models` rows
  in the wild carry many fields (`owned_by`, `created`, `parent`,
  `kind`, …). Today's mock omits them. Add a test where the JSON has
  a half-dozen unknown fields per row — assert parse still succeeds.
- **PI2. `?page_size=20` query param is on the Fireworks URL.** The
  current wiremock matchers do not assert the query string at all.
  Add `.and(query_param("page_size", "20"))` so a regression that
  drops or renames the pagination param fails loudly.
- **PI3. Attribution headers (`HTTP-Referer`, `X-Title`) are sent.**
  These are required by OpenRouter for rate-limit attribution. No
  test asserts they ride on the request. Add header matchers.
- **PI4. 5xx mapping → `ServerError`.** 503/504 are common in the wild
  but unmapped by tests. Add a 503 case in `fetch_models_*` and
  assert `ProviderError::ServerError`.
- **PI5. Network error mapping.** TCP refused / DNS fail →
  `ProviderError::Network`. Today there's no test for this branch.
  Easiest path: point `base_url_override` at a closed port
  (`http://127.0.0.1:1`) and assert.
- **PI6. `factory_returns_correct_kind()` should also assert
  `label()` and `default_model()`.** The test only checks `kind()`,
  but the trait surface includes the other two — a renamed default
  in `default_model()` would not be caught.

---

## Suggested order of attack

1. **A5, A6, A11, A10** — five lines each. Knock them out in one PR.
2. **A1, A2, A7** — covers the panel state-machine edges the store
   was explicitly designed for.
3. **A3, A4** — the parser/error surfaces. Adds confidence under flaky
   network conditions.
4. **A8, A9** — settings/model picker assertion gaps.
5. **B1, B4, B5** — contract-level guarantees; worth the small shim
   investments.
6. **B6, B7, B8** — backend correctness gaps.
7. **Rust gaps `P1`/`PI1`–`PI3`** — five-minute wins on the
   best-tested module; close them while you're already there.
8. The C tier is optional and can ride along with feature work.
