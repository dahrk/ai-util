# AI Text Actions

Select text in any app, press a hotkey, apply an AI action. Tokens stream into a small floating panel; on accept, the result replaces your original selection.

> **Status:** macOS supported. Windows scaffolded via platform-trait stubs (not yet implemented). PoC — API keys are stored as plaintext in the app data directory; swap to the system keychain (`keyring`) before any wider distribution.

## Features

- Four actions out of the box: **Summarize**, **Edit**, **Elaborate**, **Research**.
- Streaming via **Fireworks.ai** as the primary provider, with automatic **OpenRouter** fallback if Fireworks errors or rate-limits.
- Native macOS **NSPanel** chrome — floats over fullscreen apps, joins all spaces, never steals focus from the underlying app.
- **Keyboard-first**: `1`–`4` to pick an action, `Enter` to accept, `C` to copy, `R` to retry, `Backspace` to go back, `Esc` to dismiss.
- Configurable hotkey, per-provider default model, per-action prompt override (with "restore default").
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
- **Default models** — per provider, free-form text input.
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
- Custom user-defined actions.
- See `IMPLEMENTATION_PLAN.md` § "What's out of scope for v1" for the broader list.
