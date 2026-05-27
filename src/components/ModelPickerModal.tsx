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
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        (m.label?.toLowerCase().includes(q) ?? false),
    );
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
        {provider === "fireworks" && (
          <div className="model-picker__scope-hint">
            Showing {models.length} serverless deployments accessible to your account.
          </div>
        )}
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
