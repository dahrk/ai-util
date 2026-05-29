# Spec: Adaptive output formatting

Format the AI output to match the *kind of content* the user selected (and,
optionally, the *kind of app* they're pasting back into). A Python snippet
fed to **Edit** comes back wrapped in a fenced code block with identifiers
in backticks; a paragraph of prose fed to the same action comes back as
plain text with no backtick noise.

Status: **specced, not implemented.**

---

## Motivation

Today every action is prompted the same way: "rewrite this for clarity,
no markdown unless the input had it" (`SHARED_SYSTEM` in
[`prompts.rs:64`](../../src-tauri/src/llm/prompts.rs)). The model is left
to guess whether to fence code, backtick identifiers, or strip formatting
— and small fast models guess inconsistently.

Two observed failure modes in dogfooding:

1. **Code arrives un-fenced.** User selects a Python function, runs *Edit*,
   the model returns the function as plain text without a `\`\`\`python`
   fence. Paste-back into Slack/Notes renders as a wall of monospace-less
   text.
2. **Prose arrives over-fenced.** User selects a paragraph of writing,
   runs *Elaborate*, the model decides the result is "code-like" because
   it contains the word "function" and wraps it in `\`\`\``. Paste-back
   into a Google Doc shows literal backticks.

Adaptive formatting closes this by **classifying the selection at capture
time** and feeding that classification into both the prompt and a
post-process step.

---

## Two detection strategies

The spec covers both; **content-based is the recommended v1 path.**

### (1) Content-based detection — *recommended*

Classify the selection itself via cheap regex / heuristic checks in Rust
before the LLM call. No platform APIs, no permissions, works on Windows
the day platform stubs land.

Detected formats (an enum, `DetectedFormat`):

