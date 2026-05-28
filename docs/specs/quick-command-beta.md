# Spec: Quick Command (Beta)

Status: **Beta — specced, not implemented.**

When the hotkey fires with no text selected, replace the dead-end
"Select some text first" card with a **Cursor Cmd+K-style inline
command bar**: a compact, single-line floating input that grows
as the user types, expands downward as tokens stream, and dismisses
on `Esc`. Optional `@`-references inject context (clipboard, app
name), and a small row of action chips offers one-tap prompts.

This is purely **additive**. The existing `EmptySelection` view
becomes the fallback when the feature is disabled.

---

## 1. UX target — what "Cursor-inspired" means here

Cursor's Cmd+K is doing four things that we want to replicate within
the constraints of an NSPanel that floats over arbitrary macOS apps:

1. **An inline floating bar**, not a destination view. The bar
   appears at the point of invocation and feels like an overlay on
   the surrounding work, not a window you've navigated into.
2. **Inline streaming**, not a new view transition. Tokens appear
   *immediately below the input* in the same surface; the input
   itself remains visible the entire time.
3. **Context references** that you compose into the prompt with
   `@`-syntax (Cursor's `@file`, `@symbol`, `@docs`). For us, the
   buildable v1 set is `@clipboard` and `@app`.
4. **Quick action chips** below the input — single-tap prompt
   templates (Cursor uses Generate / Edit / Explain / Chat).

What we explicitly do **not** copy from Cursor:

- **Diff/preview before-apply.** Cursor produces *edits to code*;
  it has both a "before" and an "after" to render a diff over. Quick
  Command produces *new text in response to an instruction* — there
  is no "before." The streaming output is itself the preview; the
  user accepts it by clicking *Copy* or *Replace at cursor* (see §6).
- **Tab-completion of suggestions while typing.** Out of scope for
  v1; revisit only after the recorder shows users actually want it.

---

## 2. Current empty-selection flow (where we plug in)

The empty path today is short and lives entirely in the frontend:

1. `hotkey.rs::on_hotkey` ([`src-tauri/src/hotkey.rs:52`](../../src-tauri/src/hotkey.rs))
   spawns `selection::capture` and emits `selection_captured` with
   whatever text came back (including `""`).
2. `Panel.tsx` ([`src/routes/Panel.tsx:75-82`](../../src/routes/Panel.tsx))
   handles `onSelectionCaptured`, calling `store.setSelection(sel)`.
3. The store transitions to `{ kind: "picking", selection }`
   ([`store.ts:30`](../../src/lib/store.ts)).
4. Inside [`ActionPicker.tsx:36-37,62-64`](../../src/components/ActionPicker.tsx),
   `isEmpty = !selection.text.trim()` branches into rendering
   `<EmptySelection onDismiss={dismiss} />` — a static card with no
   path forward.

The `selection.text === ""` payload already includes `source_app`
populated by `frontmost_app_name()` in
[`src-tauri/src/selection.rs:41,63`](../../src-tauri/src/selection.rs)
— meaning the **app context for `@app` is already captured**
on every hotkey press, no new IPC needed.

The streaming pipeline (`run_completion` →
`completion_token` / `provider_switched` / `completion_done` /
`completion_error`; see [`commands/completion.rs:36-173`](../../src-tauri/src/commands/completion.rs))
is re-used unchanged — Quick Command rides the same four Tauri events.

---

## 3. Panel shape — inline bar that grows

The Quick Command surface is **one** view that internally renders
input + (optionally) chips + (optionally) streaming output + (optionally)
the post-stream action row. It does **not** navigate to the existing
`StreamingView` / `ResultView` components; those keep their roles
for the selection-driven actions.

### Visual states

```
A. Idle (just appeared)                                  height: ~64 px
┌──────────────────────────────────────────────────────────┐
│  ▢ Ask anything…                              [Beta]    │   input row
│  ┌──┐ ┌──┐ ┌────┐ ┌──────┐ ┌────────┐ ┌─────────┐       │   chip row
│  │@cb│ │@app│ │Explain│ │Translate│ │Brainstorm│ │Improve │   (collapsible)
│  └──┘ └──┘ └────┘ └──────┘ └────────┘ └─────────┘       │
└──────────────────────────────────────────────────────────┘
   ↵ submit · Esc dismiss · @ for context · Tab cycles chips


B. Streaming (after Enter)                              height: grows
┌──────────────────────────────────────────────────────────┐
│  ▢ write a tweet about capybaras           Cancel ⏎    │   input pinned
├──────────────────────────────────────────────────────────┤
│  Capybaras are nature's chillest rodent — friend to    │   streaming
│  every species they meet. Catch them snoozing with     │   region
│  birds on their backs in▌                              │
└──────────────────────────────────────────────────────────┘


C. Done                                                height: grows
┌──────────────────────────────────────────────────────────┐
│  ▢ write a tweet about capybaras                    ⏎    │
├──────────────────────────────────────────────────────────┤
│  Capybaras are nature's chillest rodent — …             │
│  [the full result text]                                  │
├──────────────────────────────────────────────────────────┤
│  Copy ⌘C · Replace at cursor ↵ · Retry ⌘R · Esc dismiss │   action row
└──────────────────────────────────────────────────────────┘


D. Error                                               height: grows
┌──────────────────────────────────────────────────────────┐
│  ▢ write a tweet about capybaras                    ⏎    │
├──────────────────────────────────────────────────────────┤
│  ⚠ Invalid API key — check Settings.                     │   compact ErrorRow
│  [Retry] [Open settings]                                 │
└──────────────────────────────────────────────────────────┘
```

The panel **grows downward** as state transitions B→C; the input row
never moves. Width is fixed at the existing `--panel-width: 380px`
(see [`src/styles/tokens.css:88`](../../src/styles/tokens.css)).
The webview window resizes to fit content (the existing panel
already uses content-driven height in dev; see
[`window/panel.rs:84`](../../src-tauri/src/window/panel.rs) reading
`window.outer_size()` for positioning math, which already tolerates
post-show resizes).

### Layout primitives

```
<div class="qc-bar">
  <div class="qc-input-row">
    <textarea data-testid="quick-command-input" ... />
    <BetaChip />
    <button class="qc-submit">↵</button>          // or <Cancel> during stream
  </div>
  {state.kind === "idle" && <div class="qc-chips">…</div>}
  {state.kind === "streaming" && <div class="qc-stream">{tokens}<Caret/></div>}
  {state.kind === "result"    && <div class="qc-stream">{result}</div>}
  {state.kind === "result"    && <div class="qc-actions">…</div>}
  {state.kind === "error"     && <ErrorRow … />}
</div>
```

`qc-stream` is a bounded-height scrollable region (`max-height:
50vh`, `min-height: 32px`); long responses scroll inside the panel
instead of pushing the window past the screen.

### Input behavior

| Key                         | Action                                                                                  |
|-----------------------------|-----------------------------------------------------------------------------------------|
| Enter                       | Submit (if prompt non-empty and not currently streaming)                                |
| Shift+Enter                 | Insert newline; textarea auto-grows from 1 → ~5 rows (capped, scrolls beyond)           |
| Esc                         | Streaming → cancel; idle/result/error → dismiss panel                                  |
| Tab                         | Move focus across the chip row (forward); Shift+Tab reverses                            |
| ⌘C  (when result visible)   | Copy the full result to clipboard                                                       |
| ⌘R  (when result/error)     | Retry the same prompt                                                                   |
| ⌘⏎                          | Force submit (covers IME composition cases)                                             |
| `@`                         | Triggers the `@`-reference popover (see §4)                                             |

The chip row is hidden once the user starts typing more than ~12
characters (it's noise once intent is clear); it returns on `back()`
from result.

### Auto-resize contract

`Panel.tsx` sends an `invoke("resize_panel", { width, height })` whenever
the QuickCommand surface's measured height changes (debounced 16ms).
The backend resizes the webview window via the existing
`window/panel.rs` API and re-runs `compute_position` so an
edge-flip can re-fire if growing the panel would push it off-screen.
The `panel_size` argument to `compute_position` already supports
arbitrary height — no algorithm change.

---

## 4. Context references (`@`-syntax)

A minimal v1 set with a path to grow.

### Supported references

| Token         | Inlines                                                                                  | Source                                                                                |
|---------------|------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| `@clipboard`  | Current system clipboard text                                                            | `tauri-plugin-clipboard-manager` (existing dep — see `commands/completion.rs:142`)    |
| `@app`        | Frontmost app name, e.g. `"TextEdit"` or `"Visual Studio Code"`                          | `selection.source_app` (already captured on every hotkey press; `selection.rs:63`)    |

Out of scope for v1: `@file`, `@symbol`, `@url`. They need a picker
UI and/or filesystem permissions we don't want to bolt on yet.

### Parsing model

The user's typed prompt is **rewritten** before being sent to
`run_quick_command`. Reference tokens are replaced with their
expanded text inline. Examples:

```
input:  "@clipboard summarize"
sent:   "Summarize the following text:\n\n<clipboard contents>"

input:  "@app translate to French"
sent:   "Context: the user is currently using Visual Studio Code.
         Task: translate to French"

input:  "no references, just a question"
sent:   "no references, just a question"
```

A reference with no available source (e.g. `@clipboard` with an empty
clipboard) is replaced with an explicit sentinel so the model knows
the context was empty rather than missing entirely, e.g.
`"<clipboard is empty>"`.

Where the parsing happens:

- **Frontend** (`src/lib/quickCommand.ts`, new): a pure
  `expandReferences(prompt: string, ctx: QuickCtx): { expanded: string;
  refs: Reference[] }` function. The frontend already has the clipboard
  via `@tauri-apps/plugin-clipboard-manager.readText()` and `source_app`
  on the selection event.
- **Backend** receives the *already-expanded* string. Backend has no
  knowledge of `@`-tokens; this keeps the prompt API surface narrow
  and makes the references trivially testable in vitest.

### UI: the reference popover

Typing `@` (and only in a position not preceded by alphanumeric)
opens a small popover anchored to the cursor inside the textarea:

```
┌────────────────────────────────────┐
│  @clipboard  Insert clipboard text │   ← / ↑↓ to move
│  @app        Insert app context    │   ↵ to insert
└────────────────────────────────────┘
```

The popover is filterable by the characters typed after `@`; once
the user picks (Enter or click), the literal token `@clipboard ` or
`@app ` is inserted at the cursor and the popover closes.

Render of expanded references inside the input is **literal text**:
the user sees `@clipboard` in the input until submit, then the
expansion is logged in the `__TEST_QUICK_COMMAND__` recorder for
inspection. Rationale: keeping the visible input WYSIWYG-but-with-
tokens avoids re-implementing rich editing for v1.

### Chip-driven references

The chip row (§5) renders `@clipboard` and `@app` as the first two
chips. Clicking either inserts the token at the cursor — a discovery
affordance for users who haven't learned `@` yet.

---

## 5. Quick action chips

A row of one-tap prompt templates beneath the input. Each chip
inserts a template into the input (cursor placed at `{cursor}` if
present) **without** auto-submitting — submission is always
deliberate.

### v1 chip set

| Chip          | Inserted template                                                                |
|---------------|----------------------------------------------------------------------------------|
| `@clipboard`  | `@clipboard `                                                                    |
| `@app`        | `@app `                                                                          |
| `Explain`     | `Explain: {cursor}`                                                              |
| `Translate`   | `Translate to {cursor} from `                                                    |
| `Brainstorm`  | `Brainstorm 10 ideas for: {cursor}`                                              |
| `Improve`     | `Improve the writing of @clipboard. {cursor}`                                    |

Notes on the design choices:

- **The four selection-driven actions (Summarize/Edit/Elaborate/
  Research) are NOT in the chip set.** They require a selection;
  in the empty-selection world the cognitively-equivalent flow is
  *"Summarize @clipboard"* — which the `Improve` chip already
  models. Putting them in the chip set would imply they work on
  nothing, which is the confusing dead-end the feature exists to
  remove.
- **`Improve` pre-references `@clipboard`** as a discoverability
  nudge: most users have copied something they want help with.
- Chips are **suggestions, not commitments** — Tab navigates them,
  Enter inserts, Escape closes the popover (or dismisses if chip
  row isn't focused).
- Chip definitions live in `src/components/QuickCommandBar.tsx`
  as a const array; trivially extensible.

### Keyboard

- Tab from the textarea → first chip; subsequent Tab cycles.
- Shift+Tab reverses.
- Enter or Space on a focused chip → insert template into input,
  return focus to textarea, place cursor at `{cursor}`.
- Esc anywhere → dismiss.

---

## 6. Action row (post-stream)

When `state.kind === "result"` and the response has finished
streaming, replace the chip row with an action row:

```
Copy ⌘C · Replace at cursor ↵ · Retry ⌘R · Esc dismiss
```

Buttons:

| Button              | Behavior                                                                                    |
|---------------------|---------------------------------------------------------------------------------------------|
| **Copy**            | `writeText(result)` via `tauri-plugin-clipboard-manager`. Visual confirmation, same as `ResultView.tsx:74-78`. |
| **Replace at cursor** | `paste_back(result)` — types the result into the source app via existing `Paster` trait. Works even though no text was selected (just inserts at the cursor in apps that accept paste). Disabled with a "not editable" hint when paste fails (existing `ResultView.tsx:96-100` fallback). |
| **Retry**           | Re-submit the same expanded prompt, reset tokens to empty.                                  |
| Dismiss             | `hide_panel`.                                                                               |

There is intentionally **no separate "preview" step**. Cursor's
diff preview is a code-edit affordance; in Quick Command the user
already sees the full streamed text in the panel before deciding
what to do with it — that *is* the preview. The action row is the
commit step.

### `keep_panel_open_after_action` interaction

The "keep panel open" toggle from
[`dev-mode-and-panel-persist.md`](dev-mode-and-panel-persist.md) is
read once when Copy / Replace fires; if on, the panel stays put
(useful when iterating on a prompt and pasting variants), if off
the panel hides after success. Mode-agnostic — both Quick Command
and selection-driven results honor it.

---

## 7. State machine — keep the existing shape

Today's `PanelState` ([`src/lib/types.ts:38-49`](../../src/lib/types.ts)):

```
idle | picking | streaming | result | error
```

The Cursor-inspired surface still maps cleanly onto these five
states; the only structural addition is a *mode* discriminator so
`Panel.tsx` knows whether to render the existing chrome
(`ActionPicker`/`StreamingView`/`ResultView`) or the new
`QuickCommandBar`.

```ts
export type CompletionMode =
  | { kind: "action"; action: Action; selection: Selection }
  | { kind: "quick";  rawPrompt: string; expandedPrompt: string };

export type PanelState =
  | { kind: "idle" }
  | { kind: "picking";       selection: Selection }
  | { kind: "quick_command"; rawPrompt: string }                                  // NEW
  | { kind: "streaming";     mode: CompletionMode; tokens: string; provider: Provider }
  | { kind: "result";        mode: CompletionMode; result: string }
  | { kind: "error";         mode: CompletionMode | null; error: CompletionError };
```

The renderer in `Panel.tsx` reads `state.kind` AND (for streaming /
result / error) `state.mode.kind`:

- `mode.kind === "action"` → existing `StreamingView` / `ResultView`
  / `ErrorView` chrome (unchanged).
- `mode.kind === "quick"`  → render `<QuickCommandBar state={state} />`
  which internally branches on the kind to render rows B/C/D from §3.

`rawPrompt` is what the user typed (with `@`-tokens left literal),
preserved across `back()` so returning to idle leaves the textarea
populated. `expandedPrompt` is what was actually sent (used by
`retry()` to avoid re-expanding stale references — see §10's
"What's frozen at submit time").

### Transitions (Quick Command branch)

| From                | Trigger                                                       | To                                                                  |
|---------------------|---------------------------------------------------------------|---------------------------------------------------------------------|
| `idle`              | `selection_captured` empty text + `quick_command_enabled` on  | `quick_command { rawPrompt: "" }`                                   |
| `idle`              | `selection_captured` empty text + flag off                    | `picking { selection }` (falls back to `EmptySelection`)            |
| `quick_command`     | user submits non-empty prompt (Enter)                         | `streaming { mode: quick{raw, expanded}, tokens: "" }`              |
| `streaming` (quick) | `completion_done`                                             | `result { mode, result }`                                           |
| `streaming` (quick) | `completion_error`                                            | `error  { mode, error }`                                            |
| `streaming` (quick) | user presses Esc / clicks Cancel                              | `cancelCompletion()`; back to `quick_command { rawPrompt: raw }`    |
| `result` (quick)    | Back / Backspace                                              | `quick_command { rawPrompt: mode.rawPrompt }`                       |
| `error`  (quick)    | Back                                                          | `quick_command { rawPrompt: mode.rawPrompt }`                       |
| `result/error` (q)  | Retry                                                         | `streaming` with `mode.expandedPrompt` re-sent verbatim             |

---

## 8. Backend: prompt + new command

### New command: `run_quick_command`

Why a separate command rather than overloading `run_completion`:
the `Action` enum and "text-is-the-selection" framing don't apply,
and the prompt template is materially different (see below).

Signature in
[`src-tauri/src/commands/completion.rs`](../../src-tauri/src/commands/completion.rs):

```rust
#[tauri::command]
pub async fn run_quick_command(
    app: AppHandle,
    prompt: String,           // already @-expanded by the frontend
    target: Option<String>,
) -> Result<(), String>
```

Body is a near-duplicate of `run_completion`:

- Reject if `prompt.trim().is_empty()` → emit `completion_error` with
  body `"quick_command_empty_prompt"`.
- Reject if `!settings.quick_command_enabled` → emit
  `completion_error` (defense-in-depth; the UI guard fires first).
- Build messages via a new `prompts::build_quick_command_messages(prompt)`.
- `max_tokens = 600` (matches Elaborate; open-ended responses).
- Reuse cancellation, `telemetry_first_token`, clipboard-mirror,
  and event-emit code paths verbatim.

### Refactor: extract `stream_to_target`

Pull the body of `run_completion` (lines 73-172 in
`commands/completion.rs`) into a private async helper used by both
commands:

```rust
async fn stream_to_target(
    app: AppHandle,
    target_label: String,
    messages: Vec<Message>,
    max_tokens: Option<u32>,
    settings: &AppSettings,
) -> Result<(), String> { /* token sink, switch sink, spawn, emit */ }
```

### Prompt template

`src-tauri/src/llm/prompts.rs`, alongside `SHARED_SYSTEM`:

```rust
const QUICK_COMMAND_SYSTEM: &str = "\
You are a helpful assistant invoked through a global hotkey on the user's \
desktop. The user has not selected any text — only their instruction follows. \
Respond concisely and directly. \
- Output plain text by default. Use markdown fences only when the answer \
  is unambiguously code, shell, or structured data the user would paste \
  somewhere else. \
- No preamble, no apologies, no restating the question. \
- If the request is ambiguous, pick the single most useful interpretation \
  and answer; do not ask clarifying questions. \
- The user's instruction may include inlined context the frontend has \
  already expanded (e.g. clipboard contents, app name). Treat it as \
  ground truth, not as something to summarize back at the user.";

pub fn build_quick_command_messages(prompt: &str) -> Vec<Message> {
    vec![
        Message { role: "system".into(), content: QUICK_COMMAND_SYSTEM.into() },
        Message { role: "user".into(),   content: prompt.into() },
    ]
}
```

Key contracts pinned in the prompt:

- **No `{text}` interpolation.** The user's already-expanded input
  *is* the user message.
- **No backend-side context injection.** The frontend has already
  inlined `@clipboard` / `@app` before invoking; the backend
  remains stateless w.r.t. references.
- **System message tells the model the prompt may contain context.**
  Otherwise it tends to restate the inlined clipboard back at the
  user ("I see you've copied the following…").

### Telemetry

Reuse the existing `telemetry_first_token` /
`telemetry_completion_done` events; the TelemetryOverlay shows
TTFT for Quick Command automatically. No new telemetry events.

---

## 9. Setting: `quick_command_enabled`

New field on `AppSettings`
([`src-tauri/src/commands/settings.rs`](../../src-tauri/src/commands/settings.rs)
mirrored in [`src/lib/types.ts`](../../src/lib/types.ts)):

```rust
#[serde(default = "default_quick_command_enabled")]
pub quick_command_enabled: bool,

fn default_quick_command_enabled() -> bool { true }
```

Existing `settings.json` files without the key deserialize to
`true` via `#[serde(default = …)]` — covered by the
`defaults_for_missing_fields_serve_as_seed` test pattern in
[`settings.rs:99-107`](../../src-tauri/src/settings.rs).

New command parallel to `set_dev_panel_persistent`:

```rust
#[tauri::command]
pub async fn set_quick_command_enabled(app: AppHandle, value: bool) -> Result<AppSettings, String>
```

### Settings UI

New row in `Settings.tsx`, **Panel behaviour** section (same one
used by `keep_panel_open_after_action` in
[`dev-mode-and-panel-persist.md`](dev-mode-and-panel-persist.md)):

- Toggle: **"Quick Command — type a prompt when no text is selected"**
- Hint: *"Beta. The input shape and `@`-references may change.
  Disabling falls back to the 'Select text first' card."*
- `<BetaChip />` next to the label.

Default-on. Documented in `AGENTS.md` and `README.md` as Beta.

---

## 10. Frontend wiring

### Reference expansion module (`src/lib/quickCommand.ts`, new)

```ts
export interface QuickCtx {
  clipboard: string | null;   // null if read fails
  appName:   string | null;   // frontmost app at hotkey time
}

export interface Reference {
  token:  "@clipboard" | "@app";
  start:  number;  // index in raw prompt
  end:    number;
  source: string;  // expanded text
}

export function expandReferences(
  raw: string,
  ctx: QuickCtx,
): { expanded: string; refs: Reference[] };
```

Pure, vitest-friendly. Walks the string with a small regex
(`/@(clipboard|app)\b/g`), substitutes the source text inline, and
records each substitution.

### Tauri wrapper (`src/lib/tauri.ts`)

```ts
export const runQuickCommand = (prompt: string, target?: string): Promise<void> =>
  invoke("run_quick_command", { prompt, target });

export const setQuickCommandEnabled = (value: boolean): Promise<AppSettings> =>
  invoke("set_quick_command_enabled", { value });

export const resizePanel = (width: number, height: number): Promise<void> =>
  invoke("resize_panel", { width, height });
```

### Store (`src/lib/store.ts`)

New actions:

```ts
startQuickCommand: () => void;                               // idle → quick_command{rawPrompt: ""}
updateRawPrompt:   (raw: string) => void;                    // textarea edits
submitQuickCommand:(rawPrompt: string, ctx: QuickCtx) => void;
//   ↑ runs expandReferences(raw, ctx), stores both raw + expanded on mode,
//     transitions to streaming.
```

Updated actions:

- `setSelection(sel)`: when `sel.text.trim() === ""` AND the panel's
  `quickCommandEnabled` flag (settings, read in `Panel.tsx`) is on,
  call `startQuickCommand()` instead — see Panel section.
- `back()` and `retry()`: branch on `state.mode.kind` so quick-mode
  results return to `quick_command` (rawPrompt preserved) and
  re-submit `expandedPrompt` verbatim.

### What's frozen at submit time

`expandedPrompt` is captured **at the moment of Submit** and
**reused on Retry**. This avoids the surprise of clicking Retry
five seconds after the user copied something new and getting a
different result. If the user wants the latest clipboard, they
back out and submit again — explicit, not magical.

### `Panel.tsx`

- On `tauri://focus` refresh, read `quick_command_enabled` alongside
  `dev_panel_persistent` (existing pattern at
  [`Panel.tsx:56-73`](../../src/routes/Panel.tsx)).
- On `onSelectionCaptured` with empty text: if the flag is on, call
  `store.startQuickCommand()`; else `store.setSelection(sel)`
  (existing behavior).
- Render branch:

  ```tsx
  {state.kind === "quick_command" && (
    <QuickCommandBar
      rawPrompt={state.rawPrompt}
      sourceApp={lastCapturedSourceApp}
      onChange={updateRawPrompt}
      onSubmit={async (raw) => {
        const clip = await readClipboardText().catch(() => null);
        submitQuickCommand(raw, { clipboard: clip, appName: lastCapturedSourceApp });
      }}
      onDismiss={() => void hidePanel()}
    />
  )}
  {state.kind === "streaming" && state.mode.kind === "quick" && (
    <QuickCommandBar streaming … />
  )}
  {state.kind === "result"    && state.mode.kind === "quick" && (
    <QuickCommandBar result    … />
  )}
  {state.kind === "error"     && state.mode?.kind === "quick" && (
    <QuickCommandBar error     … />
  )}
  ```

- Resize hook: an effect inside `QuickCommandBar` observes its own
  `clientHeight` (ResizeObserver) and calls `resizePanel(380, h)`
  on changes (16ms debounce).

### Components

- **`QuickCommandBar.tsx`** (new, `src/components/`): the whole
  inline bar. Internally renders input row, chip row OR streaming
  region OR action row OR error row depending on `state.kind`.
  Single component so the input element never unmounts across
  states — that's what keeps the rawPrompt sticky across
  streaming→result without juggling refs.
- **`AtReferencePopover.tsx`** (new): the floating popover for
  `@`-completion. Anchored to the textarea via a small util that
  measures the caret position.
- **`ActionChip.tsx`** (new): single chip primitive used by the
  chip row.
- **`BetaChip.tsx`** (new, shared): small pill, also used by the
  Settings toggle.

### CSS

New: `QuickCommandBar.css`, `AtReferencePopover.css`,
`ActionChip.css`, `BetaChip.css`. All inside `src/components/`.
Reuse `tokens.css` variables verbatim — no new design tokens.

---

## 11. Shim & test recorder (E2E)

### `src/test/e2e/shims/commands.ts`

Add a `run_quick_command` handler that mirrors the deterministic
`run_completion` path: same `kind: "stream" | "error"` override
object, same event dispatch table, reads `prompt` instead of
`action`+`text`:

```ts
async function run_quick_command({ prompt, target }: Args): Promise<void> {
  window.__TEST_QUICK_COMMAND__.push({ prompt, at: nowMs() });
  // …rest mirrors run_completion: deterministic override → stream / error.
}
```

Register on the dispatch table at line 331 of `shims/commands.ts`.

### `__TEST_QUICK_COMMAND__` recorder

```ts
// src/test/e2e/shims/index.ts (or wherever __TEST__.reset() lives)
window.__TEST_QUICK_COMMAND__ = [];
```

Reset in `__TEST__.reset()`. Helper in `tests/e2e/helpers.ts`:

```ts
export async function getQuickCommandSubmissions(
  page: Page,
): Promise<Array<{ prompt: string; at: number }>> {
  return page.evaluate(() => window.__TEST_QUICK_COMMAND__);
}
```

### Resize shim

Add `resize_panel` to the shim dispatch table as a no-op that
records `{width, height, at}` into `__TEST_RESIZES__` — lets tests
assert the panel grew on streaming.

### Clipboard / app-name injection for `@`-tests

The shim's `readText` (in `shims/plugin-clipboard-manager.ts`) is
already settable for tests. Add `window.__TEST__.setSourceApp(name)`
to override what `emitSelection` reports as `source_app` so tests
can pin `@app` expansion.

### `set_quick_command_enabled`

Add to the shim's settings handlers, parallel to
`set_dev_panel_persistent`. Default in the shim's settings shape:
`quick_command_enabled: true`.

---

## 12. Tests

### Vitest (unit)

- **`src/lib/quickCommand.test.ts`** (new):
  - `expandReferences("@clipboard summarize", { clipboard: "foo", appName: "X" })`
    → `expanded.includes("foo")`, `refs[0].token === "@clipboard"`.
  - `expandReferences("@app translate", { clipboard: null, appName: "VS Code" })`
    → `expanded.includes("VS Code")`.
  - `@clipboard` with `clipboard: null` → expands to a sentinel
    (`"<clipboard is empty>"`).
  - `@unknown foo` → left literal (no false matches).
  - Multiple references in one string expand in order.
  - `@` preceded by alphanumeric does **not** match
    (`"email@example.com"` is untouched).

- **`src/lib/store.test.ts`**:
  - `setSelection("")` with `quickCommandEnabled === true` →
    `quick_command { rawPrompt: "" }`.
  - `setSelection("")` with `quickCommandEnabled === false` →
    `picking` with empty selection (preserves today's behavior).
  - `submitQuickCommand("raw", ctx)` → `streaming` with
    `mode.kind === "quick"`, `mode.rawPrompt === "raw"`,
    `mode.expandedPrompt` reflecting `expandReferences`.
  - `back()` from `result` with `mode.kind === "quick"` → returns to
    `quick_command` with the *same* `rawPrompt`.
  - `retry()` from `result` with `mode.kind === "quick"` → returns
    to `streaming` with `tokens: ""` and **`mode.expandedPrompt`
    unchanged** (frozen at submit time).

- **`src-tauri/src/llm/prompts.rs`** (cargo):
  - `build_quick_command_messages` returns `[system, user]`.
  - User message equals input verbatim (no interpolation).
  - System message warns the model that the prompt may contain
    pre-expanded context.

- **`src-tauri/src/commands/completion.rs`**:
  - `run_quick_command` with `prompt: ""` emits `completion_error`
    and does not spawn a gateway task.
  - `run_quick_command` with `quick_command_enabled: false` emits
    the disabled error path.

### Playwright E2E (new file: `tests/e2e/quick-command.spec.ts`)

1. **Empty selection → QuickCommand bar renders, autofocused.**
   Seed `quick_command_enabled: true`, `fireworks_key: "fw_test"`;
   `emitSelection(page, "")`; assert
   `[data-testid="quick-command-input"]` visible + focused, Beta
   chip present, chip row visible.
2. **Type → Enter → inline streaming → inline result, no view
    transition.** Set `kind: "stream"` override; type a prompt;
   press Enter; assert the input element is *still in the DOM and
   still focused* and the streaming region appears below it.
   Assert the final result text appears in the same surface (no
   `StreamingView` / `ResultView` components rendered).
3. **`@clipboard` expansion.** `__TEST__.setClipboard("hello world")`;
   type `@clipboard summarize`; submit; assert the recorder's
   last `prompt` contains `"hello world"` and not `"@clipboard"`.
4. **`@app` expansion.** `__TEST__.setSourceApp("VS Code")`;
   `emitSelection(page, "")`; type `@app rate this app`; submit;
   assert the recorder's last `prompt` contains `"VS Code"`.
5. **Action chip inserts a template.** Click the `Explain` chip;
   assert the input value is `"Explain: "` and focus returned to
   the textarea with cursor at end. No submission fired.
6. **Tab cycles chips.** From the focused textarea, press Tab;
   assert first chip focused. Press Tab again; second chip
   focused. Press Enter; assert chip template inserted.
7. **Retry re-sends the frozen `expandedPrompt`.** Submit
   `@clipboard foo`; once result appears,
   `__TEST__.setClipboard("DIFFERENT")`; click Retry; assert the
   second recorder entry equals the first (not re-expanded).
8. **Back returns to QuickCommand with rawPrompt preserved.**
   Submit `Hello?`; from result click Back; assert textarea
   visible with value `Hello?`.
9. **Flag off falls back to EmptySelection.** Seed
   `quick_command_enabled: false`; `emitSelection(page, "")`;
   assert existing card visible, QuickCommand input absent.
10. **Invalid-key → ErrorRow with `invalid-key` kind.** Override
    `kind: "error"`, `fireworks_error: "HTTP 401 Unauthorized"`;
    submit; assert `[data-error-kind="invalid-key"]` is visible
    *inside* the QuickCommand surface, not a separate ErrorView.
11. **Empty Submit is a no-op.** Open Quick Command; assert Submit
    button disabled; press Enter; recorder is empty; state stays
    `quick_command`.
12. **Panel grows on streaming.** Submit a stream override with 10
    tokens of long text; assert at least one `__TEST_RESIZES__`
    entry has a height greater than the idle baseline.
13. **Esc during streaming cancels and returns to bar.** Override
    `tokenIntervalMs: 50`, 20 tokens; submit; mid-stream press
    Esc; assert state is back to `quick_command` with the
    rawPrompt preserved, and no `completion_done` event fired.

### Playwright E2E live (env-gated on `FIREWORKS_API_KEY`)

Append to `tests/e2e/playground.spec.ts` (or new
`quick-command-live.spec.ts`):

- **Real Fireworks: `"What is 2+2?"` → result contains `4`.**
- **Real Fireworks: `@clipboard summarize` with the clipboard
  primed.** Verify the response references the clipboard content.
- **Cancel mid-stream.** Submit a long prompt; once tokens visible,
  press Esc; assert no `completion_done` for ~3s.
- **Context-length overflow.** Submit ~200,000 chars of lorem ipsum;
  assert `[data-error-kind="context-overflow"]` visible, primary
  button labeled *"Switch model"*.

---

## 13. Implementation plan (ordered)

### Rust (backend)

1. `src-tauri/src/llm/prompts.rs` — add `QUICK_COMMAND_SYSTEM` and
   `build_quick_command_messages(prompt)`; unit tests.
2. `src-tauri/src/commands/settings.rs` — add
   `quick_command_enabled: bool` to `AppSettings` with
   `#[serde(default = "…")] = true`; add
   `set_quick_command_enabled` command.
3. `src-tauri/src/settings.rs` — extend roundtrip + missing-field
   tests to cover the new key.
4. `src-tauri/src/commands/completion.rs` —
   (a) extract `stream_to_target(...)`;
   (b) add `run_quick_command(app, prompt, target)`;
   (c) emit `completion_error` if `quick_command_enabled` is false
       OR `prompt.trim().is_empty()`.
5. `src-tauri/src/commands/window.rs` — add a `resize_panel(width,
    height)` command that calls the existing `window/panel.rs`
   resize plumbing and re-runs `compute_position` for edge-flip.
6. `src-tauri/src/lib.rs` — register `run_quick_command`,
   `set_quick_command_enabled`, `resize_panel`.

### Frontend (TypeScript)

7. `src/lib/types.ts` — add `quick_command_enabled`; introduce
   `CompletionMode`; refactor `PanelState` per §7.
8. `src/lib/tauri.ts` — `runQuickCommand`,
   `setQuickCommandEnabled`, `resizePanel`.
9. `src/lib/quickCommand.ts` — pure `expandReferences` + tests.
10. `src/lib/store.ts` — refactor `streaming/result/error` to
    carry `mode`; add `startQuickCommand`, `updateRawPrompt`,
    `submitQuickCommand`; branch `back`/`retry` on mode.
11. `src/components/BetaChip.tsx` (+ `.css`) — tiny shared pill.
12. `src/components/ActionChip.tsx` (+ `.css`) — single chip
    primitive.
13. `src/components/AtReferencePopover.tsx` (+ `.css`) —
    `@`-completion popover with keyboard nav.
14. `src/components/QuickCommandBar.tsx` (+ `.css`) — the inline
    bar; internally renders input row, chip / stream / action /
    error rows. Owns the ResizeObserver → `resizePanel` effect.
15. `src/routes/Panel.tsx` —
    (a) read `quick_command_enabled` in the focus-refresh effect;
    (b) on empty `selection_captured`, branch to
        `startQuickCommand()` when flag is on;
    (c) render `<QuickCommandBar>` for the quick branch across all
        five sub-states.
16. `src/routes/Settings.tsx` — toggle row in *Panel behaviour*;
    persist via `setQuickCommandEnabled`.

### Shim / E2E

17. `src/test/e2e/shims/state.ts` — default
    `quick_command_enabled: true` in shim settings.
18. `src/test/e2e/shims/commands.ts` — `run_quick_command`,
    `set_quick_command_enabled`, `resize_panel` handlers.
19. `src/test/e2e/shims/index.ts` — install
    `window.__TEST_QUICK_COMMAND__ = []` and
    `__TEST_RESIZES__ = []`; reset both in `__TEST__.reset()`;
    add `__TEST__.setSourceApp(name)`.
20. `tests/e2e/global.d.ts` — type the new recorders + helpers.
21. `tests/e2e/helpers.ts` — `getQuickCommandSubmissions`,
    `setSourceApp`, `getResizes`.
22. `tests/e2e/quick-command.spec.ts` (new) — 13 scenarios in §12.
23. `tests/e2e/playground.spec.ts` (or new
    `quick-command-live.spec.ts`) — four live scenarios.

### Docs

24. `AGENTS.md` — update Quick Command section to reflect the
    Cursor-inspired UX.
25. `README.md` — update the Roadmap blurb.
26. `tests/e2e/COVERAGE_GAPS.md` — update Q-rows for the new
    surface (chip / `@`-reference / inline-streaming items).

---

## 14. Migration / compatibility

- **No schema migration.** Existing `settings.json` files without
  `quick_command_enabled` deserialize to `true` via
  `#[serde(default = …)]`. The
  `defaults_for_missing_fields_serve_as_seed` test pattern in
  [`settings.rs:99-107`](../../src-tauri/src/settings.rs) covers
  the load path.
- **Default-on.** Existing users get the feature on upgrade;
  toggling off restores the exact pre-feature behavior (the
  `EmptySelection` card).
- **Listener contract unchanged.** Quick Command rides the same four
  Tauri events (`completion_token`, `provider_switched`,
  `completion_done`, `completion_error`). `Panel.tsx`'s
  listeners-before-invokes invariant is preserved verbatim.
- **No event-name collisions.** The new command emits no new events.
- **No view-component breakage.** `StreamingView` and `ResultView`
  remain wired to selection-driven (`mode.kind === "action"`)
  flows; the Quick Command surface is its own component.

---

## 15. Out of scope (v1 beta)

- **Diff/preview before paste.** Quick Command produces new text
  rather than edits; the streamed output is itself the preview.
  Revisit if/when we add an "edit @clipboard in place" flow that
  has a true before/after.
- **Multi-turn / conversation history.** Each submission is a fresh
  single-turn prompt. Retry re-submits the *frozen* expanded prompt;
  it does not extend a conversation.
- **`@file` / `@symbol` / `@url`.** Requires picker UI and/or new
  permissions. Out of scope for v1; the parsing module is built so
  adding them is a single registry entry plus a source resolver.
- **Tab completion of *prompts* mid-typing.** The Tab key is reserved
  for chip-row navigation in v1. Revisit only after the recorder
  shows real demand.
- **Per-user prompt system override.** No equivalent of the per-
  action `{text}` overrides yet. If we add it, it's a separate
  field (`quick_command_system_override`).
- **Tool use / function calling.** Out of scope.
- **App-context injection without the user asking for it.** `@app`
  is opt-in via the explicit token; we do not silently prepend
  "user is in X" on every submission.

---

## 16. Open questions

- **Should `@clipboard` show the captured text inline once expanded,
  so the user can see what got inlined before submit?** Considered;
  decided against for v1 — keeping the input as plain text avoids
  re-implementing rich editing. The chip row's `@clipboard` action
  *could* preview-on-hover, which is a small follow-up.
- **Should the Replace-at-cursor action be disabled when the source
  app is known-non-editable (e.g. Finder, Activity Monitor)?** We
  already have the source-app name; mapping it to an editable bool
  would cut a noisy failure mode. Defer to a follow-up; the
  existing paste-back catch (`ResultView.tsx:95-99`) already
  surfaces the failure non-destructively.
- **Should `@app` include the bundle ID in addition to the display
  name?** Display name is more readable for the model; bundle ID
  is more deterministic. v1: display name only.
- **Should the chip set itself be user-configurable?** Not in v1.
  The list lives in `QuickCommandBar.tsx` as a const; promote to
  settings only after we see what people actually use.
