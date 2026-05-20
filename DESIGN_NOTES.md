# Design notes (from the Claude Design hand-off)

The reference prototype lives in `design-reference/` (copied from a Claude
Design bundle). Treat `design-reference/project/panel.jsx` as the visual
contract. Recreate pixel-perfectly in React + TS + CSS Modules / plain CSS;
do not import the JSX directly.

## Visual system (locked)

- **Aesthetic:** macOS Sonoma vibrancy — heavy `backdrop-filter: blur(40px) saturate(180%)`, 0.5px hairline borders, `14px` panel radius, soft drop shadow.
- **Type:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", ...` stack; 13px body / 11px meta / 13.5px result.
- **Accent:** warm amber `#f5a04f` (≈ `oklch(0.78 0.15 65)`). Used sparingly — focused row, primary CTA, streaming caret. Defined as `--color-accent` in `tokens.css`.
- **Action layout:** Raycast-style **vertical list** (icon + label + ⌘N chip). The grid and compact-row variants in the design are alternates — the list ships as default.
- **Motion:** appear = 180ms cubic-bezier(0.2, 0.8, 0.2, 1) fade+scale 0.97→1; state transitions = 140ms crossfade.

## Extensible error registry (M3/M4)

The design defines `ERROR_KINDS` (panel.jsx) as a registry keyed by error kind. Each entry has: `headerTitle`, `title`, `Icon`, `tone`, `log` (rows of `[provider, detail]`), `hint`, `primary` (label + icon + action), `secondary`. Mirror this in the frontend so adding a new error kind = one entry.

Initial registry to ship:

| key | trigger |
|---|---|
| `both-failed` | both providers errored — the default `BothFailed` from gateway |
| `rate-limit` | 429 from either provider; primary CTA "Upgrade plan", secondary "Use fallback" |
| `invalid-key` | 401 from either provider; primary CTA opens Settings |
| `no-connection` | `navigator.onLine === false` preflight |
| `context-overflow` | selection too long for the model context; primary CTA "Summarize in chunks" |

**Rust side (gateway):** `GatewayError::BothFailed { fireworks, openrouter }` is enough for v1 — the frontend classifies into kinds based on the error strings + HTTP status. Capture HTTP status on each error path so the classifier has a clean signal.

## Teammate comments to address (from chat transcript)

These were attached to the design and must be honored in the implementation.

1. **Per-action default prompts with override + restore (M5 Settings → Actions)**
   Each of the four actions (Summarize / Edit / Elaborate / Research) needs a state in Settings where the default prompt is shown and can be overwritten or restored to default. The persisted shape:
   ```
   prompts: {
     summarize: { user: "..." } | null,   // null = use default
     edit:      { user: "..." } | null,
     ...
   }
   ```
   `crate::llm::prompts::build_messages` already returns a `Vec<Message>`; layer in an override step that pulls the user content from the settings store (when non-null) before that call.

2. **"Select default model" step in onboarding (M5)**
   Onboarding currently has 3 steps (A11y, Fireworks key, OpenRouter key). Add a 4th: select a default model per provider. The list is small (3–5 options each); first option pre-selected. Persists into `fireworks_model` / `openrouter_model`.

3. **Only one API key is required (M5)**
   Onboarding copy must clarify: Fireworks key is required, OpenRouter is optional. "Skip" should be obvious. (The original plan already said this; reinforcing per the comment.)

4. **Extensible error states (M4)**
   See the error registry above. The point: someone adding a new error kind months later should write one entry in a registry, not rewrite ErrorView. Frontend keeps the registry; gateway just classifies HTTP status + message.

## What the JSX uses that we adopt verbatim

- The header strip (sparkle icon + "AI Actions" label, provider pill + cog on the right).
- The action row (`ActionRow` in panel.jsx) — 26×26 icon tile, label + 2nd-line hint, shortcut chip on the right.
- The selection preview with the 3px amber tab on the left.
- The streaming view with the blinking amber caret (`@keyframes ai-caret-blink`).
- The bottom action bar pattern: secondary buttons on the left, primary on the right (or hint text on the left, secondary on the right in `picker` state).

## What we do not adopt

- `design-canvas.jsx` (canvas of artboards) — that's the design artifact, not the app.
- `tweaks-panel.jsx` (live theme/accent/width tweaks) — useful for dev but not shipped.
- `host-email.jsx` (the email app shown behind the panel in mockups) — not part of our app.
- The grid + row alternate layouts — list is the only ship variant for v1.
- Inline styles — recreate as CSS using design tokens.

## File pointers

- `design-reference/project/panel.jsx` — main panel, all five states (picker, streaming, result, error, empty) and the error registry.
- `design-reference/project/icons.jsx` — 16px SVG icon set. Tauri build uses lucide-react instead, but match these stroke weights and shapes when there's overlap.
- `design-reference/project/settings.jsx` — Settings + Onboarding pixel reference (M5).
- `design-reference/project/app.jsx` — top-level wiring; mostly informational.
