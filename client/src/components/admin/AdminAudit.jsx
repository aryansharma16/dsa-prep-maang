import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { AuditRow } from './AuditRow.jsx';

export function AdminAudit() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let live = true;
    adminApi
      .audit({ action: action || undefined, actor: actor || undefined, page, limit: 40 })
      .then((res) => live && setData(res))
      .catch((err) => live && setError(errorMessage(err, 'Could not load the activity log')));
    return () => {
      live = false;
    };
  }, [action, actor, page]);

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <div className="loading">Loading activity...</div>;

  const reset = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <div className="filterbar">
        <select
          className={`select ${action ? 'on' : ''}`}
          value={action}
          onChange={(e) => reset(setAction)(e.target.value)}
        >
          <option value="">All actions</option>
          {data.filters.actions.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <select
          className={`select ${actor ? 'on' : ''}`}
          value={actor}
          onChange={(e) => reset(setActor)(e.target.value)}
        >
          <option value="">Everyone</option>
          {data.filters.actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.email}
            </option>
          ))}
        </select>

        <span className="spacer" />
        <span className="hint mono">{data.total} entries</span>
      </div>

      <div className="panel">
        <div className="panel-body">
          {data.entries.length === 0 ? (
            <p className="hint">Nothing matches those filters.</p>
          ) : (
            data.entries.map((entry) => <AuditRow key={entry._id} entry={entry} />)
          )}
        </div>
      </div>

      {data.pages > 1 && (
        <div className="admin-pager">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="hint mono">
            {page} / {data.pages}
          </span>
          <button
            className="btn"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
