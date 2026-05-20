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
