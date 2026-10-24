import { IconClose } from '../ui/Icons.jsx';

/**
 * What a multi-select currently holds, as chips you can take back off.
 *
 * The picker can say "3 selected" — it cannot say *which* three without being
 * three times as wide, and a set you cannot read is a set you stop trusting. So
 * the count lives on the trigger and the names live here, one click from being
 * removed. That is also the cheapest way to undo a mis-tick: reopening the menu
 * and hunting for the wrong entry in a list of two hundred is the alternative.
 *
 * They wear the accent, like every other "this is on" in the app — the open
 * pattern's outline, the active filter chip, the ticked row in the menu. A
 * selected filter is the same fact, so it should not be a different colour.
 */
export function FilterChips({ values, onRemove, onClear, noun = 'filter', labelOf = (v) => v }) {
  if (!values.length) return null;

  return (
    <div className="filter-chips">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className="filter-chip"
          onClick={() => onRemove(value)}
          title={`Remove ${labelOf(value)}`}
          aria-label={`Remove ${noun} ${labelOf(value)}`}
        >
          <span className="nm">{labelOf(value)}</span>
          <IconClose size={9} />
        </button>
      ))}

      {/* Only past two. Against a single chip a Clear link does exactly what the
          chip's own × does, in more words. */}
      {values.length > 1 && (
        <button type="button" className="link-btn chips-clear" onClick={onClear}>
          Clear {values.length}
        </button>
      )}
    </div>
  );
}
