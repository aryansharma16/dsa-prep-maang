import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { applicationsApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { moduleVisible } from '../../store/modules.js';
import { IconClock } from '../ui/Icons.jsx';
import { deadlineLabel, roundWhen } from './time.js';

/**
 * What the job hunt needs from you, in the top bar.
 *
 * Renders nothing unless there is something — the same rule `TimerPill` follows,
 * and the reason this can sit on every page without being clutter. Most days
 * there is nothing.
 *
 * It is the one thing in this module that reaches outside it, and it earns that
 * because of what it prevents: an application does not go stale loudly. A round
 * you forgot is on Thursday and a follow-up you meant to send a week ago both
 * look exactly like a board you have not opened, and the whole failure mode of
 * a tracker is that you stop opening it. A count in the bar is the one place
 * that can say otherwise without being asked.
 *
 * `GET /applications/due` exists rather than reusing the board read for exactly
 * this: the board is every application with its rounds attached, and drawing a
 * number in the corner of the roadmap should not cost that.
 */
export function DueBadge() {
  const { modules } = useAuth();
  const [due, setDue] = useState(null);

  /*
    `modules` is null until the session resolves, and `moduleVisible` reads that
    as hidden — so a request never goes out for somebody the module is off for,
    which is also what keeps this from drawing a 404 into the console on every
    page load.
  */
  const enabled = moduleVisible(modules, 'applications');

  useEffect(() => {
    if (!enabled) return undefined;

    let live = true;
    const fetch = () =>
      applicationsApi
        .due()
        .then((data) => live && setDue(data))
        .catch(() => {});

    fetch();
    /*
      Every ten minutes, and only while the tab is visible. Nothing here changes
      on its own — a round becomes due because time passed, not because anybody
      wrote anything — so this is the one poll in the app whose interval is
      about the calendar rather than about a race.
    */
    const timer = setInterval(() => document.visibilityState === 'visible' && fetch(), 600000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [enabled]);

  if (!enabled || !due?.count) return null;

  const next = due.upcoming[0];
  const overdue = due.overdue.length;

  /* A round has a time worth showing; an offer deadline is a day, and saying
     what it is for is the difference between "Atlassian 4" and something you
     can act on. */
  const when = (item) =>
    item.kind === 'decision'
      ? `offer decision ${deadlineLabel(item.at).toLowerCase()}`
      : item.at
        ? roundWhen(item.at)
        : '';

  const title = [next && `${next.company}: ${when(next)}`, overdue && `${overdue} to chase`]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link className={`ap-due ${overdue ? 'is-overdue' : ''}`} to="/applications" title={title}>
      <IconClock size={12} />
      {/*
        The soonest round rather than the count, when there is one. "Razorpay
        Thu" is something you act on; "3" is something you have to click to
        understand, and the point of a badge is not having to.
      */}
      {next ? (
        <span className="ap-due-next">
          {next.company}
          <em>{when(next)}</em>
        </span>
      ) : (
        <span className="ap-due-next">
          {overdue} to chase
        </span>
      )}
      {due.count > 1 && <span className="ap-due-count mono">{due.count}</span>}
    </Link>
  );
}
