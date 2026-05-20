import { ShortcutChip } from "./ShortcutChip";
import { Sparkles } from "lucide-react";
import "./EmptySelection.css";

interface Props {
  onDismiss: () => void;
}

/**
 * Shown when the hotkey fires with no text selection. Mirrors the design's
 * "Select some text first" empty state, with the hotkey itself echoed back
 * so the user knows what to press once they've highlighted something.
 */
export function EmptySelection({ onDismiss }: Props) {
  return (
    <div className="empty-selection">
      <div className="empty-selection__icon" aria-hidden="true">
        <Sparkles size={16} />
      </div>
      <div className="empty-selection__title">Select some text first</div>
      <div className="empty-selection__hint">
        Highlight a passage in any app, then press{" "}
        <ShortcutChip>⌘⇧Space</ShortcutChip> again.
      </div>
      <button
        type="button"
        className="empty-selection__dismiss"
        onClick={onDismiss}
        data-testid="empty-dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
