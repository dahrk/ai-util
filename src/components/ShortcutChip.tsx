import type { ReactNode } from "react";
import "./ShortcutChip.css";

interface Props {
  children: ReactNode;
  active?: boolean;
}

/**
 * Small inline badge (`⌘1`, `E`) shown next to action labels and in onboarding.
 * `active=true` switches to the accent fill — used when an action row is
 * focused so the chip reads as part of the highlight.
 */
export function ShortcutChip({ children, active = false }: Props) {
  return (
    <span className={`shortcut-chip${active ? " is-active" : ""}`}>
      {children}
    </span>
  );
}