| Variant | Triggers (cheap heuristics, ordered) |
|---|---|
| `Code` | Selection starts with `def `, `function`, `fn `, `class `, `import `, `const `, `let `, `var `, `#include`, `using namespace`; OR ≥30% of lines start with ≥2 spaces of indentation; OR contains ≥2 of `{};`, `=>`, `::`, `->` |
| `Shell` | First non-empty line begins with `$ `, `> `, `# ` followed by a verb (`cd`, `ls`, `git`, `npm`, `pnpm`, `cargo`, `brew`, `sudo`, `curl`, `mkdir`, `rm`, `chmod`, …); OR contains `\|` pipe + a known unix command |
| `Json` | Trimmed selection starts with `{` or `[`, parses with `serde_json::from_str::<Value>` |
| `Xml` | Trimmed starts with `<` and matches `<[a-zA-Z][^>]*>.*</[a-zA-Z][^>]*>` (loose, no full parse) |
| `Markdown` | Contains ≥2 of: lines starting with `#`, `- `, `* `, `1. `, `> `, or fenced ` ``` ` blocks |
| `Prose` | Default fallback — none of the above match |
| `Mixed` | Two or more of (Code, Json, Xml) match. Treat as the dominant type when there's a 2× character ratio, else `Prose`. |

Trade-offs:
- ✅ Cross-platform; zero permissions; deterministic in tests.
- ✅ Robust against the misclassification mode where app identity ≠
  content type (Slack pasted code, VS Code editing a README, browser
  devtools console for prose notes).
- ⚠ Heuristic; will misclassify edge cases (e.g., a one-line shell
  command that's actually about *describing* a shell command).
- ⚠ Doesn't know the paste target. A code snippet pasted into a plain
  email body still gets backticks — see the "rich-text override" below.

### (2) App-based detection — *additive, post-v1*

At capture time, ask the OS for the frontmost app's bundle ID (macOS) or
window class (Windows) and map to a format hint.

Mapping table (initial):

| Bundle ID / window class | Format hint |
|---|---|
| `com.microsoft.VSCode`, `com.apple.dt.Xcode`, `com.jetbrains.*` | `Code` |
| `com.apple.Terminal`, `com.googlecode.iterm2`, `dev.warp.*` | `Shell` |
| `com.tinyspeck.slackmacgap`, `com.apple.MobileSMS`, `com.hnc.Discord` | `Prose` |
| `com.apple.TextEdit` (rich-text mode), `com.microsoft.Word`, `com.google.Chrome` for `docs.google.com` | `RichTextProse` (strip markdown) |
| `com.apple.mail` (rich-text composer), `com.apple.Notes` | `RichTextProse` |
| everything else | `Unknown` — fall through to content-based |

What the codebase already has:
- [`selection.rs:63`](../../src-tauri/src/selection.rs) has a
  `frontmost_app_name()` stub that returns `None` on macOS — deliberate
  seam, never filled in. Implementing it requires
  `NSWorkspace.sharedWorkspace.frontmostApplication.bundleIdentifier`
  via the existing `objc2` crate the macOS chrome impl already pulls
  in. Lives entirely within `platform/macos/`.
- The `Selection` struct already has a `source_app: Option<String>`
  field that flows to the frontend — wiring through is one substitution,
  no schema change.

Trade-offs:
- ✅ Catches cases content heuristics miss (a single-line variable name
  selected from VS Code is "code", not "prose").
- ✅ Enables the **rich-text-target override** (strip markdown when
  pasting back into Word / Google Docs / Mail).
- ⚠ Platform-specific code path; another Windows TODO.
- ⚠ Bundle-ID list is a maintenance treadmill — and "Chrome" alone
  isn't enough (Chrome could be on `docs.google.com` *or* on Stack
  Overflow). Resolving the active tab URL needs AppleScript or
  accessibility-tree walks, both fragile.
- ⚠ Sandboxed apps may refuse to report identity; expect `Unknown`
  fallbacks in practice.

**Recommendation:** ship content-based only in v1; expose the
`source_app` field already in `Selection` to the classifier as a *boost*
(if `source_app == "com.microsoft.VSCode"` and content classifier
returns `Prose`, upgrade to `Code`). Defer the full app-detection
mapping table to a follow-up.

---

## Formatting rules

Given a `DetectedFormat`, post-process the LLM output (or guide the
prompt — see "Where this logic lives") according to the rules below.

| Format | Output convention |
|---|---|
| `Code` | Wrap entire result in `` ```<lang> `` … `` ``` `` fence. Identifiers (function names, variable names) inside *prose explanations* in the same result get single backticks. Preserve original indentation exactly. Language hint inferred from same heuristics (presence of `def`/`fn`/etc.). |
| `Shell` | Each command line prefixed with `$ ` if not already; wrap commands in a `` ```bash `` block. Inline shell tokens in explanation prose get single backticks. |
| `Json` / `Xml` | Wrap in `` ```json `` / `` ```xml `` block, pretty-print if the input was pretty-printed (preserve the choice). |
| `Markdown` | Pass through. The model output is already markdown-y; we trust it. |
| `Prose` | Strip any stray surrounding backticks the model added. No code fences. No backtick injection. |
| `Mixed` | Apply the dominant variant's rules; if tied, treat as `Prose` (the conservative direction — extra backticks are worse than missing ones in rich-text targets). |
| `RichTextProse` *(app-based only)* | Strip ALL markdown: fenced blocks → bare text (preserving indentation), `**bold**` → bare, `\`code\`` → bare. This is the "paste target is rich-text" override. |

Important constraint: **rules must be idempotent.** A second pass over
the same output must produce the same result, so a result re-shown via
*Retry* doesn't drift.

---

## Where this logic lives — three options

