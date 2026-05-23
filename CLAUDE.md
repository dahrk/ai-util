# CLAUDE.md / AGENTS.md

This file is the source of truth. `AGENTS.md` is a symlink to it.

## What this is

A Tauri 2 + React 18 + TypeScript desktop app that captures text on a global hotkey, runs an AI action (Summarize / Edit / Elaborate / Research), streams the response into a floating panel, and pastes back into the source app on accept. Primary provider Fireworks.ai; OpenRouter is automatic fallback. macOS first; Windows handled via platform-trait stubs.

## Live specs

| File | Role | Tie-breaker |
|---|---|---|
| `IMPLEMENTATION_PLAN.md` | Original 12-phase scope | Wins for "what's in scope" |
| `~/.claude/plans/bring-in-the-implementation-plan-md-greedy-quasar.md` | Recomposed 6-milestone working plan | Wins for sequencing & status |
| `DESIGN_BRIEF.md` | UX truth | Wins for visual/interaction questions |
| `DESIGN_NOTES.md` | Visual system, error registry, teammate comments from the Claude Design hand-off | Wins for pixel-level visual details |
| `design-reference/project/panel.jsx` | Reference prototype — the visual contract for the floating panel and all five states | Recreate pixel-perfect, don't import |

## Repo layout (key files)

```
src/                              # React + TS frontend
├── main.tsx                      # entry + route resolution
├── routes/
│   ├── Panel.tsx                 # floating panel; state-machine renderer
│   ├── Onboarding.tsx            # first-run window
│   └── Settings.tsx              # settings window
├── components/                   # ActionPicker, StreamingView, ResultView, ErrorView, ...
├── lib/
│   ├── store.ts                  # Zustand panel state machine
│   ├── tauri.ts                  # typed invoke/event wrappers
│   └── types.ts                  # shared types (mirror Rust structs)
└── styles/tokens.css             # design tokens (light/dark, motion)

src-tauri/                        # Rust backend
├── tauri.conf.json               # 3 windows: panel, settings, onboarding; macOSPrivateApi: true
├── capabilities/default.json     # plugin scopes
└── src/
    ├── lib.rs                    # app setup, plugin/command registration
    ├── hotkey.rs                 # global shortcut
    ├── settings.rs               # persisted settings via tauri-plugin-store
    ├── commands/                 # selection, completion, settings, window
    ├── llm/                      # gateway, providers, prompts, sse
    ├── window/panel.rs           # show/hide, positioning, clamp_to_monitor
    └── platform/                 # OS abstraction (see below)
```

## Platform abstraction

All OS-specific code lives in `src-tauri/src/platform/`. Three traits — `WindowChrome`, `Paster`, `CursorPos` — are defined in `platform/{chrome,paster,cursor}.rs`. macOS impls live in `platform/macos/`; Windows stubs (`unimplemented!()`) live in `platform/windows/`. Call sites use `crate::platform::PLATFORM.method(...)`; never write `#[cfg(target_os)]` at the call site.

**Adding Windows = fill in `platform/windows/{chrome,paster,cursor}.rs`. No other changes.**

## Build / run / test

```
pnpm install
pnpm tauri dev              # run app
pnpm typecheck              # tsc --noEmit
pnpm lint                   # eslint
pnpm test                   # vitest watch
pnpm test:run               # vitest CI mode

cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cargo test --test live_providers -- --ignored   # live API; requires FIREWORKS_API_KEY / OPENROUTER_API_KEY
```

Pre-commit (manual):
```
pnpm typecheck && pnpm lint && pnpm test:run \
  && (cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test)
```

## Conventions

- TS strict, no `any`.
- Rust: `thiserror` for typed errors, `anyhow` only at the command boundary.
- Tauri events + commands: lowercase snake_case.
- One Tauri command per logical operation.
- **Listeners before invokes.** Panel.tsx registers all streaming-event listeners once at mount; child components read state from the Zustand store.
- Provider-switched buffer reset: gateway emits `provider_switched` BEFORE yielding the first OpenRouter token. The store's `switchProvider` resets the tokens buffer.

## Settings

- Stored in `~/Library/Application Support/com.yourname.ai-text-actions/` via `tauri-plugin-store`.
- API keys are plaintext JSON for v1 PoC. **Production needs `keyring`** (TODO).

## Dev tips (macOS)

- **A11y permission resets on every dev rebuild** (Tauri changes the dev binary identity). Workaround: after `pnpm tauri dev` rebuilds, run
  ```
  codesign --force --deep --sign - src-tauri/target/debug/ai-text-actions
  ```
  to stabilize identity.
- `get-selected-text` may play the macOS alert beep when its clipboard fallback fires. See the crate's README for the documented workaround.
- `macOSPrivateApi: true` in `tauri.conf.json` is required for the NSPanel conversion. Do not remove.

## Known issues

- **macOS 26 packaged build: panel chrome is disabled.** On macOS 26.2 (and likely later 26.x), the obj-c calls in `platform/macos/chrome.rs` (`convert_to_panel` and/or `apply_vibrancy`) throw an NSException at `applicationDidFinishLaunching:` under the hardened runtime that `tauri build` enables. The exception unwinds through tao's `extern "C"` delegate, hits `panic_cannot_unwind`, and aborts the process before any window appears. `pnpm tauri dev` is unaffected (no hardened runtime). As a workaround, `setup()` in `lib.rs` skips both calls — see the `FIXME(macos-26)` block. Trade-off: in packaged builds the panel steals focus on show and won't float over fullscreen apps. To properly fix, replace the `setClass: NSPanel` swizzle with a real `objc2` subclass of `NSPanel` overriding `canBecomeKeyWindow` etc., then re-enable.
- **Fireworks model availability rotates.** A 404 with body `"... and/or not deployed"` from `validate_api_key` or completion means the model ID has been retired. Update `default_model()` in `src-tauri/src/llm/providers.rs` AND `PROVIDER_MODELS` in `src/lib/models.ts` (kept in sync) against `curl -s -H "Authorization: Bearer $KEY" https://api.fireworks.ai/inference/v1/models | jq '.data[].id'`.

## Milestone status

- [x] **M1** — Foundation, platform abstraction, empty floating panel · `1b16b94`
  - Quality gates: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` (8 tests pass), `pnpm typecheck`, `pnpm lint`, `pnpm test:run` (1 test passes)
  - Manual smoke pending from user (hotkey under 150ms, no focus steal, fullscreen float)
- [x] **M2** — Selection capture + ActionPicker UI · `b98bc53`
  - Quality gates: cargo (11 tests), vitest (27 tests), all lints clean
- [x] **M3** — LLM gateway + streaming · `e730f89`
  - Quality gates: 36 cargo unit + 2 #[ignore]d live integration tests, 34 vitest tests, all lints clean
  - Listeners-before-invokes contract live in `Panel.tsx`
- [x] **M4** — Result view + paste-back + extensible error registry · `60e33f9`
  - 36 cargo + 59 vitest tests; error states driven by `src/lib/errorKinds.ts` registry
- [x] **M5** — Onboarding + Settings + tray + live rebind · `67a8379`
  - 36 cargo + 81 vitest tests; addresses all 3 teammate comments from the design hand-off
- [x] **M6** — Snappiness + polish · `d233c74`
  - 39 cargo + 88 vitest tests; vibrancy + edge-flip + telemetry overlay (`Cmd+Shift+;`)
- _Post-M6 simplify pass (`b9ea133` `232b855` `e698a6b` `e911ec8`): net −172 lines of code with all 40 cargo + 88 vitest tests still green._
