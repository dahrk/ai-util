import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";

import type { Action, Provider } from "../lib/types";
import { cancelCompletion } from "../lib/tauri";

import { PanelHeader } from "./PanelHeader";
import "./StreamingView.css";

interface Props {
  action: Action;
  tokens: string;
  provider: Provider;
  /** Used by the parent to distinguish provider-switch from steady-state. */
  switching?: boolean;
  onCancel?: () => void;
  onBack?: () => void;
}

const ACTION_LABELS_PROG: Record<Action, string> = {
  summarize: "Summarizing",
  edit: "Editing",
  elaborate: "Elaborating",
  research: "Researching",
};

/**
 * State 2: streaming tokens as they arrive. The text + blinking caret read
 * from the store; the parent Panel.tsx is the one subscribed to the Tauri
 * events that drive the store (listeners-before-invokes pattern).
 */
export function StreamingView({
  action,
  tokens,
  provider,
  switching = false,
  onCancel,
  onBack,
}: Props) {
  const handleCancel = useCallback(() => {
    void cancelCompletion();
    onCancel?.();
  }, [onCancel]);

  const status = switching
    ? "Switching to OpenRouter…"
    : `Generating with ${provider === "fireworks" ? "Fireworks" : "OpenRouter"}…`;

  return (
    <div className="streaming-view">
      <PanelHeader
        leftIcon={
          <button
            type="button"
            className="streaming-view__back"
            onClick={onBack}
            aria-label="Back to actions"
          >
            <ArrowLeft size={11} />
          </button>
        }
        title={`${ACTION_LABELS_PROG[action]}…`}
        provider={provider}
        providerStatus={switching ? "switching" : "idle"}
      />

      <div className="streaming-view__body">
        <div className="streaming-view__text">
          {tokens}
          <span className="streaming-view__caret" aria-hidden="true" />
        </div>
      </div>

      <footer className="streaming-view__footer">
        <span className="streaming-view__status">
          <span className="streaming-view__spinner" aria-hidden="true" />
          {status}
        </span>
        <button
          type="button"
          className="streaming-view__cancel"
          onClick={handleCancel}
          data-testid="streaming-cancel"
        >
          Cancel
        </button>
      </footer>
    </div>
  );
}
