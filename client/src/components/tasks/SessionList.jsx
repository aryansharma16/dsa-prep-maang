import { useState } from 'react';
import { IconAlert, IconPlus, IconTrash } from '../ui/Icons.jsx';
import { duration, sessionStamp } from './time.js';

/**
 * Every sitting at this task, and a way to add one you forgot to measure.
 *
 * Manual entry is not a lesser path. The timer you forgot to start is the
 * common case, and a tracker you cannot correct is a tracker you stop trusting
 * and then stop using — so a typed session is stored exactly like a measured
 * one, and only labelled differently.
 *
 * A truncated session is marked rather than quietly kept. It means a clock ran
 * past twelve hours and was closed at the cap, which is a number to fix rather
 * than believe.
 */
export function SessionList({ sessions, total, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [minutes, setMinutes] = useState('30');

  const submit = (event) => {
    event.preventDefault();
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 1 || value > 12 * 60) return;
    onAdd(value);
    setMinutes('30');
    setAdding(false);
  };

  return (
    <div className="tk-sessions">
      <div className="tk-section-count mono">
        {total ? duration(total) : 'nothing logged'}
        {sessions.length > 0 && ` · ${sessions.length} ${sessions.length === 1 ? 'sitting' : 'sittings'}`}
      </div>

      {sessions.length > 0 && (
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              <span className="mono tk-session-len">{duration(session.seconds)}</span>
              <span className="tk-session-when">{sessionStamp(session.startedAt)}</span>
              {session.manual && <span className="tag-mini">typed</span>}
              {session.truncated && (
                <span className="tag-mini warn" title="The clock ran past 12 hours and was capped">
                  <IconAlert size={10} />
                  capped
                </span>
              )}
              <span className="spacer" />
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove this session"
                title="Remove"
                onClick={() => onRemove(session)}
              >
                <IconTrash size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className="tk-session-add" onSubmit={submit}>
          <input
            type="number"
            min="1"
            max={12 * 60}
            value={minutes}
            autoFocus
            aria-label="Minutes"
            onChange={(event) => setMinutes(event.target.value)}
          />
          <span className="hint">minutes</span>
          <button type="submit" className="btn primary">
            Log
          </button>
          <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="link-btn" onClick={() => setAdding(true)}>
          <IconPlus size={11} />
          Log time by hand
        </button>
      )}
    </div>
  );
}
