import { useState } from "react";

import "./SelectionPreview.css";

/** Max selection length before the "…and N more characters" badge appears. */
export const LONG_SELECTION_THRESHOLD = 2000;
/** Max characters shown inline in the collapsed preview. */
const INLINE_LIMIT = 240;

interface Props {
  text: string;
  /** When true, render the "…and N more characters" badge below the preview. */
  longSelection?: boolean;
}

/**
 * Selection preview at the top of the picker — small, muted, with an amber
 * tab on the left mirroring the design's caret-stub motif. Long selections
 * collapse to ~3 lines with a clickable badge that expands the full text in a
 * bounded scroll region.
 */
export function SelectionPreview({ text, longSelection }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isTruncated = text.length > INLINE_LIMIT;
  const showBadge = isTruncated || !!longSelection;
  const inline =
    isTruncated && !expanded
      ? `${text.slice(0, INLINE_LIMIT).trimEnd()}…`
      : text;
  const className = [
    "selection-preview",
    expanded && "selection-preview--expanded",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={className}>
      <span className="selection-preview__tab" aria-hidden="true" />
      <span className="selection-preview__text">{inline}</span>
      {showBadge && !expanded && (
        <button
          type="button"
          className="selection-preview__more"
          data-testid="long-selection-badge"
          onClick={() => setExpanded(true)}
        >
          …and {Math.max(text.length - INLINE_LIMIT, 0).toLocaleString()} more characters
        </button>
      )}
      {expanded && (
        <button
          type="button"
          className="selection-preview__less"
          data-testid="long-selection-collapse"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      )}
    </div>
  );
}
