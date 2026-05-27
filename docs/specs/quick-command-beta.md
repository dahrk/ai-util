# Spec: Quick Command (Beta)

Status: **Beta — specced, not implemented.**

Turn the dead-end empty-selection state into a useful prompt box: when the
hotkey fires with no text selected, open the panel into a compact inline
input the user can type into, then stream the response through the same
`StreamingView` / `ResultView` plumbing the four built-in actions use.

This is purely **additive**. The existing `EmptySelection` view becomes the
fallback when the feature is disabled.

---

## 1. Current empty-selection flow (where we plug in)

The empty path today is short and lives entirely in the frontend:

1. `hotkey.rs::on_hotkey` (`src-tauri/src/hotkey.rs:52`) spawns
   `selection::capture` and emits `selection_captured` with whatever text
   came back (including `""`).
2. `Panel.tsx` (`src/routes/Panel.tsx:75-82`) handles
   `onSelectionCaptured`, calling `store.setSelection(sel)`.
3. The store transitions to `{ kind: "picking", selection }`
   ([`store.ts:30`](../../src/lib/store.ts)).
4. `Panel.tsx` renders `<ActionPicker selection=… />`.
5. Inside `ActionPicker.tsx` (`src/components/ActionPicker.tsx:36-37,62-64`),
   `isEmpty = !selection.text.trim()` branches into rendering
   `<EmptySelection onDismiss={dismiss} />` — a static "Select some text
   first" card with a dismiss button. The four action buttons and the
   keyboard `1/2/3/4` handlers are skipped (`{ enabled: !isEmpty }` on
   `useGlobalKeydown` in `ActionPicker.tsx:50`).

So today the `kind: "picking"` state has two render branches; the empty
branch has no path forward.

### Streaming pipeline (re-used unchanged)

`run_completion` (`src-tauri/src/commands/completion.rs:36-173`):

- Takes `action: Action`, `text: String`, `target: Option<String>`.
- Loads settings, resolves provider keys, builds messages via
  `prompts::build_messages_with_override` (`src-tauri/src/llm/prompts.rs:104`).
- Spawns a task that drives `gateway::run_completion`, emitting:
  - `completion_token` `{ token }`
  - `provider_switched` `{ from, to }`
  - `completion_done` `{ text }` (and auto-writes clipboard)
  - `completion_error` `{ fireworks_error?, openrouter_error? }`
- Per-window targeting via `target` (Playground passes `"playground"`).

`Panel.tsx` registers all four listeners at mount (the
**listeners-before-invokes** invariant); the Zustand store
(`src/lib/store.ts`) reduces them into `streaming → result | error`.

---

## 2. Panel state machine — what changes

Today's `PanelState` (`src/lib/types.ts:38-49`):

```
idle | picking | streaming | result | error
```

Add a new **`quick_command`** state and propagate a mode discriminator
into the streaming/result/error states so we know where `back()` should
return to and how `retry()` should re-run.

```ts
export type CompletionMode =
  | { kind: "action"; action: Action; selection: Selection }
  | { kind: "quick"; prompt: string };

export type PanelState =
  | { kind: "idle" }
  | { kind: "picking"; selection: Selection }
  | { kind: "quick_command"; prompt: string }            // NEW
  | { kind: "streaming"; mode: CompletionMode; tokens: string; provider: Provider }
  | { kind: "result";    mode: CompletionMode; result: string }
  | { kind: "error";     mode: CompletionMode | null; error: CompletionError };
```

Migrating the `selection`/`action` fields off the streaming/result/error
states is the only invasive change. Each consumer
(`StreamingView`, `ResultView`, `ErrorView`, the retry/back handlers in
`Panel.tsx`) reads `mode` and narrows.

### Transitions

| From            | Event / call                                               | To                                              |
|-----------------|------------------------------------------------------------|-------------------------------------------------|
| `idle`          | `selection_captured` with empty text + `quick_command_enabled` | `quick_command { prompt: "" }`              |
| `idle`          | `selection_captured` with empty text + flag off            | `picking { selection }` (falls back to `EmptySelection`) |
| `idle`          | `selection_captured` with non-empty text                   | `picking { selection }` (unchanged)             |
| `quick_command` | user submits prompt (Enter)                                | `streaming { mode: quick, prompt, tokens: "" }` |
| `streaming`     | `completion_done`                                          | `result { mode, result }`                       |
| `streaming`     | `completion_error`                                         | `error  { mode, error }`                        |
| `result`        | `back()` with `mode.kind === "quick"`                      | `quick_command { prompt: mode.prompt }`         |
| `result`        | `back()` with `mode.kind === "action"`                     | `picking { selection: mode.selection }` (today) |
| `error`         | `back()` (mode is "quick")                                 | `quick_command { prompt: mode.prompt }`         |
| `result/error`  | `retry()` (mode is "quick")                                | `streaming { mode: quick, tokens: "" }` and re-invoke |

