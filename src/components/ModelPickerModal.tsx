// Searchable modal model picker. Replaces the native <select> in
// ModelDropdown for catalogs (Fireworks /v1/models returns 50+ entries
// including image models the user can't use here) where the OS popup is
// unscrollable and unsearchable.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";

import type { ModelInfo } from "../lib/tauri";
import type { Provider } from "../lib/types";
import "./ModelPickerModal.css";

interface Props {
  provider: Provider;
  models: ModelInfo[];
  value: string;
  onPick: (id: string) => void;
  onClose: () => void;
  testIdPrefix?: string;
}

/** Compact context-length label, e.g. 131072 → "131K", 1048576 → "1M". */
function formatCtx(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1_000)}K`;
  }
  return n.toString();
}

/**
 * Parse a context-length search term. Accepts "128k", "1m", "200000".
 * Returns the minimum context length the row must meet, or null if the
 * query doesn't look like a context spec.
 */
function parseCtxQuery(q: string): number | null {
  const m = q.trim().match(/^(\d+(?:\.\d+)?)\s*([km])?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const suffix = m[2]?.toLowerCase();
  if (suffix === "m") return Math.round(n * 1_000_000);
  if (suffix === "k") return Math.round(n * 1_000);
  // Bare number — require at least 4 digits so we don't match every short
  // token search like "70" or "100".
  return n >= 1000 ? Math.round(n) : null;
}

export function ModelPickerModal({
  provider,
  models,
  value,
  onPick,
  onClose,
  testIdPrefix,
}: Props) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return models;
    const q = query.toLowerCase();
    // If the query parses as a context-length term ("128k", "1m", "200000"),
    // also match rows whose context_length meets that magnitude. Text match
    // still applies, so "128k llama" filters on the id-match path.
    const ctxMin = parseCtxQuery(q);
    return models.filter((m) => {
      const textMatch =
        m.id.toLowerCase().includes(q) ||
        (m.label?.toLowerCase().includes(q) ?? false);
      if (textMatch) return true;
      if (ctxMin != null && m.context_length != null) {
        return m.context_length >= ctxMin;
      }
      return false;
    });
  }, [models, query]);

  // Reset highlight when filter changes so the first match is always primed
  // for Enter. Bounding keeps it valid when the list shrinks.
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Scroll the highlighted row into view on keyboard nav.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLDivElement>(
      `[data-idx="${highlight}"]`,
    );
    // scrollIntoView may not exist in jsdom test envs.
    el?.scrollIntoView?.({ block: "nearest" });
  }, [highlight]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[highlight];
      if (pick) {
        onPick(pick.id);
        onClose();
      }
    }
  };

  return (
    <div
      className="model-picker__backdrop"
      onMouseDown={(e) => {
        // Click outside the card dismisses.
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="model-picker__card"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a model"
        onKeyDown={onKeyDown}
        data-testid={testIdPrefix ? `${testIdPrefix}-modal` : undefined}
      >
        <div className="model-picker__search">
          <Search size={14} className="model-picker__search-icon" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search models…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="model-picker__search-input"
            data-testid={testIdPrefix ? `${testIdPrefix}-search` : undefined}
            aria-controls={testIdPrefix ? `${testIdPrefix}-list` : undefined}
          />
        </div>
        <div className="model-picker__scope-hint">
          {provider === "fireworks"
            ? `Showing ${models.length} serverless deployments accessible to your account.`
            : `Showing ${models.length} OpenRouter models.`}
        </div>
        <div
          ref={listRef}
          className="model-picker__list"
          role="listbox"
          id={testIdPrefix ? `${testIdPrefix}-list` : undefined}
          aria-activedescendant={
            filtered[highlight] && testIdPrefix
              ? `${testIdPrefix}-row-${highlight}`
              : undefined
          }
        >
          {filtered.length === 0 ? (
            <div className="model-picker__empty">No models match.</div>
          ) : (
            filtered.map((m, idx) => {
              const isSelected = m.id === value;
              const isHighlighted = idx === highlight;
              return (
                <div
                  key={m.id}
                  id={testIdPrefix ? `${testIdPrefix}-row-${idx}` : undefined}
                  data-idx={idx}
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    "model-picker__row",
                    isHighlighted && "model-picker__row--highlight",
                    isSelected && "model-picker__row--selected",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => {
                    // Use mousedown so we beat the backdrop click-outside.
                    e.preventDefault();
                    onPick(m.id);
                    onClose();
                  }}
                >
                  <span className="model-picker__check">
                    {isSelected && <Check size={12} />}
                  </span>
                  <span className="model-picker__id">{m.id}</span>
                  {m.label && (
                    <span className="model-picker__label">{m.label}</span>
                  )}
                  {m.context_length != null && (
                    <span
                      className="model-picker__ctx"
                      title={`${m.context_length.toLocaleString()} token context`}
                    >
                      {formatCtx(m.context_length)} ctx
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="model-picker__footer">
          <span>{filtered.length} of {models.length}</span>
          <span className="model-picker__hint">↑↓ navigate · ↵ select · esc close</span>
        </div>
      </div>
    </div>
  );
}
