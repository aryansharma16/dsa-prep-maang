import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { AuditRow } from './AuditRow.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';

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
        <Dropdown
          variant="inline"
          ariaLabel="Action"
          value={action}
          onChange={reset(setAction)}
          options={[
            { value: '', label: 'All actions' },
            ...data.filters.actions.map((a) => ({ value: a.value, label: a.label })),
          ]}
        />

        <Dropdown
          variant="inline"
          ariaLabel="Actor"
          value={actor}
          onChange={reset(setActor)}
          options={[
            { value: '', label: 'Everyone' },
            ...data.filters.actors.map((a) => ({ value: a.id, label: a.email })),
          ]}
        />

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