The "preserve the typed prompt when navigating back" requirement is
satisfied by storing `prompt` on `CompletionMode.quick`.

---

## 3. UI: `QuickCommandInput.tsx`

New component in `src/components/QuickCommandInput.tsx`.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Quick Command  · [Beta]                      ⚙     │   PanelHeader
├─────────────────────────────────────────────────────┤
│                                                     │
│   ▢ Ask anything…                                   │   <textarea>
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  ↵ Send · Esc to dismiss             [Submit  ↵]    │   footer
└─────────────────────────────────────────────────────┘
```

- Header reuses `PanelHeader` with `title="Quick Command"` and a `Beta`
  chip rendered in the title slot (small pill, accent color from
  `tokens.css`).
- Body is a single-line growable textarea (1 → 3 rows, `auto-resize` on
  input). Placeholder: `"Ask anything…"`. Autofocus on mount.
- Footer mirrors `ActionPicker`'s footer: keyboard hint on the left,
  primary `Submit` button on the right.
- Width: same as the action picker (`var(--panel-width)`).
- Empty prompt → Submit button disabled; Enter is a no-op.

### Keyboard

| Key                 | Action                                       |
|---------------------|----------------------------------------------|
| Enter               | Submit (if prompt non-empty)                 |
| Shift+Enter         | Newline in the textarea                      |
| Esc                 | Dismiss panel (`hide_panel`)                 |
| ⌘⏎ / Ctrl+⏎          | Force submit (covers IME composition cases)  |

Mouse: clicking outside dismisses (existing `tauri://blur` handler in
`Panel.tsx:124`; unchanged).

### Beta chip

Reusable `<BetaChip />` mini-component (literal `<span class="beta-chip">
Beta</span>`); inline in the header title. CSS lives in
`QuickCommandInput.css`. Used here and on the settings toggle.

---

## 4. Setting: `quick_command_enabled`

New field on `AppSettings` (`src-tauri/src/commands/settings.rs` and
mirrored in `src/lib/types.ts`):

```rust
#[serde(default = "default_quick_command_enabled")]
pub quick_command_enabled: bool,

fn default_quick_command_enabled() -> bool { true }
```

`Default` impl sets it to `true`. Because the field carries
`#[serde(default = …)]`, existing settings.json files (which lack the
key) load with `true` — covered by the same `defaults_for_missing_fields
_serve_as_seed` test pattern already in `settings.rs:99-107`.

New command (parallel to `set_dev_panel_persistent`):

```rust
#[tauri::command]
pub async fn set_quick_command_enabled(app: AppHandle, value: bool) -> Result<AppSettings, String>
```

### Settings UI

New row in `Settings.tsx`, **Panel behaviour** section (the same one
proposed in [`dev-mode-and-panel-persist.md`](dev-mode-and-panel-persist.md)
for `keep_panel_open_after_action`):

- Toggle: **"Quick Command — type a prompt when no text is selected"**
- Hint: *"Beta. The shape of the prompt and the input UI may change.
  Disabling falls back to the 'Select text first' card."*
- A `<BetaChip />` next to the toggle label.

Default-on so existing users immediately get the new behavior on
upgrade. Document the migration note in `AGENTS.md`.

---

## 5. Backend: prompt + new command

### New command: `run_quick_command`

Why a separate command rather than overloading `run_completion`:

- `run_completion`'s signature `(action: Action, text: String)`
  encodes the action enum and "text is the selection." A quick command
  has no `Action` and `text` is the *user instruction*, not selection.
  Overloading would require `action: Option<Action>` + ambiguous `text`,
  fanning weak validation through `prompts::build_messages_with_override`.
- Separate commands keep `gateway::run_completion` untouched.
- The shim, frontend, and test recorder can flip on the command name.

Signature in `src-tauri/src/commands/completion.rs`:

