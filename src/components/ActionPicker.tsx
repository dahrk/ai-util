import { useCallback, useEffect, useState } from "react";
import { Keyboard as KeyboardIcon } from "lucide-react";

import type { Action, Selection } from "../lib/types";
import { ACTIONS, ACTION_META } from "../lib/types";
import { hidePanel } from "../lib/tauri";

import { PanelHeader } from "./PanelHeader";
import { SelectionPreview } from "./SelectionPreview";
import { ActionButton } from "./ActionButton";
import { ActionIcon } from "./ActionIcon";
import { EmptySelection } from "./EmptySelection";
import "./ActionPicker.css";

interface Props {
  selection: Selection;
  /** Called when the user picks an action via click or keyboard. */
  onPick: (action: Action) => void;
  /** Called when the user opens the settings window from the header cog. */
  onOpenSettings?: () => void;
}

/**
 * State 1: the entry view. Selection preview at top, four action buttons
 * below in a vertical list (Raycast layout per the design contract). All
 * actions reachable by keyboard:
 *   - 1 / 2 / 3 / 4 — pick by index
 *   - ArrowUp / ArrowDown — cycle focus
 *   - Enter — activate focused
 *   - Esc — dismiss (handled by parent Panel.tsx)
 */
export function ActionPicker({ selection, onPick, onOpenSettings }: Props) {
  const [focused, setFocused] = useState(0);

  // Empty-selection branch: treat whitespace-only as empty, per design brief.
  const isEmpty = !selection.text.trim();

  // Keyboard handling — wired to window so it works regardless of focus inside.
  useEffect(() => {
    if (isEmpty) return;
    const onKey = (e: KeyboardEvent) => {
      // Number shortcuts 1-4
      if (/^[1-4]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        e.preventDefault();
        onPick(ACTIONS[idx]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocused((f) => (f + 1) % ACTIONS.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocused((f) => (f - 1 + ACTIONS.length) % ACTIONS.length);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onPick(ACTIONS[focused]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, isEmpty, onPick]);

  const dismiss = useCallback(() => {
    void hidePanel();
  }, []);

  return (
    <div className="action-picker">
      <PanelHeader title="AI Actions" onSettings={onOpenSettings} />

      <div className="action-picker__body">
        {isEmpty ? (
          <EmptySelection onDismiss={dismiss} />
        ) : (
          <>
            <SelectionPreview text={selection.text} />
            <div className="action-picker__list" role="listbox" aria-label="AI actions">
              {ACTIONS.map((action, i) => {
                const meta = ACTION_META[action];
                return (
                  <ActionButton
                    key={action}
                    icon={<ActionIcon action={action} />}
                    label={meta.label}
                    hint={meta.hint}
                    shortcut={meta.shortcut}
                    focused={focused === i}
                    onMouseEnter={() => setFocused(i)}
                    onClick={() => onPick(action)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {!isEmpty && (
        <footer className="action-picker__footer">
          <span className="action-picker__hint">
            <KeyboardIcon size={11} />
            Type 1–4 or ↑↓ Enter
          </span>
          <button
            type="button"
            className="action-picker__esc"
            onClick={dismiss}
            data-testid="dismiss-esc"
          >
            Esc
          </button>
        </footer>
      )}
    </div>
  );
}