| Option | What changes | Pros | Cons |
|---|---|---|---|
| **(A) System prompt** — inject the detected format into `SHARED_SYSTEM` and `default_user_prompt` in [`prompts.rs`](../../src-tauri/src/llm/prompts.rs) | One file. Model is told "this is code, fence as `\`\`\`python`". | Least invasive. Free for both panel + playground. Honors user prompt overrides naturally (the user can still bake in their own style). | Model can ignore the directive (small fast models do this ~10% of the time per dogfooding). No guarantee of idempotence. |
| **(B) Rust post-processor** — new `crate::llm::format::reshape(detected, raw) -> String` called between `gateway` completion and `completion_done` event in [`completion.rs:136`](../../src-tauri/src/commands/completion.rs) | Deterministic. Unit-testable without LLM. | Need to walk model output, fence/unfence, strip backticks. Touchy on Edit (model is supposed to preserve structure; rewriting could destroy intent). |
| **(C) Frontend `ResultView` post-process** — new `src/lib/format.ts` applied to `result` before render in [`ResultView.tsx:166`](../../src/components/ResultView.tsx) | UI-local, easy to feature-flag, lets the same backend stream different per-window formatting (panel vs playground). | Two implementations needed if Windows playground does its own thing. Streaming view shows un-reshaped tokens, then snaps on completion — slightly jarring. |

**Recommendation: hybrid (A) + (B), staged.**

- **Stage 1 (this spec's primary deliverable):** option **(A)**. A
  detected-format paragraph is appended to the system message:
  `"The user selected content classified as: <Code|Shell|...>. <rules>"`.
  Costs <50 tokens. Visible benefit immediately. Zero risk of mangling
  output.
- **Stage 2 (follow-up):** option **(B)** as an idempotent *guard*
  layer — only strips the most common refusal patterns (un-fence a
  fenced-prose answer; trim a leading `\`\`\``). Not a full reformat.

Option (C) is rejected: streaming tokens render incrementally, and a
post-stream re-render breaks the streaming illusion and the
auto-scroll. Better to fix at source.

### Stage 1 detail: prompt addendum text

In [`prompts.rs`](../../src-tauri/src/llm/prompts.rs), extend
`build_messages_with_override` to accept a `DetectedFormat` and append
to the system message:

```rust
fn format_directive(f: DetectedFormat) -> &'static str {
    match f {
        DetectedFormat::Code => "The selection is source code. Wrap your entire response in a fenced code block with the appropriate language tag. Preserve indentation. Backtick any identifiers you mention in surrounding prose.",
        DetectedFormat::Shell => "The selection is a shell command or terminal session. Wrap commands in a ```bash fence and prefix interactive commands with $.",
        DetectedFormat::Json => "The selection is JSON. Return valid JSON in a ```json fence.",
        DetectedFormat::Xml => "The selection is XML. Return well-formed XML in a ```xml fence.",
        DetectedFormat::Markdown => "The selection is markdown. Return markdown that renders sensibly.",
        DetectedFormat::Prose => "The selection is prose. Return plain text. Do not introduce code fences or backticks.",
        DetectedFormat::Mixed => "The selection mixes code and prose. Preserve the structure: keep code in fences, prose as plain text.",
    }
}
```

The `SHARED_SYSTEM` constant gets `"output ONLY"` *plus* the directive
on a new line, only when a format is supplied. When `DetectedFormat`
is omitted (e.g., explicit "Raw" mode), the prompt is unchanged from
today.

---

## Setting

A new boolean in `AppSettings`
([`src-tauri/src/commands/settings.rs:11`](../../src-tauri/src/commands/settings.rs)):

```rust
#[serde(default = "default_true")]
pub adaptive_formatting: bool,