```rust
#[tauri::command]
pub async fn run_quick_command(
    app: AppHandle,
    prompt: String,
    target: Option<String>,
) -> Result<(), String>
```

Body is a near-duplicate of `run_completion`:

- Reject if `prompt.trim().is_empty()` → emit `completion_error` with
  a `"quick_command_empty_prompt"` reason; surface in `errorKinds.ts`
  as a no-op tier (not classified to anything user-facing scary).
- Reject if `!settings.quick_command_enabled` → emit
  `completion_error` with both keys set to `"quick_command_disabled"`;
  frontend should never invoke this path when the flag is off, this is
  a defense-in-depth check.
- Build messages via a new `prompts::build_quick_command_messages(prompt)`.
- Choose `max_tokens = 600` (matches Elaborate; open-ended responses).
- Reuse the same cancellation, telemetry-first-token, clipboard-mirror
  and event-emit code paths verbatim (extract a private helper to
  avoid duplication — see "Refactor" below).

### Prompt template

`src-tauri/src/llm/prompts.rs`, alongside `SHARED_SYSTEM`:

```rust
const QUICK_COMMAND_SYSTEM: &str = "\
You are a helpful assistant invoked through a global hotkey on the user's \
desktop. The user has not selected any text — only their instruction \
follows. Respond concisely and directly. \
- Output plain text by default. Use markdown fences only when the answer \
  is unambiguously code, shell, or structured data the user would paste \
  somewhere else. \
- No preamble, no apologies, no restating the question. \
- If the request is ambiguous, pick the single most useful interpretation \
  and answer; do not ask clarifying questions.";

pub fn build_quick_command_messages(prompt: &str) -> Vec<Message> {
    vec![
        Message { role: "system".into(), content: QUICK_COMMAND_SYSTEM.into() },
        Message { role: "user".into(),   content: prompt.into() },
    ]
}
```

Notes:

- **No `{text}` interpolation.** The user's typed input *is* the user
  message — there is no template wrapping, deliberately.
- **No OS / app context in v1.** We deliberately do not prepend
  "user is on macOS in app X" because (a) `selection.rs` only
  populates `source_app` from the frontmost app at *capture* time,
  which is the same window for both quick-command and selection
  flows, and (b) injecting app context changes model behavior in
  ways that need their own evaluation. Leave the door open for a
  follow-up; pin the v1 contract here.
- The system prompt diverges from `SHARED_SYSTEM`: the "rewrite the
  selection" framing doesn't apply, so we drop the "output ONLY the
  requested rewrite" line and replace it with the rules above.

### Refactor: extract `stream_to_target`

Pull the body of `run_completion` (lines 73-172 in
`commands/completion.rs`) into a private async function:

```rust
async fn stream_to_target(
    app: AppHandle,
    target_label: String,
    messages: Vec<Message>,
    max_tokens: Option<u32>,
    settings: AppSettings,
) -> Result<(), String> { /* token sink, switch sink, spawn, emit */ }
```

`run_completion` and `run_quick_command` both call into it after
building their respective messages.

### Telemetry

Reuse the existing `telemetry_first_token` / `telemetry_completion_done`
events. No new telemetry events. The TelemetryOverlay shows TTFT for
quick commands automatically.

---

## 6. Frontend wiring

### Store (`src/lib/store.ts`)

New actions:

```ts
startQuickCommand: () => void;                       // idle → quick_command{prompt: ""}
updateQuickCommandPrompt: (prompt: string) => void;  // edit the textarea
submitQuickCommand: () => void;                      // quick → streaming
```

Updated actions:

- `setSelection(sel)`: when `sel.text.trim() === ""` AND
  `quickCommandEnabled` (read from a thin selector → see below),
  transition to `quick_command { prompt: "" }`; else current behavior.
  Wrinkle: the store doesn't currently know about settings. The cleanest
  fix is to push the decision *out* of the store: have `Panel.tsx` read
  `settings.quick_command_enabled` (it already calls `getSettings()`
  on focus, line 56) and call `startQuickCommand()` instead of
  `setSelection(emptySelection)` when applicable.
- `back()` and `retry()`: branch on `state.mode.kind`.
- `startAction`, `completeResult`, `fail`: update to set/read `mode`
  instead of `selection` + `action`.

### Tauri wrapper (`src/lib/tauri.ts`)

