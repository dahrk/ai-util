# AGENTS.md

This file is the source of truth for agents. `AGENTS.md` is a symlink to it
(`CLAUDE.md`). Keep it short — a **map**, not an encyclopedia. Detailed rules
live next to the code they govern (see the doc index); update those, not this.

## What this is

A Tauri 2 + React 18 + TypeScript desktop app that captures selected text on a
global hotkey, runs an AI action (Summarize / Edit / Elaborate / Research),
streams the response into a floating panel, and pastes back into the source app
on accept. Primary provider Fireworks.ai; OpenRouter is the automatic fallback.
macOS first; Windows handled via platform-trait stubs.

## Architecture map

| Domain | Where |
|---|---|
| App setup, command/plugin registration, tray, menu | `src-tauri/src/lib.rs` |
| Global hotkey + capture/show flow | `src-tauri/src/hotkey.rs` |
| Selection capture + A11y classification | `src-tauri/src/selection.rs` |
| LLM streaming, provider fallback, cancellation | `src-tauri/src/llm/gateway.rs` |
| SSE delta parsing | `src-tauri/src/llm/sse.rs` |
| Prompt templates + token caps | `src-tauri/src/llm/prompts.rs` |
| Per-provider model catalog (trait + factory) | `src-tauri/src/llm/provider_impl.rs` |
| Tauri commands (selection, completion, settings, window, models) | `src-tauri/src/commands/` |
| Persisted settings (tauri-plugin-store) | `src-tauri/src/settings.rs` |
| Shared app state (selection + cancel-token slot) | `src-tauri/src/state.rs` |
| OS abstraction (chrome / paster / cursor traits) | `src-tauri/src/platform/` |
| Panel positioning (edge-flip, clamp) | `src-tauri/src/window/panel.rs` |
| Panel state-machine renderer | `src/routes/Panel.tsx` |
| Zustand panel store (idle→picking→streaming→result/error) | `src/lib/store.ts` |
| Typed IPC wrappers (invoke/event) | `src/lib/tauri.ts` |
| Shared FE/BE types | `src/lib/types.ts` |
| Extensible error registry | `src/lib/errorKinds.ts` |
| Panel sub-views (ActionPicker, StreamingView, ResultView, ErrorView, …) | `src/components/` |
| Settings / Onboarding / Playground windows | `src/routes/` |
| Design tokens (light/dark, motion) | `src/styles/tokens.css` |

## Working agreements

- **Run / build / test commands:** see [README.md](README.md) (Quick start,
  Build, Testing). Don't restate them here — they drift.
- **TS:** strict, no `any`; derive state, don't store what you can compute.
- **Rust:** see [src-tauri/AGENTS.md](src-tauri/AGENTS.md). Never `unwrap()` in
  production paths; go through `crate::platform::PLATFORM`, not `#[cfg]`.
- **Listeners before invokes.** `Panel.tsx` registers every streaming-event
  listener once at mount; children read state from the Zustand store.
- **Async listen + sync cleanup is a leak.** Use the cancel-flag pattern in
  `src/lib/hooks.ts` (`useTauriEvent`) for any `listen()` subscription.
- **Provider-switch buffer reset:** the gateway emits `provider_switched`
  *before* the first OpenRouter token; the store resets the buffer on it.
- API keys are plaintext JSON (v1 PoC) — production needs `keyring` (TODO).
- Don't commit secrets (`.env.test` is git-ignored; keys live there for e2e).
- Adding Windows = fill in `platform/windows/*`; no call-site changes.

## Doc index

| Doc | What it covers |
|---|---|
| [README.md](README.md) | Install, build, run, test commands; user-facing feature/usage overview |
| [src-tauri/AGENTS.md](src-tauri/AGENTS.md) | Rust conventions, platform abstraction, gateway contracts, **known issues** (macOS 26 NSPanel abort, Fireworks model rotation), macOS dev tips |
| [tests/e2e/README.md](tests/e2e/README.md) | Playwright + browser-shim model, how a test talks to the app, adding a shim, debugging |
| [tests/e2e/COVERAGE_GAPS.md](tests/e2e/COVERAGE_GAPS.md) | Known untested scenarios in the e2e suite |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Original 12-phase scope — wins for "what's in scope" |
| [DESIGN_BRIEF.md](DESIGN_BRIEF.md) | UX truth — wins for visual/interaction questions |
| [DESIGN_NOTES.md](DESIGN_NOTES.md) | Visual system, error registry, design hand-off comments — wins for pixel detail |
| [design-reference/project/panel.jsx](design-reference/project/panel.jsx) | Reference prototype — the visual contract for the panel and all five states (recreate, don't import) |
| [docs/specs/dev-mode-and-panel-persist.md](docs/specs/dev-mode-and-panel-persist.md) | Developer settings section + "keep panel open after action" toggle |
| [docs/specs/adaptive-formatting.md](docs/specs/adaptive-formatting.md) | Classify selection (Code/JSON/Prose/…) and inject a format directive into the prompt |
| [docs/specs/quick-command-beta.md](docs/specs/quick-command-beta.md) | Empty-selection Cursor-Cmd+K-style inline command bar with `@`-references |

When a spec and the code disagree, the spec wins for *its* scope; otherwise the
code is authoritative. `IMPLEMENTATION_PLAN.md` wins for scope questions.

## Feature status

| Feature | Status |
|---|---|
| Floating panel + 4 actions + streaming + paste-back | implemented |
| Provider fallback (Fireworks → OpenRouter) | implemented |
| Onboarding, Settings, tray, live hotkey rebind | implemented |
| Telemetry overlay (`Cmd+Shift+;`) | implemented |
| Live model picker (`/v1/models`) | implemented |
| Dev mode + "keep panel open" toggle | specced |
| Adaptive output formatting | specced |
| Quick Command (empty-selection command bar) | beta — specced, not implemented |
| Windows support | planned (platform stubs only) |
