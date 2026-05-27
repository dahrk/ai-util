# AI Text Actions

Select text in any app, press a hotkey, apply an AI action. Tokens stream into a small floating panel; on accept, the result replaces your original selection.

> **Status:** macOS supported. Windows scaffolded via platform-trait stubs (not yet implemented). PoC — API keys are stored as plaintext in the app data directory; swap to the system keychain (`keyring`) before any wider distribution.

## Features

- Four actions out of the box: **Summarize**, **Edit**, **Elaborate**, **Research**.
- Streaming via **Fireworks.ai** as the primary provider, with automatic **OpenRouter** fallback if Fireworks errors or rate-limits.
- Native macOS **NSPanel** chrome — floats over fullscreen apps, joins all spaces, never steals focus from the underlying app.
- **Keyboard-first**: `1`–`4` to pick an action, `Enter` to accept, `C` to copy, `R` to retry, `Backspace` to go back, `Esc` to dismiss.
- Configurable hotkey, per-provider default model, per-action prompt override (with "restore default").
- **Searchable model picker** with live `/v1/models` catalog, per-row **context-length chips** (`131K`, `1M`, …) and a context-length search filter — type `128k`, `1m`, or `200000` to narrow the list to models that meet that magnitude.
- **Long-selection preview** with click-to-expand / Show less in the picker — anything past ~240 chars collapses with an *"…and N more characters"* badge; expanding reveals the full selection in a bounded scroll region without resizing the panel.
- Dev telemetry overlay (`⌘⇧;`) showing hotkey-to-visible and first-token timings against the latency budget.

## Requirements

- **Rust** (stable toolchain)
- **Node 20+** and **pnpm**
- Tauri 2 platform prerequisites — https://v2.tauri.app/start/prerequisites/
- A **Fireworks API key** (required) — https://fireworks.ai/account/api-keys
- An **OpenRouter API key** (optional, used as automatic fallback) — https://openrouter.ai/keys

## Quick start (development)

```bash
pnpm install
pnpm tauri dev
```

On first run the **onboarding window** walks you through four steps:

1. **Welcome + macOS Accessibility permission** — required to read text selections from other apps. The flow polls and advances as soon as you grant it in System Settings → Privacy &amp; Security → Accessibility.
2. **Fireworks API key** (required).
3. **OpenRouter API key** (optional — Skip is fine).
4. **Default models** per provider (first option pre-selected).

Once onboarding completes, the app sits in the menu-bar tray. Press the hotkey to invoke it.

## Build (release)

```bash
pnpm tauri build
```

Produces an unsigned `.app` under `src-tauri/target/release/`. Code signing + notarization are out of scope for the PoC.

## Usage

1. Select text in any macOS app (Safari, Chrome, VS Code, Notes, Slack, …).
2. Press **`⌘⇧Space`** (default).
3. Pick an action with `1`–`4` (or click). Tokens stream into the panel.
   - `Enter` → replace the selection in the source app (paste-back preserves your prior clipboard).
   - `C` → copy result to clipboard.
   - `R` → retry the same action.
   - `Backspace` / `←` → back to the action picker.
   - `Esc` → dismiss.
4. From the menu-bar **tray icon**: open **Settings…** or **Quit**.

The default hotkey is `⌘⇧Space` on macOS and `Ctrl+Shift+Space` on Windows; both are rebindable from Settings and the new chord takes effect immediately.

## Configuration

The **Settings** window (tray → Settings…) covers:

- **Hotkey** — `Record` then press the new combo.
- **API keys** — Fireworks + OpenRouter, with reveal/hide and a Rust-mediated **Validate** button.
- **Default models** — per provider, opened via a searchable modal picker that lists the live `/v1/models` catalog. Each row shows the model id, an optional friendly label, and a **context-length chip** (`131K`, `1M`, …) when the provider exposes it. The search box also accepts context-length terms: `128k`, `1m`, or a bare `200000` (≥ 4 digits) filters to rows whose `context_length` meets that magnitude.
- **Actions** — enable/disable each of the four, and edit a per-action prompt override (`{text}` interpolates the selection). Use **Restore default** to clear an override.

Settings persist to `~/Library/Application Support/com.yourname.ai-text-actions/` via `tauri-plugin-store`. Plaintext JSON for v1 — see the status note above.

## Testing

```bash
# Frontend
pnpm typecheck
pnpm lint
pnpm test:run                                      # vitest, watch-free

# Backend (Rust)
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test                                         # unit tests + wiremock-backed gateway tests
cargo test --test live_providers -- --ignored      # live API; env-gated on FIREWORKS_API_KEY / OPENROUTER_API_KEY
```

Pre-commit sequence:

```bash
pnpm typecheck && pnpm lint && pnpm test:run \
  && (cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test)
```

### End-to-end (Playwright)

A browser-driven suite covers the panel state machine, settings flows,
onboarding, and a live Fireworks smoke pass via the dev `/playground`
route — 26 specs, ~40 s end-to-end. The Tauri runtime is replaced by an
in-browser shim (under `src/test/e2e/shims/`) whenever Vite boots with
`VITE_TEST_MODE=1`, so the React frontend runs in real Chromium against
the real Vite dev server with `@tauri-apps/*` resolved to JS-only fakes.

```bash
pnpm e2e            # headless
pnpm e2e:headed     # see the browser
pnpm e2e:ui         # interactive UI mode
pnpm e2e:report     # open the last HTML report
```

`playwright.config.ts` boots `pnpm dev` (with `VITE_TEST_MODE=1`) as
its `webServer`. If a dev server is already on port 1420, Playwright
reuses it.