```ts
export const runQuickCommand = (prompt: string, target?: string): Promise<void> =>
  invoke("run_quick_command", { prompt, target });

export const setQuickCommandEnabled = (value: boolean): Promise<AppSettings> =>
  invoke("set_quick_command_enabled", { value });
```

### Panel (`src/routes/Panel.tsx`)

- On `onSelectionCaptured`: if `sel.text.trim() === ""` and
  `persistentSettings.quick_command_enabled`, call
  `store.startQuickCommand()`; else `store.setSelection(sel)`
  (existing behavior). Mirror this for the `tauri://focus` settings
  refresh so toggling the flag in Settings takes effect on next
  invocation.
- New render branch:

  ```tsx
  {state.kind === "quick_command" && (
    <QuickCommandInput
      prompt={state.prompt}
      onChange={updateQuickCommandPrompt}
      onSubmit={() => {
        startQuickCommandStream();
        void runQuickCommand(state.prompt);
      }}
      onDismiss={() => void hidePanel()}
    />
  )}
  ```

- Retry / back handlers need to branch on
  `state.mode.kind === "quick"` and call `runQuickCommand(mode.prompt)`
  instead of `runCompletion(action, selection.text)`.

### ResultView / StreamingView

Add an optional `modeKind: "action" | "quick"` prop so:

- `StreamingView`'s `ACTION_LABELS_PROG` ("Summarizing…", …) falls
  back to `"Thinking…"` for quick mode.
