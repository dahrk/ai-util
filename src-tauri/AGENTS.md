# src-tauri — backend agent notes

Rust backend for AI Text Actions. Detail that's specific to the Tauri/Rust
side lives here so the root `AGENTS.md` can stay a short map. See the root
file for the architecture overview and doc index.

## Conventions

- `thiserror` for typed library errors; `anyhow` only at the command boundary.
- **Never `unwrap()`/`expect()` in production paths.** The only sanctioned
  panics are at process init (e.g. the `OnceCell` HTTP client) and in tests.
  Prefer `.context(...)`/typed errors and log-don't-fail for best-effort work
  (clipboard restore, telemetry emits).
- One `#[tauri::command]` per logical operation; events + commands are
  lowercase `snake_case`.
- No `#[cfg(target_os)]` at call sites — go through `crate::platform::PLATFORM`.
- Run `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` before
  committing backend changes (see root README for the full pre-commit chain).

## Layout

```
src/
├── lib.rs                  # app setup, plugin/command registration, tray, menu
├── hotkey.rs               # global shortcut + on_hotkey capture/show flow
├── selection.rs            # get-selected-text wrapper, A11y error classification
├── settings.rs             # tauri-plugin-store load/mutate (spawn_blocking)
├── state.rs                # AppState: last_selection + (gen, cancel_token) slot
├── util.rs                 # now_ms(), PANEL_LABEL
├── commands/               # selection, completion, settings, window, models
├── llm/
│   ├── gateway.rs          # streaming, provider fallback, cancellation contract
│   ├── sse.rs              # OpenAI-compatible SSE delta parser
│   ├── prompts.rs          # Action templates, max_tokens_for, overrides
│   ├── providers.rs        # Provider enum + ProviderConfig
│   └── provider_impl.rs    # per-provider trait + factory (/v1/models)
└── platform/               # OS abstraction (see below)
```

## Platform abstraction

Three traits — `WindowChrome`, `Paster`, `CursorPos` — defined in
`platform/{chrome,paster,cursor}.rs`. macOS impls in `platform/macos/`;
Windows stubs (`unimplemented!()`) in `platform/windows/`. Call sites use
`crate::platform::PLATFORM.method(...)`.

**Adding Windows support = fill in `platform/windows/{chrome,paster,cursor}.rs`.
No other changes.**

## Gateway contracts (don't break these)

- **Provider switch ordering.** On Fireworks failure the gateway calls
  `on_provider_switch(Fireworks, OpenRouter)` BEFORE yielding any OpenRouter
  token. The frontend store resets its token buffer on `provider_switched`;
  if a token arrived first it would be wiped.
- **Cancellation.** The cancel token is checked between chunks via
  `tokio::select!`; a cancelled stream returns `GatewayError::Cancelled` and
  emits no `completion_done`/`completion_error`.
- **Completion supersession.** Each `run_completion` stamps `AppState` with a
  monotonic generation; a finishing task only clears the cancel-token slot if
  it still owns that generation. Don't revert to an unconditional clear — it
  reintroduces a race where a superseded run cancels nothing.

## Settings storage

- JSON document at `settings.json` in the app data dir via `tauri-plugin-store`.
- API keys are **plaintext for v1 PoC.** Production needs the system keychain
  (`keyring` crate) — TODO.
- `#[serde(default ...)]` only fires on *missing* fields, not on
  `Default::default()`; the seeding behavior is tested at the deserialize
  boundary in `settings.rs`.

## Known issues

- **macOS 26 packaged build: panel chrome is disabled.** On macOS 26.2 (and
  likely later 26.x) the obj-c calls in `platform/macos/chrome.rs`
  (`convert_to_panel` / `apply_vibrancy`) throw an NSException at
  `applicationDidFinishLaunching:` under the hardened runtime that
  `tauri build` enables. The exception unwinds through tao's `extern "C"`
  delegate, hits `panic_cannot_unwind`, and aborts before any window appears.
  `pnpm tauri dev` is unaffected (no hardened runtime). `setup()` in `lib.rs`
  skips both calls — see the `FIXME(macos-26)` block. Trade-off: packaged
  builds steal focus on show and won't float over fullscreen apps. Proper fix:
  replace the `setClass: NSPanel` swizzle with a real `objc2` subclass of
  `NSPanel` overriding `canBecomeKeyWindow`, then re-enable.
- **Fireworks model availability rotates.** A 404 with body
  `"... and/or not deployed"` from `validate_api_key` or completion means the
  model id was retired. Update `default_model()` in `llm/provider_impl.rs` AND
  `PROVIDER_MODELS` in `src/lib/models.ts` (kept in sync) against:
  `curl -s -H "Authorization: Bearer $KEY" https://api.fireworks.ai/inference/v1/models | jq '.data[].id'`.

## Dev tips (macOS)

- **A11y permission resets on every dev rebuild** (Tauri changes the dev
  binary identity). After `pnpm tauri dev` rebuilds, stabilize identity with:
  ```
  codesign --force --deep --sign - src-tauri/target/debug/ai-text-actions
  ```
- `get-selected-text` may play the macOS alert beep when its clipboard
  fallback fires — see that crate's README for the mute workaround.
- `macOSPrivateApi: true` in `tauri.conf.json` is required for the NSPanel
  conversion. Do not remove.