fn default_true() -> bool { true }
```

Default: **on**. `serde(default)` means existing `settings.json` files
load with `true` — no migration.

Setter command: `set_adaptive_formatting(value: bool)`. Mirror in the
TS `AppSettings` type ([`src/lib/types.ts`](../../src/lib/types.ts))
and add a typed wrapper in [`src/lib/tauri.ts`](../../src/lib/tauri.ts).

UI: a single checkbox row in the **Panel behaviour** section in
[`Settings.tsx`](../../src/routes/Settings.tsx) (the section already
introduced by [`dev-mode-and-panel-persist.md`](dev-mode-and-panel-persist.md)
part (b)).

Label:

> **Adaptive output formatting** *(recommended)*
> Analyse your selection and ask the model to format the result
> appropriately — fenced code blocks for code, plain text for prose.

`data-testid="adaptive-formatting"`.

When OFF, the classifier still runs (so the playground chip can show
what *would* have been detected), but the format directive is **not**
injected into the prompt — falling back to today's `SHARED_SYSTEM`.

---

## Playground / dev-mode support

The playground ([`Playground.tsx`](../../src/routes/Playground.tsx))
becomes the primary surface for *seeing* the classifier work.

### Format-mode selector

A new control above the action buttons, four radio buttons:

| Mode | Behaviour |
|---|---|
| **Auto** *(default)* | Run the classifier on the source textarea; pass the result. Show the detected format as a chip below ("detected: code"). |
| **Code** | Force `DetectedFormat::Code`. |
| **Prose** | Force `DetectedFormat::Prose`. |
| **Raw** | Pass `None` — today's behaviour, no format directive. Useful for A/B comparison. |

Map this to a new optional parameter on `runCompletion`:
`detectedFormat?: DetectedFormat`. The backend command becomes:

```rust
pub async fn run_completion(
    app: AppHandle,
    action: Action,
    text: String,
    target: Option<String>,
    detected_format: Option<DetectedFormat>,
) -> Result<(), String>
```

When `detected_format` is `None`, the backend runs the classifier
itself (the panel path doesn't need to pre-classify — saves a round
trip). When `Some`, the supplied value wins (playground overrides).

`data-testid="dev-format-mode"` on the radio group; individual radios
get `dev-format-mode-{auto|code|prose|raw}`.

### Persistent panel chip

When `dev_panel_persistent` is on, the [`ResultView`](../../src/components/ResultView.tsx)
shows a small chip near the existing "Model declined" slot:

```
detected: code · forced via Settings (or "auto-detected")
```

This chip is **debug only** — only renders when
`dev_panel_persistent || forceFormat`. `data-testid="detected-format-chip"`.

---

## Implementation plan

Ordered for a clean diff per step. Each step builds and tests
independently.

1. **`src-tauri/src/llm/format.rs` *(new)*** — define
   `DetectedFormat` enum + `classify(text: &str) -> DetectedFormat`
   pure function with the heuristic rules from the table above.
   Re-exported from `llm/mod.rs`.
2. **`src-tauri/src/llm/prompts.rs`** — extend
   `build_messages_with_override` with a `Option<DetectedFormat>`
   parameter; conditionally append `format_directive(f)` to the
   system message.
3. **`src-tauri/src/commands/completion.rs`** — accept
   `detected_format: Option<DetectedFormat>`. If `None`, call
   `format::classify(&text)`. Pass through to prompt builder. Add a
   `telemetry_detected_format` event for the playground chip.
4. **`src-tauri/src/commands/settings.rs`** — add
   `adaptive_formatting: bool` field (default true) and
   `set_adaptive_formatting` command. Gate the format directive on
   this setting: if `false`, pass `None` to the prompt builder even
   when classifier ran.
5. **`src-tauri/src/lib.rs`** — register the new setter command.
6. **`src/lib/types.ts`** — `DetectedFormat` type union mirroring the
   Rust enum; widen `AppSettings` with `adaptive_formatting`.
7. **`src/lib/tauri.ts`** — typed wrappers
   `setAdaptiveFormatting(value)`, widen `runCompletion` signature,
   add `onDetectedFormat(handler)` event subscription.
8. **`src/routes/Playground.tsx`** — add format-mode radio group;
   pass `detectedFormat` through `runCompletion`; subscribe to
   `telemetry_detected_format` to show the chip.
9. **`src/routes/Settings.tsx`** — checkbox row under the existing
   *Panel behaviour* section.
10. **`src/components/ResultView.tsx`** — chip rendered when
    `dev_panel_persistent` is on; subscribes to
    `telemetry_detected_format` via the existing Panel.tsx listener
    plumbing (lifted to a store field).
11. **`src/lib/store.ts`** — new state slice
    `detectedFormat: DetectedFormat | null`, set on
    `telemetry_detected_format`, cleared on `reset()`.
12. **E2E shims** — [`src/test/e2e/shims/state.ts`](../../src/test/e2e/shims/state.ts):
    extend `AppSettingsShape` with `adaptive_formatting`;
    [`src/test/e2e/shims/commands.ts`](../../src/test/e2e/shims/commands.ts):
    accept the new arg shape and the new setter.

Files to **not** touch: `selection.rs` (classifier reads from the
selection text only, no `Selection` schema change); `gateway.rs` (the
gateway doesn't care about format hints — they're applied at the
prompt boundary).

---

## Test plan

### Cargo (unit)

- `llm::format::tests::classify_python_function_is_code` —
  `def foo(x):\n    return x` → `Code`.
- `llm::format::tests::classify_shell_session_is_shell` —
  `$ npm install\n$ npm run dev` → `Shell`.
- `llm::format::tests::classify_pretty_json_is_json` —
  `{"a": 1}` parses → `Json`.
- `llm::format::tests::classify_xml_is_xml` —
  `<root><a/></root>` → `Xml`.
- `llm::format::tests::classify_markdown_with_two_features` —
  `# Heading\n- bullet` → `Markdown`.
