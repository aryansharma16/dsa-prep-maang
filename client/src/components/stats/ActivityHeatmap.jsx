import { useMemo, useState } from 'react';

const WEEKS = 53;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A year of activity as week columns. The server keys buckets by UTC day, so
 * every date here is built in UTC — local dates would shift the whole grid by a
 * day for anyone east of Greenwich.
 */
function buildWeeks(heatmap) {
  const counts = new Map(heatmap.map((h) => [h.date, h.count]));

  const today = new Date();
  const end = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  // Walk back to the Sunday that starts the first column.
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WEEKS * 7 - 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const max = Math.max(1, ...counts.values());
  const weeks = [];
  const cursor = new Date(start);

  for (let w = 0; w < WEEKS; w += 1) {
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(cursor);
      const key = date.toISOString().slice(0, 10);
      const count = counts.get(key) || 0;
      days.push({
        key,
        count,
        date,
        future: date > end,
        // Four value steps; the ramp is validated single-hue and monotone.
        level: count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4)),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(days);
  }

  return weeks;
}

/** A month label sits above the first column that starts a new month. */
function monthLabels(weeks) {
  const labels = [];
  let previous = null;
  weeks.forEach((days, index) => {
    const month = days[0].date.getUTCMonth();
    if (month !== previous) {
      // Skip a label that would collide with the previous one.
      if (!labels.length || index - labels[labels.length - 1].index >= 3) {
        labels.push({ index, name: MONTHS[month] });
      }
      previous = month;
    }
  });
  return labels;
}

const fmt = (date) =>
  date.toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export function ActivityHeatmap({ heatmap, activity }) {
  const weeks = useMemo(() => buildWeeks(heatmap), [heatmap]);
  const labels = useMemo(() => monthLabels(weeks), [weeks]);
  const [hover, setHover] = useState(null);

  const events = activity?.events ?? 0;

  return (
    <div className="panel">
      <div className="panel-head heat-head">
        <span>
          <b className="mono">{events}</b> {events === 1 ? 'attempt' : 'attempts'} in the last year
        </span>
        <span className="heat-meta">
          Active days <b className="mono">{activity?.activeDays ?? 0}</b>
          <i />
          Current streak <b className="mono">{activity?.streak ?? 0}</b>
          <i />
          Longest streak <b className="mono">{activity?.maxStreak ?? 0}</b>
        </span>
      </div>

      <div className="panel-body">
        <div className="heat-scroll">
          <div className="heat-months">
            {labels.map((l) => (
              <span key={`${l.name}-${l.index}`} style={{ gridColumnStart: l.index + 1 }}>
                {l.name}
              </span>
            ))}
          </div>

          <div className="heat-main">
            <div className="heat-weekdays" aria-hidden="true">
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>

            <div className="heat-grid">
              {weeks.map((days, w) =>
                days.map((day, d) =>
                  day.future ? (
                    <i key={day.key} className="heat-cell empty" style={{ visibility: 'hidden' }} />
                  ) : (
                    <i
                      key={day.key}
                      className="heat-cell"
                      data-level={day.level}
                      style={{ gridColumn: w + 1, gridRow: d + 1 }}
                      onMouseEnter={(e) => {
                        const cell = e.currentTarget.getBoundingClientRect();
                        const host = e.currentTarget
                          .closest('.heat-scroll')
                          .getBoundingClientRect();
                        // Top rows would put the tooltip over the month labels,
                        // or clip it against the scroll container — drop it below.
                        const below = d < 3;
                        setHover({
                          text: `${day.count} ${day.count === 1 ? 'attempt' : 'attempts'} · ${fmt(day.date)}`,
                          x: cell.left - host.left + cell.width / 2,
                          y: (below ? cell.bottom : cell.top) - host.top,
                          below,
                        });
                      }}
                      onMouseLeave={() => setHover(null)}
                    />
                  ),
                ),
              )}
            </div>
          </div>

          {hover && (
            <span
              className={`heat-tip ${hover.below ? 'below' : ''}`}
              style={{ left: hover.x, top: hover.y }}
              role="status"
            >
              {hover.text}
            </span>
          )}
        </div>

        <div className="heat-legend">
          <span className="hint">
            Every square is a day. Darker means more attempts logged.
          </span>
          <span className="heat-scale">
            Less
            <i className="heat-cell" data-level="0" />
            <i className="heat-cell" data-level="1" />
            <i className="heat-cell" data-level="2" />
            <i className="heat-cell" data-level="3" />
            <i className="heat-cell" data-level="4" />
            More
          </span>
        </div>
      </div>
    </div>
  );
}
