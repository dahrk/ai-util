# AI Text Actions

An OS-wide utility for macOS and Windows. Select text in any app, press a hotkey, apply an AI action (Summarize, Edit, Elaborate, Research). The result streams into a floating panel and replaces the original selection on accept.

Built with Tauri v2. Uses Fireworks.ai as the primary LLM provider with OpenRouter as an automatic fallback.

## Documents

- **`IMPLEMENTATION_PLAN.md`** — the sequential build plan. Start here.
- **`DESIGN_BRIEF.md`** — UX specification covering all states, components, and visual direction.

## Quick start (after Phase 0)

```bash
pnpm install
pnpm tauri dev
```

You'll need:
- Rust toolchain (stable)
- Node 20+ and pnpm
- Platform-specific Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- A Fireworks API key (required) — https://fireworks.ai/account/api-keys
- An OpenRouter API key (optional, recommended) — https://openrouter.ai/keys

## Default hotkey

- macOS: `⌘⇧Space`
- Windows: `Ctrl+Shift+Space`

Configurable in the Settings window after first run.

## Status

PoC. Targeting a single user / single machine. API keys are stored in app data, not the system keychain — fine for prototyping, swap to `keyring` crate before any wider distribution.

## Project structure

See `IMPLEMENTATION_PLAN.md` § "Project structure" for the full file tree.
