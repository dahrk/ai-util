# Spec: Dev Mode panel + "Keep panel open after action" toggle

Two small Settings-window additions. They share a section ("Developer")
but are independently shippable; each is broken out below.

- **(a) Dev Mode section** — surfaces playground-equivalent controls
  inside Settings behind a collapsible disclosure. Today the Playground
  is its own window (`/playground`, debug-only); Dev Mode pulls a
  subset of its knobs into Settings so a developer can iterate without
  juggling two windows.
- **(b) "Keep panel open after action"** — a per-user toggle that
  suppresses the `paste_back` panel-auto-hide. Useful when working in
  an external editor and reviewing the AI result against the original.

Both are **PoC-scope developer affordances**. They do not change the
default user experience: defaults match today's behaviour exactly.

---

## (a) Dev Mode settings section

### Goals

1. Let a developer pick a model, type a source string, run an action,
   and inspect the streamed result **without** leaving the Settings
   window or granting OS accessibility permission.
2. Keep the regular Settings UI uncluttered for normal users: the
   section is collapsed by default, behind a toggle.
3. Consolidate existing developer-only toggles
   (`dev_panel_persistent`, the new "Keep panel open" from part (b))
   under one heading so they're discoverable as a group.

### Non-goals

- Replace the Playground window. Playground stays as the
  full-screen "throwaway sandbox" route. Dev Mode is the inline,
  always-available subset.
- Expose dev controls in production builds. Dev Mode is gated on
  `cfg(debug_assertions)` *on the Rust side* — the section either
  renders or doesn't.

### UI placement

A new `<Section>` at the **bottom** of `src/routes/Settings.tsx`,
after **Actions**, titled **"Developer"**, hint:
*"Inline playground + panel-behaviour toggles. Debug builds only."*

Disclosure behaviour:

- Header strip with a chevron + the title; click toggles open/closed.
- Default state: **closed**. Open state is in-memory only (does not
  persist across reloads of the Settings window) — see "Persistence"
  below for the rationale.
- When closed, only the heading row is visible; when open, the
  contents render.

### Contents (open state)

Ordered top-to-bottom inside the section:

1. **Toggles row** — checkboxes that already exist or are introduced
   in this spec:
   - "Keep panel open after action" *(see part (b))* — key
     `keep_panel_open_after_action`.
   - "Panel never auto-hides on blur (drag/inspect)" — existing
     key `dev_panel_persistent`. Moved here from its current
     standalone position.

