// Dev-only Playground: exercise the full action pipeline (LLM call →
// streaming → auto-clipboard) without OS-level selection capture or paste
// synthesis. Available via the tray "Playground…" entry under
// #[cfg(debug_assertions)].
//
// Flow:
//   1. Type into the source textarea.
//   2. Click an action — runs `runCompletion(action, text, "playground")`
//      so streaming events land on this window only.
//   3. Watch tokens stream in.
//   4. On completion, the result is auto-copied to the system clipboard
//      (the shared backend behavior).
//   5. Cmd+V into the paste-target textarea to verify end-to-end.

import { useCallback, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import { useTauriEvent } from "../lib/hooks";
import {
  cancelCompletion,
  onCompletionDone,
  onCompletionError,
  onCompletionToken,
  onProviderSwitched,
  runCompletion,
} from "../lib/tauri";
import { ACTION_META, ACTIONS, type Action, type CompletionError } from "../lib/types";
import "./Playground.css";

type Status =
  | { kind: "idle" }
  | { kind: "streaming"; action: Action; ttftMs?: number }
  | { kind: "done"; action: Action; ttftMs?: number; totalMs?: number }
  | { kind: "error"; error: CompletionError };

export default function Playground() {
  const [source, setSource] = useState("");
  const [pasteTarget, setPasteTarget] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const startedAtRef = useRef<number>(0);

  useTauriEvent(onCompletionToken, (token) => setOutput((s) => s + token), []);

  useTauriEvent(
    onProviderSwitched,
    (from, to) => {
      // Inline notice in the output — Playground doesn't need a fade banner.
      setOutput((s) => s + `\n[switched provider: ${from} → ${to}]\n`);
    },
    [],
  );

  useTauriEvent(
    onCompletionDone,
    (text) => {
      setOutput(text);
      setStatus((prev) => {
        if (prev.kind !== "streaming") return prev;
        return {
          kind: "done",
          action: prev.action,
          ttftMs: prev.ttftMs,
          totalMs: Date.now() - startedAtRef.current,
        };
      });
    },
    [],
  );

  useTauriEvent(
    onCompletionError,
    (error) => setStatus({ kind: "error", error }),
    [],
  );

  // Telemetry: listen for the backend's `telemetry_first_token` to compute TTFT.
  useTauriEvent<[number]>(
    (cb) => listen<number>("telemetry_first_token", (e) => cb(e.payload)),
    (firstTokenAt) => {
      setStatus((prev) => {
        if (prev.kind !== "streaming") return prev;
        return { ...prev, ttftMs: firstTokenAt - startedAtRef.current };
      });
    },
    [],
  );

  const runAction = useCallback(
    (action: Action) => {
      if (status.kind === "streaming") return;
      if (!source.trim()) return;
      setOutput("");
      startedAtRef.current = Date.now();
      setStatus({ kind: "streaming", action });
      void runCompletion(action, source, "playground");
    },
    [source, status.kind],
  );

  const cancel = useCallback(() => {
    void cancelCompletion();
    setStatus({ kind: "idle" });
  }, []);

  const isStreaming = status.kind === "streaming";

  return (
    <div className="playground">
      <header className="playground__header">
        <h1>Playground</h1>
        <p>
          Type into Source, run an action, then <kbd>Cmd</kbd>+<kbd>V</kbd> into
          Paste target to verify the clipboard. No OS permissions needed.
        </p>
      </header>

      <section className="playground__section">
        <label className="playground__label" htmlFor="pg-source">
          Source
        </label>
        <textarea
          id="pg-source"
          className="playground__textarea"
          rows={8}
          placeholder="Paste or type test input here."
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </section>

      <section className="playground__actions">
        {ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            className="playground__action-btn"
            disabled={isStreaming || !source.trim()}
            onClick={() => runAction(a)}
          >
            {ACTION_META[a].label}
          </button>
        ))}
        {isStreaming && (
          <button
            type="button"
            className="playground__action-btn playground__action-btn--cancel"
            onClick={cancel}
          >
            Cancel
          </button>
        )}
      </section>

      <section className="playground__section">
        <label className="playground__label">
          Output{" "}
          <StatusLine status={status} />
        </label>
        <pre className="playground__output">{output || "—"}</pre>
      </section>

      <section className="playground__section">
        <label className="playground__label" htmlFor="pg-paste">
          Paste target
        </label>
        <textarea
          id="pg-paste"
          className="playground__textarea"
          rows={5}
          placeholder="Cmd+V here to verify the clipboard."
          value={pasteTarget}
          onChange={(e) => setPasteTarget(e.target.value)}
        />
      </section>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  switch (status.kind) {
    case "idle":
      return <span className="playground__status">ready</span>;
    case "streaming":
      return (
        <span className="playground__status playground__status--active">
          streaming · {ACTION_META[status.action].label}
          {status.ttftMs !== undefined && ` · TTFT ${status.ttftMs}ms`}
        </span>
      );
    case "done":
      return (
        <span className="playground__status playground__status--ok">
          done · copied to clipboard
          {status.ttftMs !== undefined && ` · TTFT ${status.ttftMs}ms`}
          {status.totalMs !== undefined && ` · total ${status.totalMs}ms`}
        </span>
      );
    case "error":
      return (
        <span className="playground__status playground__status--err">
          error: {status.error.fireworks_error ?? status.error.openrouter_error ?? "unknown"}
        </span>
      );
  }
}
