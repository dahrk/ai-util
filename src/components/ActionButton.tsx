import type { ReactNode, MouseEventHandler, FocusEventHandler } from "react";
import "./ActionButton.css";
import { ShortcutChip } from "./ShortcutChip";

interface Props {
  icon: ReactNode;
  label: string;
  hint: string;
  shortcut: string;
  focused: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
}

/**
 * One row in the action picker. Renders as a `<button>` so it's keyboard-
 * focusable; the focused row gets the warm-amber accent treatment matching
 * the Raycast-style design.
 */
export function ActionButton({
  icon,
  label,
  hint,
  shortcut,
  focused,
  onClick,
  onFocus,
  onMouseEnter,
}: Props) {
  return (
    <button
      type="button"
      className={`action-button${focused ? " is-focused" : ""}`}
      onClick={onClick}
      onFocus={onFocus}
      onMouseEnter={onMouseEnter}
      data-focused={focused}
    >
      <span className="action-button__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="action-button__body">
        <span className="action-button__label">{label}</span>
        <span className="action-button__hint">{hint}</span>
      </span>
      <ShortcutChip active={focused}>{shortcut}</ShortcutChip>
    </button>
  );
}
