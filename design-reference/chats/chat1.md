# macOS Email UI States

_Started 2026-05-20 06:06 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Clipboard context app"
Current date is now May 19, 2026
</system-info>

<default aesthetic>
If no references, art direction or design systems were provided, use this default professional modern, minimal aesthetic as a base. Declare your choice out loud so you stick to it. Guidance:
- Choose a type pairing from web-safe set or Google Fonts. Helvetica is a good choice. Avoid hard-to-read or overly stylized fonts. Use 1-3 fonts only.
- Foreground and background: choose a color tone (warm, cool, neutral, something in-between). Use subtly-toned whites and blacks; avoid saturations above 0.02 for whites.
- Accents: choose 0-2 additional accent colors using oklch. All accents should share same chroma and lightness; vary hue.
- NEVER write out an SVG yourself that's more complicated than a square, circle, diamond, etc.
- For imagery, never hand-draw SVGs; use subtly-striped SVG placeholders instead with monospace explainers for what should be dropped there (e.g. “product shot”)

CRITICAL: ignore default aesthetic entirely if given other aesthetic instructions like reference images, design systems or guidance, or if there are files in the project already.
</default aesthetic>

<pasted_text name="Pasted text (118 lines)">
# AI Text Actions — Design Brief

## Concept

A lightweight OS-wide utility that lets users select text in any app, press a hotkey, and apply an AI action (Summarize, Edit, Elaborate, Research) to that text. The result streams into a small floating panel and, on accept, replaces the original selection. Think PopClip + Raycast AI, but focused, fast, and minimal.

## Core principle

**Snappy and weightless.** The panel should feel like part of the OS, not a separate app. Appears at the cursor, disappears the moment it's not needed, never steals focus from the underlying app.

## User flow

1. User selects text in any app (browser, Notion, VS Code, Slack, etc.)
2. User presses global hotkey (default `⌘⇧Space` on macOS, `Ctrl+Shift+Space` on Windows)
3. Floating panel appears near the cursor with the selection captured and four action buttons
4. User clicks an action (or presses a number key 1–4 / a letter shortcut)
5. Panel transitions to a streaming view — tokens stream in as the model generates
6. User can: **Accept** (replaces selection in the original app), **Copy** (to clipboard only), **Retry** (re-runs same action), **Try a different action** (back to step 3), or **Dismiss** (Esc)

## Screens / states to design

### State 1 — Action picker (the entry state)
- Panel appears with the captured selection shown as small dimmed preview text at the top (max 2–3 lines, truncated with ellipsis)
- Four action buttons below: Summarize, Edit, Elaborate, Research
- Each button shows: icon + label + keyboard shortcut (1/2/3/4 or first-letter)
- Subtle indicator of which provider is active (Fireworks / OpenRouter fallback) — small dot or text in corner
- Settings cog in the corner

### State 2 — Loading / streaming
- Replaces the action picker in place (no resize jump)
- Header: small breadcrumb showing the chosen action ("Editing…")
- Body: response streams in token by token with a subtle blinking caret at the end
- Bottom row: Cancel button + status text ("Generating with Fireworks…" or "Fell back to OpenRouter")

### State 3 — Result / review
- Full streamed response visible, no caret
- Original selection shown collapsed at top (toggleable: "Show original")
- Primary action: **Replace selection** (or "Insert" if not in an editable context)
- Secondary actions: Copy, Retry, ← Back to actions, Dismiss
- If the result is long, body scrolls; action bar stays pinned

### State 4 — Error
- Friendly error state when both providers fail
- Shows what was tried ("Fireworks: timeout. OpenRouter: 503.")
- Single primary action: Retry. Secondary: Dismiss.

### State 5 — First-run / permissions (macOS specifically)
- Onboarding to grant Accessibility permission (required for selection capture and paste-back)
- API key entry for Fireworks (required) and OpenRouter (optional)
- Hotkey customization

### State 6 — Settings (separate window, not floating)
- Hotkey
- API keys
- Default model per provider
- Action list (enable/disable/reorder; future: custom user actions)

## Component inventory

- **Floating panel container** — rounded corners (12–14px), subtle border, soft drop shadow, frosted/blurred background (vibrancy on macOS, acrylic on Windows). No titlebar.
- **Action button** — icon + label + shortcut hint, hover/keyboard-focus state, primary action distinct from others (the AI buttons all equal; primary emphasis is on the contextual "Replace" / "Insert" later)
- **Selection preview** — small monospace-ish or muted text block showing what was captured
- **Streaming text area** — generous line height, comfortable reading width, animated caret while streaming
- **Status pill / provider indicator** — tiny, low-emphasis
- **Keyboard shortcut chip** — small inline badge like `⌘1` or `E`