- `llm::format::tests::classify_prose_falls_back` —
  `The cat sat on the mat.` → `Prose`.
- `llm::format::tests::classify_mixed_under_2x_ratio_is_prose` —
  short fenced snippet inside a long paragraph → `Prose`.
- `llm::format::tests::classify_mixed_over_2x_ratio_picks_dominant`
  — dominant code in a brief intro → `Code`.
- `llm::format::tests::classify_empty_is_prose` — `""` → `Prose`.
- `llm::prompts::tests::format_directive_appended_when_supplied` —
  `build_messages_with_override(..., Some(Code))` → system message
  contains `"source code"`.
- `llm::prompts::tests::format_directive_absent_when_none` —
  `build_messages_with_override(..., None)` → system message ==
  `SHARED_SYSTEM`.
- `settings::tests::adaptive_formatting_defaults_true` — a
  JSON like `{"fireworks_key":"k"}` loads with field `true`.
- `settings::tests::adaptive_formatting_roundtrips`.

### Vitest

- `lib/format.test.ts` — *if* a JS-side classifier mirror is needed
  for the playground (it isn't strictly: the backend classifies. But
  if the playground chip shows pre-action, it does). Mirror the Rust
  classifier tests for the subset the UI uses.
- `Settings.test.tsx` — the checkbox toggles
  `setAdaptiveFormatting(value)`.
- `Playground.test.tsx` — radio change passes `detectedFormat: "code"`
  through to `runCompletion`.
- `ResultView.test.tsx` — chip renders only when
  `dev_panel_persistent` is on.

### Playwright (E2E)

- `playground.spec.ts` *(extend)* — set format mode = Code, fill a
  Python snippet, run *Edit*, assert result text starts with
  `\`\`\``.
- `playground.spec.ts` *(extend)* — set format mode = Raw, same
  input, assert prompt sent to the shim does **not** contain the
  format directive string.
- `playground.spec.ts` *(extend)* — set format mode = Auto, fill a
  paragraph of prose, assert the detected-format chip reads
  `auto-detected: prose`.
- `panel.spec.ts` *(new case)* — seed a selection that is a Python
  snippet, drive a stream to result, assert `result` text contains
  a `\`\`\`` fence.
- `settings.spec.ts` *(new case)* — toggle "Adaptive output
  formatting" off → assert `adaptive_formatting: false` in
  `getSettings()`.