2. **Inline playground card**:
   - Provider radio (`fireworks` / `openrouter`) — defaults to whatever
     `default_provider` resolves to today.
   - Source textarea (`data-testid="dev-source"`, ~4 rows).
   - Action buttons — Summarize / Edit / Elaborate / Research
     (mirroring `Playground.tsx`'s row).
   - Result panel — streams tokens. Reuses the existing
     `StreamingView`/`ResultView` components.
   - Status pill — `ready` / `streaming` / `done · copied` / `error`
     (same vocab as Playground).

The inline playground does **not** auto-copy to clipboard or attempt
paste-back — that's a Playground-only behaviour. Dev Mode is
inspection-only.

### Relation to existing surfaces

- `dev_panel_persistent` moves into this section. It keeps its
  current key, its current persistence semantics, and its current
  test (`tests/e2e/settings.spec.ts` →
  `dev_panel_persistent toggle round-trips into store`) — only the
  visual location changes. The test should be updated to first
  expand the Developer section before clicking the checkbox.
- The standalone `/playground` route is untouched. The tray menu
  still links to it under `#[cfg(debug_assertions)]`.

### New / changed setting keys

None for the disclosure state (UI-local).
The toggles inside reference existing keys (`dev_panel_persistent`)
and the new key from part (b) (`keep_panel_open_after_action`).

### Defaults

- Disclosure: closed.
- All toggles inside: their pre-existing defaults
  (`dev_panel_persistent = false`,
  `keep_panel_open_after_action = false`).

### Persistence behaviour

| Surface | Persists? | Where |
|---|---|---|
| Disclosure open/closed | No | UI-local `useState`. Re-collapses on reload to keep the section out of the way. |
| Toggles inside | Yes | `tauri-plugin-store` (existing path). |
| Inline playground source + result | No | Ephemeral. |
| Provider radio | No | UI-local for this spec — could later persist as `dev_default_provider` if asked. |

### Affected files

- `src/routes/Settings.tsx` — add `<Section title="Developer">`, move
  the `dev_panel_persistent` checkbox in, add the new toggle from
  part (b), embed the inline playground.
- `src/routes/Settings.css` — disclosure chevron, expand animation
  (match the existing token vocabulary).
- `src/components/InlineDevPlayground.tsx` *(new)* — extracted from
  `routes/Playground.tsx` body. The Playground route becomes a thin
  wrapper around this component to avoid duplication.
- `src/routes/Playground.tsx` — refactor to delegate to
  `InlineDevPlayground`.
- `src/lib/tauri.ts` — no changes if we reuse `runCompletion`'s
  `surface` parameter; the inline playground passes
  `surface: "dev-mode"` so events land on the Settings window.
- Backend command surface — only changes if we add the new
  `keep_panel_open_after_action` setter; see part (b).
- Debug-build gating: a single `if (import.meta.env.DEV)` (or its
  Tauri equivalent) wraps the disclosure render; tests get the
  expanded surface via `gotoWithSettings`.

### Migration notes

- No new schema fields beyond part (b)'s key — and `serde(default)`
  on that field means *no migration required* for users upgrading
  with an existing `settings.json`. Old documents that don't have
  the field get `false` on load.
- Removing `dev_panel_persistent` from its current standalone slot
  is a UI-only move; the persisted value is untouched.

### Test plan

| Layer | Test |
|---|---|
| Vitest (`Settings.test.tsx`) | Section renders collapsed on mount; clicking the header toggles. |
| Vitest | Inline playground delegates to `runCompletion` with `surface: "dev-mode"`. |
| Playwright (`settings.spec.ts`) | Open Settings → expand Developer → flip `dev_panel_persistent` → assert it persists (re-uses the existing assertion but adapts to the new path). |
| Playwright (new spec: `dev-mode.spec.ts`) | Expand → fill source → click Summarize (mocked stream override) → result text renders inline. |
| Playwright | The disclosure does **not** persist across reload (negative test). |
| Cargo | No new tests required if the inline playground reuses `run_completion`. |

---

## (b) "Keep panel open after action" toggle

### Goals

Prevent the floating panel from auto-hiding after `paste_back` (and
the implicit blur it triggers). Useful for:

- A/B comparing the AI output against the still-selected source.
- Multi-step "iterate on the result then paste" workflows.
- Debugging the panel's post-result state.

### Where the hide happens today

`src-tauri/src/commands/selection.rs` — `paste_back` calls
`crate::window::panel::hide_panel(&app)` at line 52, gated on
`panel_was_visible`. After hiding, it waits ~40 ms for macOS to
return focus to the source app and then synthesises Cmd+V.

Quoted snippet:

```rust
if panel_was_visible {
    if let Err(e) = crate::window::panel::hide_panel(&app) {
        tracing::warn!("paste_back: hide_panel failed: {e}");
    }
    // Settle delay: macOS needs a tick to transfer focus back to the
    // source app before our synthesized Cmd+V is delivered to it.
    tokio::time::sleep(Duration::from_millis(40)).await;
}
```

This is the **single call site** that needs to consult the new
setting.

### New setting key

```rust
// AppSettings
#[serde(default)]
pub keep_panel_open_after_action: bool,
```

Default: `false` (today's behaviour).

### UI placement

Inside the new **Developer** section from part (a). Label:

> **Keep panel open after action**
> Don't auto-hide the panel after paste-back. Useful for reviewing
> the AI output against the original selection. The hotkey still
> dismisses.

`data-testid="keep-panel-open"` for the checkbox. Settings command:
`set_keep_panel_open_after_action(value: bool)`.

If part (a) ships later, this checkbox can live as a standalone row
under "Settings → Panel behaviour" in the interim; the spec is
agnostic about ordering.

### Behaviour

`paste_back` is amended to read the setting before hiding:

```rust
let keep_open = crate::settings::load(&app).await
    .map(|s| s.keep_panel_open_after_action)
    .unwrap_or(false);

if panel_was_visible && !keep_open {
    if let Err(e) = crate::window::panel::hide_panel(&app) { … }
    tokio::time::sleep(Duration::from_millis(40)).await;
}
```

Two important details:

1. **Paste synthesis is unaffected.** Cmd+V is still synthesised
   even when the panel stays open. macOS still routes the keystroke
   to whatever currently has key focus; because the panel was set
   up as an `NSPanel` that *doesn't* steal focus, the source app
   continues to be the keystroke target. (If a future tester finds
   this isn't reliable in practice, the toggle gains a second
   sub-option *"Hide briefly to deliver paste, then reappear"* —
   not in scope for this spec.)
2. **The 40 ms settle delay is skipped** when `keep_open` is true.
   No hide → no focus transfer needed.

### Interaction with dismiss-on-blur

There are two related mechanisms:

| Mechanism | Trigger | Setting that disables it |
|---|---|---|
| `dev_panel_persistent` | Window blur (clicking out, focus loss) | already exists |
| `keep_panel_open_after_action` | Programmatic `paste_back` only | new, this spec |

Both can be on together (developer mode) or independently:

- Only `keep_panel_open_after_action`: panel stays after paste-back
  but a manual click outside still dismisses it (normal user wants
  to iterate but expects "click away to close").
- Only `dev_panel_persistent`: panel still hides on paste-back, but
  blur doesn't dismiss otherwise. (Debugging the post-stream UI.)
- Both: panel sticks around until the hotkey dismiss or app quit.

The hotkey (`toggle_panel`) and the explicit dismiss affordance in
the panel are **never** gated by either setting — those are always
user-driven dismissals.

### Default value

`false`. Today's behaviour is the default.

### Affected files

- `src-tauri/src/commands/settings.rs` — add the field to
  `AppSettings` with `#[serde(default)]`; add a setter command
  `set_keep_panel_open_after_action`.
- `src-tauri/src/commands/selection.rs` — read the setting in
  `paste_back` and gate the `hide_panel` + sleep block.
- `src-tauri/src/lib.rs` — register the new command in the
  `tauri::generate_handler!` list.
- `src/lib/tauri.ts` — typed wrapper
  `setKeepPanelOpenAfterAction(value: boolean)`; widen
  `AppSettings` type.
- `src/lib/types.ts` — the `AppSettings` type mirror.
- `src/routes/Settings.tsx` — checkbox row in the Developer section.
- `src/test/e2e/shims/state.ts` — extend `AppSettingsShape`.
- `src/test/e2e/shims/commands.ts` — add the new setter to the
  dispatch table.

### Setting keys (summary)

| Key | Type | Default | Owner |
|---|---|---|---|
| `keep_panel_open_after_action` | `bool` | `false` | this spec |

### Migration notes

`#[serde(default)]` means an existing `settings.json` without the
field loads cleanly with `false`. There is no schema version bump
required.

If at any point we group developer toggles under a nested object
(e.g. `dev: { panel_persistent: …, keep_open: … }`), that's a
follow-up migration — not in scope here. The flat field layout
matches the rest of `AppSettings`.

### Test plan

**Cargo**

- `settings::tests::keep_panel_open_default_false` — `AppSettings`
  built from `Default::default()` has the field `false`.
- `settings::tests::keep_panel_open_missing_field_loads_default` —
  a JSON like `{"fireworks_key":"k"}` loads with the field `false`
  (the `serde(default)` boundary).
- `settings::tests::keep_panel_open_roundtrips` — set true, save,
  load, assert true.
- `commands::selection` — extract the gating logic into a small
  pure function so it's testable without spawning a runtime; assert
  that the function returns "skip hide" iff `keep_panel_open` is
  true.

**Vitest**

- `Settings.test.tsx` — toggle the checkbox; assert
  `setKeepPanelOpenAfterAction(true)` is invoked.

**Playwright**

- `panel.spec.ts` — new case: seed
  `keep_panel_open_after_action: true`, drive a stream to a result,
  click *Replace selection* (paste-back), assert
  `isPanelVisible(page)` stays true and the panel content remains.
- `panel.spec.ts` — regression case: same flow with the setting
  `false`, assert `isPanelVisible(page)` flips to false. (This may
  already be implicit elsewhere; promote it to an explicit
  assertion.)
- `settings.spec.ts` — the new checkbox round-trips into
  `getSettings()`.

### Open questions

- Should the panel auto-dismiss on the *next* hotkey press even
  when this setting is on? Today's `toggle_panel` already handles
  this; no change needed. Confirm with manual testing.
- If the user pastes back, edits the source, and re-invokes the
  hotkey while the panel is still open, the panel currently
  re-anchors to the new cursor position. Does that still make
  sense when `keep_panel_open_after_action = true`? Probably yes,
  but flag for design review.
