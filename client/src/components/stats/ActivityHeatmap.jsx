import { useMemo, useState } from 'react';
import { Dropdown } from '../ui/Dropdown.jsx';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today, as a UTC midnight — the same bucket the server keys days by. */
const utcToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/**
 * The window the grid covers.
 *
 * Rolling months by default, because "the last three months" is the question
 * people actually have about their own consistency. Whole calendar years are
 * offered alongside for the one question rolling windows cannot answer — "what
 * did last year look like" — and only for years that have something in them, so
 * the menu never offers an empty grid.
 */
function rangeOptions(heatmap) {
  const today = utcToday();
  const thisYear = today.getUTCFullYear();

  const years = [...new Set(heatmap.map((h) => Number(h.date.slice(0, 4))))]
    .filter((year) => Number.isFinite(year) && year !== thisYear)
    .sort((a, b) => b - a);

  /*
    `phrase` is the same range said in a sentence — "in the last 12 months",
    "in 2025". Lowercasing the menu label instead reads as "attempts in last 12
    months", which is the sort of thing you only notice once and then cannot
    stop noticing. Dropdown ignores keys it does not know about.
  */
  return [
    { value: 'm12', label: 'Last 12 months', phrase: 'the last 12 months' },
    { value: 'm6', label: 'Last 6 months', phrase: 'the last 6 months' },
    { value: 'm3', label: 'Last 3 months', phrase: 'the last 3 months' },
    {
      value: `y${thisYear}`,
      label: `${thisYear}`,
      note: 'This year so far',
      phrase: `${thisYear} so far`,
    },
    ...years.map((year) => ({
      value: `y${year}`,
      label: `${year}`,
      note: 'Calendar year',
      phrase: `${year}`,
    })),
  ];
}

function rangeFor(option) {
  const today = utcToday();

  if (option.startsWith('y')) {
    const year = Number(option.slice(1));
    const from = new Date(Date.UTC(year, 0, 1));
    const december = new Date(Date.UTC(year, 11, 31));
    // The current year stops at today rather than running to December, so the
    // grid does not trail four months of blank squares that only mean "not yet".
    return { from, to: december > today ? today : december };
  }

  const from = new Date(today);
  from.setUTCMonth(from.getUTCMonth() - Number(option.slice(1)));
  from.setUTCDate(from.getUTCDate() + 1);
  return { from, to: today };
}

/**
 * The range as week columns, Sunday to Saturday.
 *
 * Both edges are widened to whole weeks — back to the Sunday on or before the
 * start, forward to the Saturday on or after the end — because a column is a
 * week and a half-drawn one would misalign every row beneath it. The days that
 * widening pulls in sit `outside` the range and are rendered hidden.
 *
 * That `outside` flag is also what covers the rest of the current week. Getting
 * this wrong is subtle: anchoring the window by walking back a year and *then*
 * aligning to a Sunday shifts the whole grid earlier and ends it up to six days
 * short, which drops today off the right edge and makes the heatmap look empty
 * on the day you actually solved something.
 *
 * Every date is built in UTC. Local dates would shift the whole grid by a day
 * for anyone east of Greenwich, since the server keys its buckets by UTC day.
 */
function buildWeeks(heatmap, option) {
  const counts = new Map(heatmap.map((h) => [h.date, h.count]));
  const { from, to } = rangeFor(option);

  const start = new Date(from);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const end = new Date(to);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  // Inclusive of both ends — `end` is the last day, not the start of the last
  // week, so the +1 belongs inside the division. Outside it, every range gains
  // a spurious empty column on the right.
  const columns = Math.round(((end - start) / DAY_MS + 1) / 7);

  // Scaled against the busiest day *in view*, so narrowing the range re-reads
  // the ramp against what is on screen instead of against a spike from March.
  let max = 1;
  for (const [key, count] of counts) {
    const date = new Date(`${key}T00:00:00Z`);
    if (date >= from && date <= to) max = Math.max(max, count);
  }

  const weeks = [];
  const cursor = new Date(start);

  for (let w = 0; w < columns; w += 1) {
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(cursor);
      const key = date.toISOString().slice(0, 10);
      const count = counts.get(key) || 0;
      days.push({
        key,
        count,
        date,
        outside: date < from || date > to,
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
  const [range, setRange] = useState('m12');

  const options = useMemo(() => rangeOptions(heatmap), [heatmap]);
  const weeks = useMemo(() => buildWeeks(heatmap, range), [heatmap, range]);
  const labels = useMemo(() => monthLabels(weeks), [weeks]);
  const [hover, setHover] = useState(null);

  // What is on screen, rather than the all-time totals beside it. A range
  // selector that left the count unchanged would be lying about one of the two.
  const shown = useMemo(
    () =>
      weeks
        .flat()
        .reduce((n, day) => n + (day.outside ? 0 : day.count), 0),
    [weeks],
  );

  const phrase = options.find((o) => o.value === range)?.phrase ?? '';

  return (
    <div className="panel">
      <div className="panel-head heat-head">
        <span>
          <b className="mono">{shown}</b> {shown === 1 ? 'attempt' : 'attempts'} in {phrase}
        </span>
        <span className="heat-meta">
          Active days <b className="mono">{activity?.activeDays ?? 0}</b>
          <i />
          Current streak <b className="mono">{activity?.streak ?? 0}</b>
          <i />
          Longest streak <b className="mono">{activity?.maxStreak ?? 0}</b>
        </span>
        <Dropdown
          variant="inline"
          ariaLabel="Time range"
          value={range}
          options={options}
          onChange={setRange}
        />
      </div>

      <div className="panel-body">
        {/*
          The column count drives the CSS. Cells are a fraction of the width
          rather than a fixed 13px, so the grid fills the panel it is given and
          never needs a scrollbar — which is what put one there before, and a
          horizontal `overflow-x: auto` promotes `overflow-y` to auto as well,
          so it produced a stray vertical bar on top of the dead space.
        */}
        <div className="heat-scroll" style={{ '--heat-cols': weeks.length }}>
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
                days.map((day, d) => (
                  <i
                    key={day.key}
                    className="heat-cell"
                    data-level={day.outside ? undefined : day.level}
                    // Placed explicitly even when hidden, so the column stays
                    // open and nothing depends on auto-flow to land right.
                    style={{
                      gridColumn: w + 1,
                      gridRow: d + 1,
                      ...(day.outside ? { visibility: 'hidden' } : null),
                    }}
                    onMouseEnter={
                      day.outside
                        ? undefined
                        : (e) => {
                            const cell = e.currentTarget.getBoundingClientRect();
                            const host = e.currentTarget
                              .closest('.heat-scroll')
                              .getBoundingClientRect();
                            // Top rows would put the tooltip over the month
                            // labels, or clip it against the panel — drop it
                            // below instead.
                            const below = d < 3;
                            setHover({
                              text: `${day.count} ${day.count === 1 ? 'attempt' : 'attempts'} · ${fmt(day.date)}`,
                              x: cell.left - host.left + cell.width / 2,
                              y: (below ? cell.bottom : cell.top) - host.top,
                              below,
                            });
                          }
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                )),
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
          <span className="hint">Every square is a day. Darker means more attempts logged.</span>
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
