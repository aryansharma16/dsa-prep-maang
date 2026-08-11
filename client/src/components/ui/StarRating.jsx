import { useState } from 'react';
import { IconStar } from './Icons.jsx';

const STARS = [1, 2, 3, 4, 5];

const WORD = {
  1: 'Bad',
  2: 'Poor',
  3: 'Fine',
  4: 'Good',
  5: 'Great',
};

/**
 * Five stars, as an input or as a fact.
 *
 * `readOnly` is the admin panel's mode — the same marks at the same sizes, with
 * no hover, no buttons and nothing focusable, because a rating in a table is
 * something the reader is being told rather than asked. Rendering it as disabled
 * buttons instead would put five tab stops in every row of the user list.
 *
 * The word beside the stars is not decoration. Four filled shapes out of five is
 * a count; "Good" is what the person meant, and it is also the only part of this
 * that survives being read aloud or seen without colour.
 */
export function StarRating({ value = 0, onChange, readOnly = false, size = 16, showWord = true }) {
  const [hover, setHover] = useState(0);

  // What the marks show: the star being pointed at while pointing, the stored
  // value otherwise. Without this the row does not respond until after the
  // click, which reads as the control being broken.
  const shown = hover || value;

  if (readOnly) {
    return (
      <span className="stars ro" title={value ? `${value} of 5 — ${WORD[value]}` : 'Not rated'}>
        {value ? (
          STARS.map((n) => (
            <IconStar key={n} size={size} filled={n <= value} className={n <= value ? 'on' : ''} />
          ))
        ) : (
          <span className="hint">Not rated</span>
        )}
      </span>
    );
  }

  return (
    <span className="stars" onMouseLeave={() => setHover(0)}>
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${n <= shown ? 'on' : ''}`}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onClick={() => onChange?.(n)}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'} — ${WORD[n]}`}
          aria-pressed={n === value}
        >
          <IconStar size={size} filled={n <= shown} />
        </button>
      ))}
      {showWord && <span className="stars-word">{shown ? WORD[shown] : ''}</span>}
    </span>
  );
}
