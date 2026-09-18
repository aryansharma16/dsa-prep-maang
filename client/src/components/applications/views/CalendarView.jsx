import { useMemo, useState } from 'react';

import { IconArrowLeft, IconArrowRight } from '../../ui/Icons.jsx';
import { outcomeHue, roundTypeLabel } from '../vocab.js';

/**
 * The job hunt as a month.
 *
 * The board is organised by *where* each company is; this is organised by
 * *when* — which is the question you actually have on a Sunday night: what is
 * booked this week, which follow-ups come due, and when the one offer with a
 * deadline runs out. Three kinds of entry, drawn differently because they ask
 * different things of you:
 *
 *   a round        something to prepare for — coloured by its outcome
 *   a follow-up    something you owe — outlined, because it is a nudge
 *   a deadline     the offer's decide-by date — the one date anybody fears
 *
 * Applications sent are a count per day rather than an entry each. Twenty
 * cards on the evening you sent twenty applications would bury the three
 * interviews that week, which are the reason anybody opens a calendar.
 *
 * Everything comes off the board's cards — rounds arrive with their dates on
 * them, minus the question bodies — so this view fetches nothing.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const keyOf = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const timeOf = (value) =>
  new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Monday-first, six rows, padded with the neighbouring months. */
function grid(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function CalendarView({ apps, onOpen }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const byDay = useMemo(() => {
    const map = new Map();
    const push = (value, entry) => {
      if (!value) return;
      const key = keyOf(value);
      if (!map.has(key)) map.set(key, { entries: [], applied: [] });
      if (entry.kind === 'applied') map.get(key).applied.push(entry);
      else map.get(key).entries.push(entry);
    };

    apps.forEach((app) => {
      (app.rounds || []).forEach((round) =>
        push(round.scheduledAt, {
          kind: 'round',
          at: round.scheduledAt,
          app,
          label: `${app.company} · ${round.label || roundTypeLabel(round.type)}`,
          hue: outcomeHue(round.outcome),
        }),
      );
      push(app.followUpBy, { kind: 'follow', at: app.followUpBy, app, label: `Chase ${app.company}` });
      push(app.comp?.decideBy, {
        kind: 'deadline',
        at: app.comp?.decideBy,
        app,
        label: `${app.company} offer expires`,
      });
      push(app.appliedAt, { kind: 'applied', app });
    });

    map.forEach((day) => day.entries.sort((a, b) => new Date(a.at) - new Date(b.at)));
    return map;
  }, [apps]);

  const days = grid(cursor.year, cursor.month);
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const shift = (by) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + by, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const todayKey = keyOf(today);

  return (
    <section className="ap-cal">
      <header className="ap-cal-head">
        <h2>{title}</h2>
        <span className="spacer" />
        <button
          type="button"
          className="btn sm"
          onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
        >
          Today
        </button>
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          <IconArrowLeft size={13} />
        </button>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shift(1)}>
          <IconArrowRight size={13} />
        </button>
      </header>

      <div className="ap-cal-grid" role="grid" aria-label={title}>
        {WEEKDAYS.map((day) => (
          <div key={day} className="ap-cal-wd" role="columnheader">
            {day}
          </div>
        ))}

        {days.map((date) => {
          const key = keyOf(date);
          const day = byDay.get(key);
          const outside = date.getMonth() !== cursor.month;

          return (
            <div
              key={key}
              role="gridcell"
              className={`ap-cal-day ${outside ? 'is-outside' : ''} ${key === todayKey ? 'is-today' : ''}`}
            >
              <span className="ap-cal-n">{date.getDate()}</span>

              {day?.entries.slice(0, 3).map((entry, index) => (
                <button
                  key={`${entry.kind}-${entry.app.id}-${index}`}
                  type="button"
                  className={`ap-cal-entry is-${entry.kind}`}
                  data-hue={entry.hue || (entry.kind === 'deadline' ? 'amber' : 'slate')}
                  title={entry.kind === 'round' ? `${entry.label}, ${timeOf(entry.at)}` : entry.label}
                  onClick={() => onOpen(entry.app)}
                >
                  <i className="ap-dot" aria-hidden="true" />
                  {entry.kind === 'round' && <span className="mono">{timeOf(entry.at)}</span>}
                  <span className="ap-cal-label">{entry.label}</span>
                </button>
              ))}

              {day?.entries.length > 3 && (
                <span className="ap-cal-more">+{day.entries.length - 3} more</span>
              )}

              {day?.applied.length > 0 && (
                <span
                  className="ap-cal-sent"
                  title={day.applied.map((entry) => entry.app.company).join(', ')}
                >
                  {day.applied.length} sent
                </span>
              )}
            </div>
          );
        })}
      </div>

      <footer className="ap-cal-key ap-muted">
        <span>
          <i className="ap-cal-swatch is-round" /> Round
        </span>
        <span>
          <i className="ap-cal-swatch is-follow" /> Follow-up due
        </span>
        <span>
          <i className="ap-cal-swatch is-deadline" /> Offer deadline
        </span>
      </footer>
    </section>
  );
}
