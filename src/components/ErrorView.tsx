import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Sparkles, Settings as Cog } from "lucide-react";

import type { CompletionError } from "../lib/types";
import { buildLog, classify, ERROR_KINDS, type ErrorActionKind } from "../lib/errorKinds";

import { PanelHeader } from "./PanelHeader";
import "./ErrorView.css";

interface Props {
  error: CompletionError;
  onRetry: () => void;
  onDismiss: () => void;
  onOpenSettings?: () => void;
  /** Hook for the "fallback" action; passed `null` if not available. */
  onUseFallback?: () => void;
}

function iconFor(name: ErrorActionKind) {
  if (name === "retry") return <RotateCcw size={11} />;
  if (name === "settings") return <Cog size={11} />;
  if (name === "fallback" || name === "upgrade" || name === "chunk")
    return <Sparkles size={11} />;
  return null;
}

/**
 * State 4: error view. The visual + behavioral contract comes from the
 * extensible `ERROR_KINDS` registry; the same component renders all five
 * error kinds. Adding a new error kind = new entry in `lib/errorKinds.ts`.
 */
export function ErrorView({
  error,
  onRetry,
  onDismiss,
  onOpenSettings,
  onUseFallback,
}: Props) {
  const key = classify(error);
  const def = ERROR_KINDS[key];
  const log = def.log.length ? def.log : buildLog(error);

  const dispatch = (kind: ErrorActionKind) => {
    switch (kind) {
      case "retry":
        onRetry();
        return;
      case "dismiss":
        onDismiss();
        return;
      case "settings":
      case "switch-model":
        onOpenSettings?.();
        return;
      case "fallback":
        onUseFallback ? onUseFallback() : onRetry();
        return;
      case "upgrade":
      case "chunk":
        onRetry();
        return;
    }
  };

  // Keyboard: Enter = primary, Esc = dismiss.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        dispatch(def.primary.kind);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.primary.kind, onDismiss]);

  return (
    <div className="error-view" data-error-kind={key}>
      <PanelHeader
        title={def.headerTitle}
        leftIcon={
          <span
            className="error-view__header-icon"
            data-tone={def.tone}
            aria-hidden="true"
          >
            <AlertTriangle size={12} />
          </span>
        }
        showProvider={false}
      />

      <div className="error-view__body">
        <div className="error-view__title">{def.title}</div>
        <div className="error-view__log" data-testid="error-log">
          {log.map(([provider, detail], i) => (
            <div key={i} className="error-view__row">
              <span className="error-view__dot" data-tone={def.tone} />
              <span className="error-view__provider">{provider}</span>
              <span className="error-view__detail">— {detail}</span>
            </div>
          ))}
        </div>
        <div className="error-view__hint">{def.hint}</div>
      </div>

      <footer className="error-view__footer">
        <button
          type="button"
          className="error-view__secondary"
          onClick={() => dispatch(def.secondary.kind)}
          data-testid="error-secondary"
        >
          {iconFor(def.secondary.kind)}
          {def.secondary.label}
        </button>
        <button
          type="button"
          className="error-view__primary"
          onClick={() => dispatch(def.primary.kind)}
          data-testid="error-primary"
        >
          {iconFor(def.primary.kind)}
          {def.primary.label}
        </button>
      </footer>
    </div>
  );
}
