/**
 * The completion ring, as seen on every card.
 *
 * An SVG circle with a dashed stroke rather than a conic gradient, for two
 * reasons: `stroke-dasharray` animates smoothly where a conic stop does not,
 * and the ring needs a hole in the middle that a background gradient would have
 * to fake with a second element.
 *
 * `--hue` is inherited from the column, so a card's ring is its column's colour
 * — except once it is complete, which is always the same green. Finished is a
 * fact about the work and not about which column it is in, and it is the one
 * state worth being able to spot without reading the number.
 */

const SIZE = 15;
const STROKE = 2;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function ProgressRing({ done, total, percent, complete }) {
  // Nothing to count is not zero progress. Drawing an empty ring on a task with
  // no checklist reads as failure rather than as "there is nothing here".
  if (!total) return null;

  const label = `${done} of ${total} done`;

  return (
    <span className={`tk-ring ${complete ? 'done' : ''}`} title={label}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle className="tk-ring-track" cx={SIZE / 2} cy={SIZE / 2} r={R} strokeWidth={STROKE} />
        <circle
          className="tk-ring-fill"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          strokeWidth={STROKE}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - percent / 100)}
          // Twelve o'clock, not three. A ring that fills from the right reads as
          // a gauge; one that fills from the top reads as a proportion.
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <span className="mono" aria-label={label}>
        {percent}%
      </span>
    </span>
  );
}
