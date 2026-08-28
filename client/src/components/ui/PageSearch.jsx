import { useRef } from 'react';
import { useSearchHotkey } from '../../hooks/useSearchHotkey.js';
import { IconClose, IconSearch } from './Icons.jsx';

/**
 * A page's own search box, for the three pages built on `.filterbar`.
 *
 * ---------------------------------------------------------------------------
 * Why this is not one box in the top bar any more.
 *
 * It was, and it did not work — not in the sense of a bug, but in the sense
 * that a single control which searches a different collection depending on the
 * route is a control nobody can predict. Typing in it from Stats took you to
 * the roadmap. Typing in it on the ladder searched the ladder. The same text
 * meant four things, it followed you between pages carrying a filter you had
 * forgotten about, and the placeholder could only ever name one of the four.
 *
 * A search box belongs to the list it searches, next to the filters it works
 * with, holding state that dies when you leave. That is what this is. The cost
 * is one component rendered four times instead of one rendered once, which is
 * the correct trade: search is not chrome.
 * ---------------------------------------------------------------------------
 *
 * `count` is the number of rows that survived — shown only while there is a
 * query, because "517" beside an empty box is a fact about the page rather than
 * about the search, and the page already states it elsewhere.
 */
export function PageSearch({ value, onChange, placeholder, count, label = 'Search' }) {
  const ref = useRef(null);
  useSearchHotkey(ref);

  return (
    <label className={`page-search ${value ? 'has-value' : ''}`}>
      <span className="page-search-glass">
        <IconSearch size={13} />
      </span>

      <input
        ref={ref}
        /*
          `text`, not `search`: a search input renders the browser's own clear
          cross, which sits where the count goes, cannot be styled to match, and
          differs between Chrome and Safari. The clear button below is ours.
        */
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        spellCheck="false"
        autoComplete="off"
      />

      {value ? (
        <>
          {typeof count === 'number' && <span className="page-search-count mono">{count}</span>}
          <button
            type="button"
            className="page-search-clear"
            onClick={() => onChange('')}
            aria-label="Clear search"
            title="Clear search"
          >
            <IconClose size={11} />
          </button>
        </>
      ) : (
        <kbd className="mono">/</kbd>
      )}
    </label>
  );
}
