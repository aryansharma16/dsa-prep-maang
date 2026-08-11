import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { ROLE_LABEL } from '../../store/caps.js';
import { MeterRow } from '../ui/MeterRow.jsx';
import { Tile } from '../ui/Tile.jsx';
import { AuditRow } from './AuditRow.jsx';
import { DayColumns } from './DayColumns.jsx';
import { SystemHealth } from './SystemHealth.jsx';
import { since } from './time.js';

/** Enough to act on. The rest is one click away in Guides. */
const GAPS_SHOWN = 8;

/**
 * The shell, drawn before the data arrives.
 *
 * The page used to replace itself with a loading line, so everything jumped into
 * place when the request landed. With five panels instead of one that jump is the
 * whole screen. Skeletons hold the layout still.
 */
function Skeleton() {
  return (
    <div className="dash">
      <div className="tiles">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="tile" key={i}>
            <div className="k skeleton" style={{ width: 70, height: 10 }} />
            <div className="v skeleton" style={{ width: 42, height: 22, marginTop: 6 }} />
            <div className="sub skeleton" style={{ width: 96, height: 10, marginTop: 6 }} />
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-body">
          <div className="skeleton" style={{ height: 132 }} />
        </div>
      </div>
    </div>
  );
}

/**
 * What is waiting, what is misconfigured, and whether anyone is here.
 *
 * Ordered by what somebody acts on rather than by what is cheapest to count. The
 * queue leads because it is the only thing on this page with a person on the
 * other end of it; the totals that used to lead are denominators now.
 *
 * Every panel renders on the *presence* of its key rather than on a `can()`
 * check. The server omits what the caller may not have, so absence is the signal
 * — and there is nothing here for a client-side capability check to get wrong.
 */
export function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .overview()
      .then(setData)
      .catch((err) => setError(errorMessage(err, 'Could not load the overview')));
  }, []);

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <Skeleton />;

  const { users, content, activity, audit, recent, health, feedback } = data;

  /*
    `since` answers "now" for anything under an hour, which is right in a column
    of durations and reads as nonsense in a sentence — "oldest waiting now".
  */
  const waited = feedback?.oldestAt ? since(feedback.oldestAt) : null;
  const waitedLine =
    waited === 'now' ? 'the oldest just came in' : `oldest has waited ${waited}`;

  const gaps = content?.missingGuides || [];
  // From the list, never from `patterns - guides` — a guide row outliving its
  // pattern makes the subtraction lie while the list stays right.
  const missing = gaps.length;

  return (
    <div className="dash">
      <div className="tiles">
        {feedback && (
          <Tile
            label="Open feedback"
            value={feedback.open}
            tone={feedback.open > 0 ? 'attention' : undefined}
            to="/admin/feedback"
            sub={feedback.open ? waitedLine : 'nobody is waiting on a reply'}
          />
        )}

        {users && (
          <Tile
            label="Active this week"
            value={users.activeWeek}
            sub={`of ${users.total} ${users.total === 1 ? 'account' : 'accounts'}`}
          />
        )}

        {users && (
          <Tile
            label="New accounts"
            value={users.newWeek}
            sub="signed up in the last 7 days"
          />
        )}

        {content && (
          <Tile
            label="Guides to write"
            value={missing}
            tone={missing > 0 ? 'attention' : undefined}
            to="/admin/guides"
            sub={missing ? `${content.guides} of ${content.patterns} written` : 'every pattern has one'}
          />
        )}

        {content && (
          <Tile
            label="Hand-edited"
            value={content.edited}
            sub="problems the seed will not touch"
          />
        )}
      </div>

      <div className="panel">
        <div className="panel-head split">
          <span>Attempts logged, last 30 days</span>
          <span className="hint mono">
            {activity.attempts} across {activity.activeDays} days
          </span>
        </div>
        <div className="panel-body">
          <DayColumns days={activity.days} peak={activity.peak} />
        </div>
      </div>

      <div className="dash-grid">
        {health ? <SystemHealth health={health} /> : <div />}

        {users && (
          <div className="panel">
            <div className="panel-head">People</div>
            <div className="panel-body">
              {/*
                Two meters against one total rather than a stacked bar. The two
                windows overlap — everyone active this week is also active this
                month — and a stack would claim they are separate slices of the
                same whole.
              */}
              <MeterRow name="Active this week" value={users.activeWeek} total={users.total} />
              <MeterRow
                name="Active this month"
                value={users.activeMonth}
                total={users.total}
                muted
              />

              <div className="health-row" style={{ marginTop: 12 }}>
                <span className="health-label">Staff</span>
                <span className="health-note">
                  {Object.entries(users.byRole)
                    .filter(([role]) => role !== 'user')
                    .map(([role, n]) => (
                      <span key={role} className={`role-pill ${role}`}>
                        {n} {ROLE_LABEL[role]}
                      </span>
                    ))}
                  {Object.keys(users.byRole).every((r) => r === 'user') && 'Nobody but learners'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {content && missing > 0 && (
        <div className="panel">
          <div className="panel-head split">
            <span>Patterns without a guide</span>
            <Link className="link-btn" to="/admin/guides">
              Write one
            </Link>
          </div>
          <div className="panel-body">
            <ul className="dash-gaps">
              {gaps.slice(0, GAPS_SHOWN).map((p) => (
                <li key={p.slug}>
                  <Link to="/admin/guides">{p.name}</Link>
                </li>
              ))}
            </ul>
            {missing > GAPS_SHOWN && (
              <p className="hint">And {missing - GAPS_SHOWN} more.</p>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head split">
          <span>Recent activity</span>
          <Link className="link-btn" to="/admin/activity">
            {audit.week} this week
          </Link>
        </div>
        <div className="panel-body">
          {recent.length === 0 ? (
            <p className="hint">Nothing has been changed yet.</p>
          ) : (
            recent.map((entry) => <AuditRow key={entry._id} entry={entry} />)
          )}
        </div>
      </div>
    </div>
  );
}
