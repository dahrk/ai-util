import "./SelectionPreview.css";

/** Max selection length before the "…and N more characters" badge appears. */
export const LONG_SELECTION_THRESHOLD = 2000;
/** Max characters shown inline in the preview. */
const INLINE_LIMIT = 240;

interface Props {
  text: string;
  /** When true, render the "…and N more characters" badge below the preview. */
  longSelection?: boolean;
}

/**
 * Selection preview at the top of the picker — small, muted, with an amber
 * tab on the left mirroring the design's caret-stub motif.
 */
export function SelectionPreview({ text, longSelection }: Props) {
  const isLong = (longSelection ?? text.length > LONG_SELECTION_THRESHOLD);
  const inline = text.length > INLINE_LIMIT ? `${text.slice(0, INLINE_LIMIT).trimEnd()}…` : text;
  return (
    <div className="selection-preview">
      <span className="selection-preview__tab" aria-hidden="true" />
      <span className="selection-preview__text">{inline}</span>
      {isLong && (
        <div className="selection-preview__more" data-testid="long-selection-badge">
          …and {(text.length - INLINE_LIMIT).toLocaleString()} more characters
        </div>
      )}
    </div>
  );
}