**Real Fireworks vs mocked.** `panel.spec.ts`, `onboarding.spec.ts`
and most of `settings.spec.ts` use deterministic completion overrides
— no network. `playground.spec.ts` and the "validate real key" case
in `settings.spec.ts` hit `api.fireworks.ai` directly; they self-skip
if `FIREWORKS_API_KEY` is unset.

**`.env.test` setup.** Create a gitignored `.env.test` with your keys:

```bash
cat > .env.test <<'EOF'
# E2E test credentials. Loaded by playwright.config.ts.
FIREWORKS_API_KEY=fw_...
# Optional — if set, OpenRouter-fallback specs may hit OpenRouter too.
OPENROUTER_API_KEY=
EOF
```

Specs that need a live key call `requireFireworksKey()` /
`testInfo.skip(!FIREWORKS_KEY, …)`, so the suite stays green without
one — you just lose the live-streaming coverage.

**Coverage notes.** [`tests/e2e/README.md`](tests/e2e/README.md)
documents shim plumbing for adding new fakes;
[`tests/e2e/COVERAGE_GAPS.md`](tests/e2e/COVERAGE_GAPS.md) lists known
gaps (panel state-machine edges, error-path classifiers,
provider-failover ordering, settings persistence round-trips,
context-length search, a11y-probe failure path, Rust unit gaps),
prioritised by effort.

## Project structure

```
src/                  # React 18 + TypeScript frontend
  routes/             # Panel (floating), Onboarding, Settings windows
  components/         # ActionPicker, StreamingView, ResultView, ErrorView, …
  lib/                # Zustand state machine, typed Tauri wrappers, error registry, telemetry
  styles/             # design tokens + globals (warm-amber macOS vibrancy)

src-tauri/            # Rust backend (Tauri 2)
  src/
    commands/         # selection, completion, settings, window IPC commands
    llm/              # gateway (Fireworks → OpenRouter fallback), prompts, SSE parser, providers
    platform/         # OS abstraction: WindowChrome / Paster / CursorPos traits
    window/panel.rs   # show/hide + cursor-anchored positioning with edge-flip
    hotkey.rs         # global shortcut registration + live rebind
    settings.rs       # persisted via tauri-plugin-store
  tests/live_providers.rs  # #[ignore]d live integration tests

design-reference/     # Claude Design hand-off — visual contract for the floating panel
```

See [`CLAUDE.md`](CLAUDE.md) for the full file map and milestone status.

## Architecture pointers

- **Platform abstraction.** All OS-specific code lives in `src-tauri/src/platform/`. Three traits — `WindowChrome`, `Paster`, `CursorPos` — are implemented for macOS and stubbed (`unimplemented!()`) for Windows. Adding Windows = fill in `platform/windows/{chrome,paster,cursor}.rs`; no call-site changes anywhere else in the tree.
- **Streaming contract.** The Rust gateway emits Tauri events (`completion_token`, `provider_switched`, `completion_done`, `completion_error`). `Panel.tsx` registers all listeners once at mount (the **listeners-before-invokes** invariant). The gateway emits `provider_switched` *before* yielding any OpenRouter token, so the frontend's buffer-reset on switch is safe.
- **Extensible errors.** The frontend classifies a `CompletionError` from Rust into one of five kinds — `both-failed`, `rate-limit`, `invalid-key`, `no-connection`, `context-overflow` — via [`src/lib/errorKinds.ts`](src/lib/errorKinds.ts). Each kind defines header copy, body bullets, hint, and primary/secondary actions. Adding a new error kind is one registry entry; `ErrorView` is data-driven.

## Documentation map

| File | Purpose |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) (= `AGENTS.md`) | Agent + maintainer guide — conventions, milestone status, full file map, dev tips |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Original 12-phase build plan (historical scope reference) |
| [`DESIGN_BRIEF.md`](DESIGN_BRIEF.md) | UX specification — states, components, motion, dimensions |
| [`DESIGN_NOTES.md`](DESIGN_NOTES.md) | Visual system, error registry contract, teammate comments from the design hand-off |
| [`design-reference/`](design-reference/) | The Claude Design hand-off bundle — pixel-perfect reference for the floating panel |

## Roadmap

Not yet done; in rough priority order:

- Real Windows implementation (`platform/windows/*.rs` stubs in place).
- Code signing + notarization on macOS; MSI bundle on Windows.
- System-keychain (`keyring`) storage for API keys (replaces plaintext JSON).
- **Adaptive output formatting** — classify the selection (code, shell,
  JSON, prose, …) and inject a format directive into the prompt so
  results come back fenced when they should be and as plain text when
  they shouldn't. Includes an Auto / Code / Prose / Raw mode selector in
  the Playground. Specced in
  [`docs/specs/adaptive-formatting.md`](docs/specs/adaptive-formatting.md).
- **Quick Command (beta)** — when the hotkey fires with nothing
  selected, the panel today shows a "Select some text first" card.
  The beta turns that into an inline input box where you type a prompt
  ("write a git commit message for staged changes", "translate to
  French", …) and the response streams back through the same panel
  pipeline. Gated on a default-on `quick_command_enabled` setting and
  marked as **Beta** in-app — shape of the prompt/UI may change.
  Specced in
  [`docs/specs/quick-command-beta.md`](docs/specs/quick-command-beta.md).
- Custom user-defined actions.
- See `IMPLEMENTATION_PLAN.md` § "What's out of scope for v1" for the broader list.

## License

[MIT](LICENSE).