### Manual smoke

Worth running once on a real macOS build, with a real Fireworks key:

| Selection | Action | Expected |
|---|---|---|
| Python function in VS Code | Edit | Fenced ```python``` block, identifiers backticked in any prose |
| Paragraph from Safari | Elaborate | Plain text, no backticks anywhere |
| `$ git status` in Terminal | Elaborate | Wrapped in ```bash``` fence |
| Pretty JSON | Edit | Returned as ```json``` block, indentation preserved |
| Mixed snippet (intro + code + outro) | Edit | Intro/outro plain, code block fenced |

---

## What this cannot do

Honest limitations — call out so the next person isn't surprised.

- **Rich-text / RTF paste.** The clipboard write in
  [`paste_back`](../../src-tauri/src/commands/selection.rs) uses
  `tauri-plugin-clipboard-manager::write_text`, which writes
  plaintext only. We **cannot** synthesise RTF, write `text/html` to
  the macOS pasteboard, or paste *styled* text into Word/Google Docs.
  Markdown remains literal characters at the destination. The
  `RichTextProse` override mitigates by *stripping* markdown rather
  than converting it to RTF.
- **Per-app clipboard format detection on macOS sandbox.** Inspecting
  the focused control's supported pasteboard types
  (`NSPasteboard.types`) requires the app under the cursor to *be*
  the pasteboard owner, which it usually isn't at hotkey time. So we
  can't reliably ask "does this app prefer text/html?" — only "is
  this app on our static known-list?".
- **Active browser tab URL.** Knowing "Chrome is frontmost" doesn't
  tell us whether the user is on Google Docs (wants plain text) or
  Stack Overflow (wants markdown). Resolving the URL requires
  AppleScript dispatched per browser (Chrome's `tell application
  "Google Chrome" to get URL of active tab of front window`),
  fragile, and triggers an Automation permission prompt that is
  *additional* to the Accessibility one users have already granted.
  Out of scope.
- **Mid-stream format correction.** The format directive is applied
  to the prompt. If the model ignores it, the first tokens stream as
  un-fenced text into the panel and the user sees the un-fenced form
  briefly. A post-stream rewrite would solve this but is option (B)
  in *Where this logic lives* — deferred.
- **User intent overrides content type.** A user might select a
  variable name (`detectedFormat`) intending to *ask about it* in
  prose; the classifier flags it as `Code` and the result comes back
  as `\`detectedFormat\``. The Auto-mode chip in dev-mode makes
  this visible; the format-mode dropdown lets the user override.
  Future: a hotkey-time modifier (`Cmd+Shift+Space` for Auto, hold
  `Option` for Raw) — not in this spec.
- **Languages outside the heuristic list.** Brainfuck, Whitespace,
  Forth, anything ALGOL-derived — classifier returns `Prose`. The
  ` ``` ` fence still goes on if the model decides to fence; the
  language tag will just be missing.

---

## Open questions

- **Should `Edit` of a code snippet preserve fences in the input?**
  If the user selected `\`\`\`python\n...\n\`\`\`` (fence and all),
  do we want the output to keep the fence verbatim or strip-then-add?
  Current spec: strip-then-add (idempotent). Confirm with a
  dogfooding pass.
- **Telemetry.** Should we record `detected_format` in the dev
  telemetry overlay (`Cmd+Shift+;`)? Cheap to add and helpful for
  measuring classifier accuracy in practice. Suggested: yes, as a
  third line under TTFT/total.
- **Mirror classifier in TS or call into Rust?** The Playground chip
  could show "detected: code" *before* the user clicks the action,
  which means classifying client-side. Either we duplicate the
  classifier in `src/lib/format.ts` (drift risk) or we add a
  zero-cost `classify_selection` Tauri command (one IPC hop per
  keystroke — debounced). Suggested: Tauri command, debounced 150ms.
  Single source of truth wins.