## Visual direction

- **Native and minimal.** Should look at home on both macOS Sonoma/Sequoia and Windows 11. Adopt system fonts (SF on macOS, Segoe UI Variable on Windows) and respect light/dark mode automatically.
- **No branding heaviness.** No big logos in the floating UI. App icon lives only in the menu bar / system tray and the settings window.
- **Information density:** Linear/Raycast level — compact but not cramped. Generous padding around the floating panel edges (16–20px), tighter inside.
- **Motion:** sub-200ms transitions. Panel fades + slight scale-up on appear (95% → 100%). State transitions inside the panel are crossfades, not slide. No bouncy springs.
- **Color:** mostly neutral grays + system accent. Action buttons are subtle; the only saturated color is in error states and the streaming caret.

## Dimensions & behavior constraints

- **Panel size:** ~380px wide, height varies by state (action picker ~240px, streaming/result up to ~500px max with internal scroll)
- **Position:** appears near the text cursor / selection. If near a screen edge, flips to stay fully visible
- **Always on top**, but does **not** steal focus from the underlying app (this is critical — on macOS it must be an `NSPanel` with `nonactivatingPanel` style, designers should know it behaves like a tooltip overlay, not a window)
- **Dismiss triggers:** Esc, clicking outside the panel, completing the action, or pressing the global hotkey again
- **Keyboard-first:** every action reachable without the mouse

## Action prompts (for designers writing example content)

- **Summarize** — condenses to 2–3 sentences, preserves key facts
- **Edit / Improve** — rewrites for clarity and concision, preserves voice and meaning
- **Elaborate** — expands with more detail, examples, context; matches original tone
- **Research** — provides 3–5 sentences of factual context about the topic

## Edge cases worth designing for

- **Empty / no selection** when hotkey pressed → panel shows "Select some text first" with a dismiss action
- **Very long selection** (>2000 chars) → preview truncates with "…and 4,200 more characters" indicator
- **Non-editable source** (e.g., read-only webpage) → "Replace selection" becomes "Copy result" since paste-back isn't possible
- **Provider fallback in progress** → status text transitions from "Generating with Fireworks…" to "Switching to OpenRouter…" without resetting the streaming view
- **Result is rejected by model / refusal** → shown as a normal result with a small flag, no scary error UI

## Out of scope for v1

- Custom user-defined actions
- Chat-like multi-turn conversations in the panel
- Image input / output
- Cloud sync of preferences
- Per-app customization

## Reference apps for visual / interaction inspiration

- **Raycast** — floating panel feel, keyboard-first interaction, tasteful density
- **PopClip** — selection-triggered surfacing
- **Linear** — typography, spacing, restrained color
- **Arc Browser's "Tidy Tabs" / command bar** — soft floating glass aesthetic
- **macOS Spotlight** — vibrancy, focus behavior, dismiss-on-blur

## Platform notes for the designer

- Design both light and dark variants
- Design macOS first (the floating-panel idiom is more established there), then adapt for Windows 11 (Mica/Acrylic background, slightly tighter corner radii, Segoe UI)
- Keep all assets vector / SVG where possible
</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Hi-fi design">
Create a high-fidelity, polished design. Follow the instructions about design in your system prompt, particularly the 'How to do design work' section. Use the design_canvas starter component, or make a full-bleed prototype and offer options via Tweaks.
</attached-skill>

<attached-skill name="Interactive prototype">
Create a fully interactive prototype with realistic state management and transitions. Use React useState/useEffect for dynamic behavior. Include hover states, click interactions, form validation, animated transitions, and multi-step navigation flows. It should feel like a real working app, not a static mockup.
</attached-skill>


<system-reminder>Auto-injected reminder (ignore if not relevant): do not recreate copyrighted or branded UI unless the user's email domain matches that company. Create original designs instead.</system-reminder>

## Assistant

_[tool: questions_v2]_

## User

Questions answered:
- scope: All 6 states + settings, in a design canvas with side-by-side artboards
- platform: macOS only (Sonoma/Sequoia vibes)
- theme: Both — toggleable
- aesthetic: 0
- host_app: An email draft / writing app
- accent: Warm orange/amber
- actions: Decide for me
- streaming_style: Token-by-token typing with blinking caret (classic)
- interactivity: Decide for me
- tweaks: Decide for me

