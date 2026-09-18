import { useEffect, useMemo, useState } from 'react';

import { applicationsApi } from '../../../api/index.js';
import { errorMessage } from '../../../api/http.js';
import { IconNote } from '../../ui/Icons.jsx';
import { CompanyMark } from '../CompanyMark.jsx';
import { TIMELINE_ICONS, describeEvent } from '../Timeline.jsx';
import { dayStamp } from '../time.js';

/**
 * The whole job hunt as one story, newest first.
 *
 * The drawer's timeline answers "what happened with Razorpay". This answers
 * "what happened *this week*" — every application, every round, every stage a
 * card reached, every call you logged, on one rail and grouped by day. It is
 * the view to open on a Friday to see whether the week actually moved anything.
 *
 * The events come from the server's `/feed`, which runs the *same*
 * `applicationTimeline` the drawer does over every application and merges the
 * results. That is the point of the endpoint: this screen and the drawer word
 * and order events by one set of rules rather than two, and the feed carries
 * the logged calls and follow-ups that the board's cards do not.
 *
 * It honours the page's search and filters by keeping only events whose
 * application is currently visible — so "referred only" narrows the story the
 * same way it narrows the board.
 */

const dayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

function dayHeading(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
}

const clock = (value) =>
  new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * One event on the rail. Outside `FeedView` so a re-render of the feed does not
 * hand every row a new component type — which would remount the lot and replay
 * the rise animation on every keystroke in the search box.
 */
function FeedRow({ event, index, showTime, app, onOpen }) {
  const { title, detail, hue } = describeEvent(event);
  const Icon = TIMELINE_ICONS[event.kind] || IconNote;

  return (
    <li className="ap-feed-row" data-hue={hue} style={{ '--i': Math.min(index, 12) }}>
      <span className="ap-tl-node" aria-hidden="true">
        <Icon size={11} />
      </span>
      <button type="button" className="ap-feed-body" onClick={() => app && onOpen(app)}>
        <CompanyMark company={event.company} slug={event.logoSlug} size={18} />
        <span className="ap-feed-text">
          <strong>{event.company}</strong>
          <span className="ap-feed-what">
            {title}
            {detail && <span className="ap-tl-detail">{detail}</span>}
          </span>
        </span>
        <time className="ap-tl-when">
          {showTime ? `${dayStamp(event.at)}, ${clock(event.at)}` : clock(event.at)}
        </time>
      </button>
    </li>
  );
}

export function FeedView({ apps, onOpen }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');

  /*
    Re-fetched whenever the set of applications changes shape, so a drag on the
    board or a round added in the drawer shows up here without a reload. Keyed
    on `updatedAt` rather than on the array identity, which changes on every
    render of the page.
  */
  const version = apps.map((app) => `${app.id}:${app.updatedAt}`).join('|');

  useEffect(() => {
    let live = true;
    applicationsApi
      .feed()
      .then((rows) => live && setEvents(rows))
      .catch((err) => live && setError(errorMessage(err, 'Could not load the timeline')));
    return () => {
      live = false;
    };
  }, [version]);

  const byId = useMemo(() => new Map(apps.map((app) => [String(app.id), app])), [apps]);

  const { upcoming, days } = useMemo(() => {
    const now = Date.now();
    const shown = (events || []).filter((event) => byId.has(String(event.applicationId)));

    /* Booked rounds are the one kind of future event, and they get their own
       block at the top rather than being mixed into the history. */
    const future = shown.filter((event) => +new Date(event.at) > now).reverse();
    const past = shown.filter((event) => +new Date(event.at) <= now);

    const groups = [];
    past.forEach((event) => {
      const key = dayKey(event.at);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.events.push(event);
      else groups.push({ key, at: event.at, events: [event] });
    });

    return { upcoming: future, days: groups };
  }, [events, byId]);

  if (error) return <div className="alert">{error}</div>;
  if (!events) return <div className="loading">Loading…</div>;
  if (!upcoming.length && !days.length) {
    return (
      <div className="empty">
        <h3>Nothing has happened yet</h3>
        <p>Applications, rounds and calls will line up here as you log them.</p>
      </div>
    );
  }

  return (
    <div className="ap-feed">
      {upcoming.length > 0 && (
        <section className="ap-feed-day is-upcoming">
          <h3>Coming up</h3>
          <ol className="ap-feed-list">
            {upcoming.map((event, index) => (
              <FeedRow
                key={event.id}
                event={event}
                index={index}
                showTime
                app={byId.get(String(event.applicationId))}
                onOpen={onOpen}
              />
            ))}
          </ol>
        </section>
      )}

      {days.map((day) => (
        <section key={day.key} className="ap-feed-day">
          <h3>
            {dayHeading(day.at)}
            <span className="ap-muted">{day.events.length}</span>
          </h3>
          <ol className="ap-feed-list">
            {day.events.map((event, index) => (
              <FeedRow
                key={event.id}
                event={event}
                index={index}
                app={byId.get(String(event.applicationId))}
                onOpen={onOpen}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
