/**
 * What one account has actually been doing.
 *
 * Read-only, and that is the whole design. The panel around it exists to
 * administer an account — rename it, reset it, delete it — and this section
 * exists to answer the questions that come *before* any of that: is this person
 * still here, are they getting anywhere, and what did they put in the roadmap
 * that nobody else can see. None of it is editable, because none of it is the
 * admin's to change: it is a record of someone's own work.
 *
 * Every number is computed server-side in `studyProfile`, from the same
 * `Progress` rows and the same streak helper the learner's own stats page uses.
 * Two implementations would end with the panel and the page disagreeing about a
 * streak, which is the kind of discrepancy nobody can explain a week later.
 */

import { Tile } from '../ui/Tile.jsx';

const DIFF_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

/** "3 hours ago", or "never" — the two answers this section is asked for. */
function ago(value) {
  if (!value) return null;
  const ms = Date.now() - new Date(value);
  if (!Number.isFinite(ms)) return null;

  const mins = Math.round(ms / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  return `${Math.round(months / 12)} year${months < 18 ? '' : 's'} ago`;
}

const exact = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

/** Minutes into something worth reading. Attempts are logged in minutes. */
function timeSpent(minutes) {
  if (!minutes) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function UserStudyRecord({ user, stats, added, recent }) {
  const lastSeen = ago(user.lastSeenAt);
  const lastLogin = ago(user.lastLoginAt);

  return (
    <div className="admin-zone">
      <div className="admin-zone-head">Study record</div>

      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile
          label="Solved"
          value={stats.solved}
          sub={`${stats.attempted} attempted`}
        />
        <Tile
          label="Streak"
          value={stats.currentStreak}
          sub={`best ${stats.maxStreak} · ${stats.activeDays} active days`}
        />
        <Tile
          label="Attempts"
          value={stats.attempts}
          sub={`${timeSpent(stats.minutes)} logged`}
        />
        <Tile
          label="Marked"
          value={stats.flagged + stats.needsRevision}
          sub={`${stats.flagged} flagged · ${stats.needsRevision} to revise`}
        />
      </div>

      {/*
        Two dates, not one, because they answer different questions. A last
        sign-in months ago on an account seen this morning just means their
        session never expired; the pair together is what tells you whether an
        account is dormant or simply long-lived.
      */}
      <div className="field-row" style={{ marginBottom: 12 }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <span>Last active</span>
          <p className="hint" title={exact(user.lastSeenAt)}>
            {lastSeen || 'Not since this was first recorded'}
          </p>
        </div>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <span>Last signed in</span>
          <p className="hint" title={exact(user.lastLoginAt)}>
            {lastLogin || 'Not since this was first recorded'}
          </p>
        </div>
      </div>

      {recent.length > 0 && (
        <>
          <div className="admin-zone-head">Last solved</div>
          <table className="admin-table" style={{ marginBottom: 12 }}>
            <tbody>
              {recent.map((row) => (
                <tr key={row._id}>
                  <td>
                    <b>{row.problem.title}</b>
                    <span className="hint">{row.problem.patternSlug}</span>
                  </td>
                  <td style={{ width: 84 }}>
                    <span className={`diff ${row.problem.difficulty}`}>
                      {row.problem.difficulty}
                    </span>
                  </td>
                  <td style={{ width: 130 }}>
                    <span className="hint" title={exact(row.solvedAt)}>
                      {ago(row.solvedAt) || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="admin-zone-head">
        Problems they added
        <span className="hint" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
          {added.length ? `${added.length} — private to this account` : 'none'}
        </span>
      </div>

      {added.length > 0 && (
        <table className="admin-table">
          <tbody>
            {[...added]
              .sort(
                (a, b) =>
                  (DIFF_ORDER[a.difficulty] ?? 9) - (DIFF_ORDER[b.difficulty] ?? 9) ||
                  a.title.localeCompare(b.title),
              )
              .map((problem) => (
                <tr key={problem._id}>
                  <td>
                    {problem.url ? (
                      <a href={problem.url} target="_blank" rel="noreferrer">
                        <b>{problem.title}</b>
                      </a>
                    ) : (
                      <b>{problem.title}</b>
                    )}
                    <span className="hint">{problem.patternSlug}</span>
                  </td>
                  <td style={{ width: 84 }}>
                    <span className={`diff ${problem.difficulty}`}>{problem.difficulty}</span>
                  </td>
                  <td style={{ width: 130 }}>
                    <span className="hint" title={exact(problem.createdAt)}>
                      {ago(problem.createdAt) || '—'}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
