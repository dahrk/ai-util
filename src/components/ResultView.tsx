import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, RotateCcw, Settings as Cog } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

import { useGlobalKeydown } from "../lib/hooks";
import type { Action, Selection } from "../lib/types";
import { pasteBack } from "../lib/tauri";

import { PanelHeader } from "./PanelHeader";
import { SelectionPreview } from "./SelectionPreview";
import "./ResultView.css";

const ACTION_LABELS: Record<Action, string> = {
  summarize: "Summarized",
  edit: "Edited",
  elaborate: "Elaborated",
  research: "Researched",
};

/** Patterns the model commonly uses when refusing a request. */
const REFUSAL_PATTERNS = [
  /^i can(?:not|'t)\b/i,
  /^i'm (?:sorry|unable)/i,
  /^sorry,? (?:i|but)/i,
  /^i won't\b/i,
  /^i'm not (?:able|allowed)/i,
];

function isRefusal(text: string): boolean {
  const head = text.trim().slice(0, 60);
  return REFUSAL_PATTERNS.some((re) => re.test(head));
}

interface Props {
  action: Action;
  result: string;
  selection: Selection;
  /** Non-editable source app → "Copy result" instead of "Replace selection". */
  nonEditable?: boolean;
  onRetry: () => void;
  onBack: () => void;
  onDismiss: () => void;
  onOpenSettings?: () => void;
}

/**
 * State 3: result view. Pinned action bar at the bottom; "Show original"
 * collapsible at the top. Replace pastes back into the source app via
 * `paste_back`; Copy uses the clipboard plugin directly.
 *
 * Keyboard:
 *   - Enter      → Replace (or Copy when nonEditable)
 *   - C          → Copy
 *   - R          → Retry
 *   - Backspace  → Back to picker
 *   - Esc        → Dismiss
 */
export function ResultView({
  action,
  result,
  selection,
  nonEditable = false,
  onRetry,
  onBack,
  onDismiss,
  onOpenSettings,
}: Props) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replaced, setReplaced] = useState(false);

  const refusal = useMemo(() => isRefusal(result), [result]);

  const handleCopy = useCallback(async () => {
    await writeText(result);
    setCopied(true);
  }, [result]);

  // Auto-clear the "Copied" confirmation after 1.5s. Wrapped in an effect so
  // the timeout is canceled if the panel unmounts mid-fade.
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const handleReplace = useCallback(async () => {
    if (nonEditable) {
      await handleCopy();
      return;
    }
    try {
      await pasteBack(result);
      setReplaced(true);
    } catch (e) {
      // Paste failed (e.g. read-only context) — clipboard still has the result.
      console.warn("paste_back failed; result is still on the clipboard:", e);
      setReplaced(true);
    }
  }, [handleCopy, nonEditable, result]);

  // Defensive: when text-input children exist (rare in v1), don't intercept.
  // Bypass via the event target tag rather than disabling the hook globally.
  const guardedCopy = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      void handleCopy();
    },
    [handleCopy],
  );

  useGlobalKeydown(
    {
      Enter: () => void handleReplace(),
      c: guardedCopy,
      C: guardedCopy,
      r: () => onRetry(),
      R: () => onRetry(),
      Backspace: () => onBack(),
      ArrowLeft: () => onBack(),
      Escape: () => onDismiss(),
    },
    [handleReplace, guardedCopy, onRetry, onBack, onDismiss],
  );

  return (
    <div className="result-view">
      <PanelHeader
        title={ACTION_LABELS[action]}
        leftIcon={
          <button
            type="button"
            className="result-view__back-icon"
            onClick={onBack}
            aria-label="Back to actions"
          >
            <ArrowLeft size={11} />
          </button>
        }
        onSettings={onOpenSettings}
      />

      <div className="result-view__body">
        <div className="result-view__meta">
          <button
            type="button"
            className="result-view__toggle"
            onClick={() => setShowOriginal((v) => !v)}
          >
            {showOriginal ? "Hide original" : "Show original"}
          </button>
          {refusal && (
            <span className="result-view__refusal" data-testid="refusal-flag">
              Model declined
            </span>
          )}
        </div>

        {showOriginal && (
          <div className="result-view__original">
            <SelectionPreview text={selection.text} />
          </div>
        )}

        <div className="result-view__text" data-testid="result-text">
          {result}
        </div>
      </div>

      <footer className="panel-footer">
        <div className="result-view__secondary">
          <button
            type="button"
            className="panel-btn"
            onClick={onBack}
            aria-label="Back to actions"
          >
            <ArrowLeft size={11} /> Back
          </button>
          <button
            type="button"
            className="panel-btn"
            onClick={() => void handleCopy()}
            data-testid="result-copy"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            className="panel-btn"
            onClick={onRetry}
            data-testid="result-retry"
          >
            <RotateCcw size={11} /> Retry
          </button>
          {onOpenSettings && (
            <button
              type="button"
              className="panel-btn"
              onClick={onOpenSettings}
              aria-label="Open settings"
            >
              <Cog size={11} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="panel-btn--primary"
          onClick={() => void handleReplace()}
          data-testid="result-replace"
        >
          {replaced ? <Check size={11} /> : null}
          {replaced
            ? nonEditable
              ? "Copied"
              : "Replaced"
            : nonEditable
              ? "Copy result"
              : "Replace selection"}
        </button>
      </footer>
    </div>
  );
}