- `ResultView`'s `ACTION_LABELS` falls back to `"Result"` for quick
  mode; the **Show original** toggle is hidden (no selection to show);
  the **Replace selection** primary action becomes **Copy result**
  (there is nothing to paste back into — the user didn't select).
  Paste-back is still wired: if the source app is editable and the
  user explicitly hits Cmd+V after dismiss, the clipboard mirror has
  the result, just like today.

### `keep_panel_open_after_action` interaction

The "keep panel open" toggle from
[`dev-mode-and-panel-persist.md`](dev-mode-and-panel-persist.md)
suppresses `hide_panel` after `paste_back`. For quick mode there is
no paste-back, but the same setting governs whether the panel
auto-dismisses after Copy in the result view. Implementation: the
toggle is read once in `ResultView`'s effect that today calls
`hidePanel()` post-paste (no such call exists in the current
`ResultView.tsx`; the toggle's wiring lands with that other spec).
Make `ResultView`'s post-action-dismiss path mode-agnostic — both
modes honor the same flag.

---

## 7. Shim & test recorder (E2E)

### `src/test/e2e/shims/commands.ts`

Add a `run_quick_command` handler that mirrors the deterministic
`run_completion` path: same `kind: "stream" | "error"` override
object, same event dispatch table, but reads `prompt` instead of
`action`+`text`.

```ts
async function run_quick_command({ prompt, target }: Args): Promise<void> {
  if (typeof window.__TEST_QUICK_COMMAND__ !== "undefined") {
    window.__TEST_QUICK_COMMAND__.push({ prompt, at: nowMs() });
  }
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

Mirrors the existing `__TEST_CLIPBOARD__` / `getClipboard` pattern.

### `set_quick_command_enabled`

Add to the shim's settings handlers (parallel to
`set_dev_panel_persistent`). Initial value in the shim's default
settings object: `true`.

---

## 8. Tests

### Vitest (unit)

- `src/lib/store.test.ts`:
  - `setSelection("")` with `quickCommandEnabled === true` → state is
    `quick_command`.
  - `setSelection("")` with `quickCommandEnabled === false` → state is
    `picking` with empty selection (preserves today's behavior).
  - `submitQuickCommand` from `quick_command` → `streaming` with
    `mode.kind === "quick"`.
  - `back()` from `result` with `mode.kind === "quick"` → returns to
    `quick_command` with the *same* `prompt`.
  - `retry()` from `result` with `mode.kind === "quick"` → returns to
    `streaming` with `tokens: ""` and same `mode`.

- `src-tauri/src/llm/prompts.rs` (cargo):
  - `build_quick_command_messages` returns 2 messages (system + user).
  - User message content equals input verbatim (no `{text}` interpolation).
  - Empty input still produces 2 messages (caller validates emptiness;
    the prompt builder is total).
  - System message contains the "no preamble" line.

- `src-tauri/src/commands/completion.rs` (or a new integration test):
  - `run_quick_command` with `prompt: ""` emits `completion_error` and
    does not spawn a gateway task.
  - `run_quick_command` with `quick_command_enabled: false` emits the
    disabled error path.

### Playwright E2E (new file: `tests/e2e/quick-command.spec.ts`)

1. **Empty selection renders QuickCommand view + autofocused input.**
   - Seed `quick_command_enabled: true`, `fireworks_key: "fw_test"`.
   - `emitSelection(page, "")` → expect `quick-command-input` textarea
     visible, focused, with empty value; expect Beta chip visible.
2. **Type → Enter → stream → result.**
   - Set `kind: "stream"` override, type `"Hello?"`, press Enter.
   - Assert `StreamingView` visible, then `result-text` resolves to the
     concatenated tokens.
   - Assert `getQuickCommandSubmissions(page).at(-1).prompt === "Hello?"`.
3. **Retry re-streams the same prompt.**
   - From the result view, click `result-retry` → assert a second entry
     appears in `__TEST_QUICK_COMMAND__` with the same `prompt`.
4. **Back returns to QuickCommand with prompt preserved.**
   - Click Back on the result view → textarea visible, value still
     equals `"Hello?"`.
5. **Flag off falls back to EmptySelection.**
   - Seed `quick_command_enabled: false`; `emitSelection(page, "")`
     → expect the existing "Select some text first" card; expect the
     QuickCommand textarea to be absent.
6. **Error path (invalid key).**
   - Set `kind: "error", fireworks_error: "HTTP 401 Unauthorized",
      openrouter_error: null` override; submit a prompt; assert
     `[data-error-kind="invalid-key"]` is visible.
7. **Submit is disabled with empty prompt.**
   - Open QuickCommand view; assert Submit button disabled; press
     Enter; assert no streaming state was entered and the recorder is
     empty.

### Playwright E2E live (extend `playground.spec.ts` *or* a gated case)

Live tests for quick command can ride alongside the existing
playground tests since they need a real `FIREWORKS_API_KEY`. Skip if
unset. Add to `playground.spec.ts` (or a dedicated
`quick-command-live.spec.ts` file gated on the env var):

- **Real Fireworks: `"What is 2+2?"` → result contains `"4"`.** Submit
  via the QuickCommand input, wait for `result-text`, assert it matches
  `/\b4\b/`. Keep the matcher loose; the model may answer "The answer
  is 4." Tolerate that shape.
- **Cancel mid-stream.** Submit a long-ish prompt (e.g. `"Write a 200-
   word essay about capybaras."`), wait for `StreamingView`, call
  `cancelCompletion()` via the shim hook, assert the panel goes to
  idle / stays on streaming with no result event for ~3s.
- **Context-length overflow → classified error.** Submit a prompt of
  ~200,000 characters of repeated lorem ipsum. Assert
  `[data-error-kind="context-overflow"]` is visible and the primary
  button label is *"Switch model"* (per the existing error registry).

---

## 9. Implementation plan (ordered)

### Rust (backend)

1. `src-tauri/src/llm/prompts.rs` — add `QUICK_COMMAND_SYSTEM` and
   `build_quick_command_messages(prompt)`; unit tests for system-prompt
   shape, verbatim user content, empty-prompt totality.
2. `src-tauri/src/commands/settings.rs` — add
   `quick_command_enabled: bool` to `AppSettings` with
   `#[serde(default = "…")] = true`; add `set_quick_command_enabled`
   command.
3. `src-tauri/src/settings.rs` — extend the roundtrip + missing-field
   tests to cover the new key.
4. `src-tauri/src/commands/completion.rs` —
   (a) extract `stream_to_target(...)` from `run_completion`;
   (b) add `run_quick_command(app, prompt, target)`;
   (c) emit `completion_error` if `quick_command_enabled` is false OR
        if `prompt.trim().is_empty()`.
5. `src-tauri/src/lib.rs` — register `run_quick_command` and
   `set_quick_command_enabled` on the command list.

### Frontend (TypeScript)

6. `src/lib/types.ts` — add `quick_command_enabled` to `AppSettings`;
   introduce `CompletionMode` and refactor `PanelState` per §2.
7. `src/lib/tauri.ts` — add `runQuickCommand` and
   `setQuickCommandEnabled` wrappers.
8. `src/lib/store.ts` — refactor `streaming/result/error` to carry
   `mode: CompletionMode`; add `startQuickCommand`,
   `updateQuickCommandPrompt`, `submitQuickCommand`; update
   `back`/`retry` to branch on mode kind.
9. `src/components/QuickCommandInput.tsx` (+ `.css`) — new component;
   header with Beta chip, autosizing textarea, footer with Submit.
10. `src/components/BetaChip.tsx` (+ `.css`) — tiny shared pill.
11. `src/components/StreamingView.tsx`, `ResultView.tsx`, `ErrorView.tsx`
    — read `mode` to label progress, hide *Show original*, swap
    *Replace selection* for *Copy result* when `mode.kind === "quick"`.
12. `src/routes/Panel.tsx` —
    (a) read `quick_command_enabled` alongside `dev_panel_persistent`
        in the focus-refresh effect;
    (b) on `onSelectionCaptured` with empty text, branch to
        `startQuickCommand()` when the flag is on;
    (c) wire the new `QuickCommandInput` render branch and the
        retry/back handlers to call `runQuickCommand`.
13. `src/routes/Settings.tsx` — add the toggle row in *Panel behaviour*;
    persist via `setQuickCommandEnabled`.

### Shim / E2E

14. `src/test/e2e/shims/state.ts` — add `quick_command_enabled: true` to
    the default settings shape.
15. `src/test/e2e/shims/commands.ts` — add `run_quick_command` handler
    + `set_quick_command_enabled`.
16. `src/test/e2e/shims/index.ts` (or wherever `__TEST__.reset()` is
    defined) — install `window.__TEST_QUICK_COMMAND__ = []`; reset it.
17. `tests/e2e/global.d.ts` — type the new recorder + helper.
18. `tests/e2e/helpers.ts` — `getQuickCommandSubmissions(page)`.
19. `tests/e2e/quick-command.spec.ts` (new) — the seven scenarios in §8.
20. `tests/e2e/playground.spec.ts` (or new `quick-command-live.spec.ts`)
    — three live scenarios; env-gate on `FIREWORKS_API_KEY`.

### Docs

21. `AGENTS.md` — new section: Quick Command (Beta) — status, key
    decisions, pointer to this spec.
22. `README.md` — mention Quick Command under *Roadmap* (Planned/Beta).
23. `tests/e2e/COVERAGE_GAPS.md` — add Quick-Command rows to A and B
    tiers.

---

## 10. Migration / compatibility

- **No schema migration.** Existing `settings.json` files without
  `quick_command_enabled` deserialize to `true` via
  `#[serde(default = "default_quick_command_enabled")]`. The
  `defaults_for_missing_fields_serve_as_seed` test pattern in
  `settings.rs:99-107` covers the load path.
- **Default-on.** No user has to opt in; turning it off restores the
  exact pre-feature behavior (EmptySelection card).
- **Listener contract unchanged.** Quick command rides the same four
  Tauri events (`completion_token`, `provider_switched`,
  `completion_done`, `completion_error`). `Panel.tsx`'s
  listeners-before-invokes invariant is preserved verbatim.
- **No event-name collisions.** The new command does not emit any new
  events.

---

## 11. Out of scope (v1 beta)

- **Multi-turn / conversation history.** Each submission is a fresh
  single-turn prompt. No retention across submits.
- **Clipboard-history context.** The prompt is whatever the user
  types; we do not auto-prepend the clipboard.
- **File-attachment context.** No file uploads or directory injection.
- **App-context injection.** The frontmost app name is *not* prepended
  to the prompt — see §5 rationale.
- **Per-user prompt template.** No equivalent of the per-action
  `{text}` overrides yet. If we add it, it's a separate field
  (`quick_command_system_override`) and a Settings affordance.
- **Streaming UI affordances.** No "stop generating" button beyond
  the existing Cancel in `StreamingView`.
- **Tool use / function calling.** Out of scope.

---

## 12. Open questions

- **Should the QuickCommand input persist *across panel dismissals*?**
  v1 says no: each fresh panel-show with no selection starts with an
  empty prompt. Persisting feels like clipboard-history territory and
  collides with the single-turn framing.
- **Should `prompt.trim().length` trigger an `errorKinds.ts` entry, or
  silently do nothing?** v1: do nothing (Submit is disabled). The
  backend's empty-prompt guard is defense-in-depth only.
- **Should the Beta chip include a "Learn more" link?** Not in v1 —
  the toggle's hint copy is enough. Link adds a window-spawning
  affordance we don't need yet.