## Assistant

_[tool: update_todos]_

_[tool: copy_starter_component]_

_[tool: copy_starter_component]_

_[tool: grep]_

_[tool: write_file]_

Plan locked in. Visual system before I write code:

- **Aesthetic**: macOS Sonoma vibrancy — heavy backdrop-blur + saturate, 0.5px hairline borders, soft drop shadow, 14px radius
- **Type**: SF Pro system stack, 13px body / 11px meta / 15px result
- **Accent**: warm amber `oklch(0.78 0.15 65)` ≈ `#f5a04f` — used sparingly (caret, primary CTA, focused row)
- **Action layout**: Raycast-style vertical list — icon + label + ⌘N chip (most readable, keyboard-first)
- **Interactivity**: fully clickable — real token streaming via setInterval, hotkey works, accept/dismiss/retry all wired
- **Tweaks**: theme, accent hue, panel width, action layout variant, provider pill on/off, streaming speed

Let me write the icons + panel first.

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now the main HTML file:

_[tool: write_file]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

Clean. Let me quickly screenshot to verify the layout works.

_[tool: view_image]_

_[tool: done]_

Looks great — panel reads as proper macOS vibrancy, Raycast-style action picker is on point. Shipping.

_[tool: fork_verifier_agent]_

Built a design canvas covering all 6 states from the brief, laid out for side-by-side review:

- **Floating panel — dark & light** · picker, streaming, result, error, empty selection
- **In context** · the panel hovering over an email draft (light, light-result, dark-streaming)
- **Action picker variants** · vertical list (default), 2×2 grid, compact row
- **First-run** · Accessibility permission → API keys → hotkey
- **Settings** · General, Hotkey, Models, Actions (+ a dark variant)
- **Edge cases** · long selection (with "…+N more"), non-editable source (Replace → Copy), provider fallback (Fireworks → OpenRouter mid-stream), model refusal

Visual system: macOS Sonoma vibrancy (heavy backdrop-blur + saturate, 0.5px hairlines, 14px radius), SF system stack, warm amber accent used sparingly (caret, focused row, primary CTA).

**Each panel is a real prototype** — click an action, watch tokens stream in, hit Replace/Copy/Retry/Back/Esc. Hover or arrow-key to focus; 1–4 keys run actions. The fallback artboard genuinely switches providers mid-stream on a loop.

**Tweaks** (toggle from toolbar): accent swatches, panel width, action layout, provider pill on/off, token streaming speed.

Next steps if you want them: a Windows 11 adaptation pass, the menu-bar dropdown / tray UI, or a more dramatic streaming animation option.

## User

Resolve comments please

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: list_files]_

_[tool: grep]_

I can see three comment anchors in the files — on the **OnboardPermission screen** (settings.jsx:544), the **Step 3 Hotkey artboard** (app.jsx:207), and the **Model refusal artboard** (app.jsx:283) — but the actual comment text didn't come through in this message. Could you paste the comments or attach them? Once I can read what each says I'll resolve them in one pass.

## User

Address these comments from my teammates:

**Tony** (on `index.html` at `#root > div:nth-child(3) > div:nth-child(1) > div:nth-child(7) > div:nth-child(2) > div:nth-child(4) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1)`):
Each of these actions needs a state where the default prompt is shown and then it can be overwritten or restored to default

## User

Address these comments from my teammates:

**Tony** (on `index.html` at `[data-comment-anchor="1b67477bf4-div-215-5"]`):
Need a "Select default model" step with one chosen already

## User

Address these comments from my teammates:

**Tony** (on `index.html` at `[data-comment-anchor="1b67477bf4-div-215-5"]`):
Need a "Select default model" step with one chosen already

## User

Address these comments from my teammates:

**Tony** (on `index.html` at `[data-comment-anchor="5147445fb9-div-544-5"]`):
Technically only 1 is required

## User

Address these comments from my teammates:

**Tony** (on `index.html` at `[data-comment-anchor="5147445fb9-div-544-5"]`):
Technically only 1 is required

## User

Address these comments from my teammates:

**Tony** (on `index.html` at `[data-comment-anchor="b70c2e6591-div-48-5"]`):
Please add a usage limits hit/other exensible error states to this

