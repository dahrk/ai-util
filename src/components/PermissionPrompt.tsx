import { Shield } from "lucide-react";
import "./PermissionPrompt.css";

interface Props {
  onOpenSettings: () => void;
  onDismiss: () => void;
}

/**
 * Shown when `get-selected-text` reports a macOS Accessibility permission
 * problem. Offers to open System Settings via `tauri-plugin-opener`; the
 * caller wires the open-URL.
 */
export function PermissionPrompt({ onOpenSettings, onDismiss }: Props) {
  return (
    <div className="permission-prompt">
      <div className="permission-prompt__icon" aria-hidden="true">
        <Shield size={20} />
      </div>
      <div className="permission-prompt__title">Accessibility access needed</div>
      <div className="permission-prompt__body">
        AI Text Actions reads your text selection from the focused app. Grant
        access in System Settings → Privacy &amp; Security → Accessibility.
      </div>
      <div className="permission-prompt__actions">
        <button
          type="button"
          className="permission-prompt__secondary"
          onClick={onDismiss}
        >
          Dismiss
        </button>
        <button
          type="button"
          className="permission-prompt__primary"
          onClick={onOpenSettings}
        >
          Open System Settings
        </button>
      </div>
    </div>
  );
}
