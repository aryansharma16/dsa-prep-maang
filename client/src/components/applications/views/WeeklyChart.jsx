import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Applications sent, week by week.
 *
 * One series, so no legend — the heading says what is plotted — and one hue,
 * the accent you picked, because there is nothing for colour to distinguish
 * here. Columns rather than a line, because a week is a bucket and not a point
 * on a continuum: "seven that week" is a count you compare against the week
 * beside it, which is what bars are read as.
 *
 * The specs are the house chart specs, stated so they are not "improved" later:
 * a column is at most 24px wide and leaves the rest of its band as air; the top
 * is rounded 4px and the foot is square on the baseline; gridlines are one
 * hairline step off the surface and never dashed; only the busiest week carries
 * its number, and every other value is one hover away — a number on all twelve
 * columns is twelve numbers nobody reads.
 *
 * The hover target is the whole band, not the column. A two-application week is
 * a column four pixels tall, and a tooltip that only answered a pointer on
 * those four pixels would be a tooltip nobody found.
 *
 * It is drawn at the container's real width rather than scaled from a fixed
 * viewBox. Scaling looks free and is not: on a wide window every tick label,
 * the peak value and the 24px column cap all grow with it, and the chart ends
 * up with sixteen-pixel axis text and forty-pixel columns. Measuring once per
 * resize keeps a pixel a pixel.
 *
 * The replies figure rides in the tooltip rather than as a second series.
 * Stacking it would make the column mean two things, and a second bar per week
 * would halve the width of both — the funnel below already answers the reply
 * question properly.
 */

const WEEKS = 12;
const HEIGHT = 180;
const PAD = { top: 18, right: 8, bottom: 26, left: 28 };
const BAR = 24;

/** Monday 00:00 local, so a week is the week a calendar would show. */
function mondayOf(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

/** Clean ticks: 0 and a round step, never a tick at 7. */
function ticksFor(max) {
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return { ticks, top };
}

/** A column with a rounded top and a square foot, as one path. */
function column(x, y, width, height) {
  if (height <= 0) return '';
  const r = Math.min(4, width / 2, height);
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    'Z',
  ].join(' ');
}

const weekLabel = (date) => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function WeeklyChart({ apps }) {
  const [hover, setHover] = useState(null);
  const boxRef = useRef(null);
  const [WIDTH, setWidth] = useState(640);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const measure = () => setWidth(Math.max(280, Math.round(box.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const weeks = useMemo(() => {
    const thisWeek = mondayOf(new Date());
    const buckets = Array.from({ length: WEEKS }, (_, index) => {
      const start = new Date(thisWeek);
      start.setDate(thisWeek.getDate() - (WEEKS - 1 - index) * 7);
      return { start, sent: 0, replied: 0 };
    });
    const first = +buckets[0].start;

    apps.forEach((app) => {
      if (!app.appliedAt) return;
      const at = +mondayOf(app.appliedAt);
      if (at < first) return;
      const index = Math.round((at - first) / (7 * 86400000));
      const bucket = buckets[index];
      if (!bucket) return;
      bucket.sent += 1;
      if (app.reached?.screening) bucket.replied += 1;
    });

    return buckets;
  }, [apps]);

  const total = weeks.reduce((sum, week) => sum + week.sent, 0);
  const max = Math.max(...weeks.map((week) => week.sent));
  const { ticks, top } = ticksFor(max);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / WEEKS;
  const barW = Math.min(BAR, band * 0.62);
  const y = (value) => PAD.top + plotH - (value / top) * plotH;
  const peak = weeks.findIndex((week) => week.sent === max && max > 0);

  if (!total) {
    return (
      <p className="ap-muted" ref={boxRef}>
        Nothing sent in the last twelve weeks yet — this fills in as applications get an applied
        date.
      </p>
    );
  }

  return (
    <div className="ap-chart" ref={boxRef} onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={`Applications sent per week over the last ${WEEKS} weeks: ${total} in total, at most ${max} in one week.`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="ap-chart-grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="ap-chart-tick" x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}

        {weeks.map((week, index) => {
          const x = PAD.left + band * index + (band - barW) / 2;
          const h = (week.sent / top) * plotH;
          const on = hover === index;
          return (
            <g key={+week.start}>
              <path
                className={`ap-chart-bar ${on ? 'on' : ''}`}
                d={column(x, y(week.sent), barW, h)}
              />
              {index === peak && (
                <text className="ap-chart-value" x={x + barW / 2} y={y(week.sent) - 5} textAnchor="middle">
                  {week.sent}
                </text>
              )}
              {/* Every other week, counted back from this one, so the last label is
                  always "This wk" and never has a neighbour to collide with. */}
              {index % 2 === (WEEKS - 1) % 2 && (
                <text
                  className="ap-chart-tick"
                  x={PAD.left + band * index + band / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                >
                  {index === WEEKS - 1 ? 'This wk' : weekLabel(week.start)}
                </text>
              )}
              {/* The hit target: the full band, full height. */}
              <rect
                className="ap-chart-hit"
                x={PAD.left + band * index}
                y={PAD.top}
                width={band}
                height={plotH}
                tabIndex={0}
                aria-label={`Week of ${weekLabel(week.start)}: ${week.sent} sent, ${week.replied} replied`}
                onMouseEnter={() => setHover(index)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          className="ap-chart-tip"
          style={{ left: `${((PAD.left + band * hover + band / 2) / WIDTH) * 100}%` }}
          role="status"
        >
          <strong>Week of {weekLabel(weeks[hover].start)}</strong>
          <span>
            {weeks[hover].sent} sent
            {weeks[hover].sent > 0 && ` · ${weeks[hover].replied} replied`}
          </span>
        </div>
      )}

      {/* The same numbers as a table, for a screen reader and for anyone who
          would rather read than hover. */}
      <table className="sr-only">
        <caption>Applications sent per week</caption>
        <thead>
          <tr>
            <th>Week of</th>
            <th>Sent</th>
            <th>Replied</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={+week.start}>
              <td>{weekLabel(week.start)}</td>
              <td>{week.sent}</td>
              <td>{week.replied}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
