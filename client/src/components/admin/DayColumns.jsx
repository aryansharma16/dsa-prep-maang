import { useState } from 'react';

const fmt = (day) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** Saturday and Sunday, read off the UTC key the server bucketed by. */
const isRest = (day) => {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
};

/**
 * Attempts logged per day, across everyone.
 *
 * One series, so one colour and no legend — the panel heading names it. The
 * per-day count of distinct accounts rides in the tooltip rather than on a second
 * axis: two measures at different scales on one plot is the chart mistake that
 * makes both of them unreadable, and nobody needs to compare 40 attempts against
 * 6 people by eye.
 *
 * Columns rather than an area. These are discrete daily counts with real zeros,
 * and an area interpolates between them — it would draw a slope through a day
 * nothing happened on and turn a dead Sunday into a gentle decline.
 *
 * Drawn with CSS grid rather than SVG for the reason the heatmap above it gives
 * at length: fractional columns make the chart exactly as wide as the panel it is
 * handed, at any width, with no viewBox arithmetic and nothing to scroll. There
 * is no curve here to compute — a column is a rectangle whose height is a
 * percentage — so SVG would buy only a fixed aspect ratio to fight.
 */
export function DayColumns({ days, peak }) {
  const [hover, setHover] = useState(null);

  // A flat empty chart still has to have a scale, or every bar divides by zero.
  const ceiling = Math.max(peak, 1);

  return (
    <div className="daycols-frame">
      {/* Two rules only. Thirty columns behind five gridlines is more chrome than
          data, and these are the two values worth reading off an axis. */}
      <div className="daycols-rule" style={{ top: 0 }} />
      <span className="daycols-ytick" style={{ top: 0 }}>
        {ceiling}
      </span>
      <div className="daycols-rule" style={{ bottom: 0 }} />
      <span className="daycols-ytick" style={{ bottom: 0, transform: 'translateY(50%)' }}>
        0
      </span>

      <div className="daycols" style={{ '--day-cols': days.length }}>
        {days.map((d) => (
          <div
            key={d.day}
            /* The hit target is the whole column, floor to ceiling. Aiming at a
               4px bar for a quiet day is not a hit target. */
            className={`daycol ${isRest(d.day) ? 'rest' : ''}`}
            onMouseEnter={(e) => {
              const col = e.currentTarget.getBoundingClientRect();
              const host = e.currentTarget.closest('.daycols-frame').getBoundingClientRect();
              setHover({
                text: `${d.attempts} ${d.attempts === 1 ? 'attempt' : 'attempts'}${
                  d.people ? ` · ${d.people} ${d.people === 1 ? 'person' : 'people'}` : ''
                } · ${fmt(d.day)}`,
                x: col.left - host.left + col.width / 2,
                y: col.top - host.top,
              });
            }}
            onMouseLeave={() => setHover(null)}
          >
            <i
              // A day with nothing on it draws nothing. The empty track is the
              // statement; a 2px stub would read as "one attempt".
              data-zero={d.attempts === 0 ? '' : undefined}
              style={{ height: `${(d.attempts / ceiling) * 100}%` }}
            />
          </div>
        ))}
      </div>

      <div className="daycols-x">
        <span>{fmt(days[0]?.day || '')}</span>
        <span>Today</span>
      </div>

      {hover && (
        <span className="heat-tip" style={{ left: hover.x, top: hover.y }} role="status">
          {hover.text}
        </span>
      )}
    </div>
  );
}
