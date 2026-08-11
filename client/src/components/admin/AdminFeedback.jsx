import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { can } from '../../store/caps.js';
import { FeedbackStatusPill } from '../feedback/FeedbackStatusPill.jsx';
import { CLOSED_STATUSES, STATUS_LABEL, TYPE_LABEL } from '../feedback/vocab.js';
import { Dropdown } from '../ui/Dropdown.jsx';
import { AvatarButton } from '../ui/PhotoPreview.jsx';
import { FeedbackDetailModal } from './FeedbackDetailModal.jsx';
import { exact, since } from './time.js';

/** The first line of the body, for the column under the title. */
const firstLine = (message) => {
  const line = String(message || '').split('\n')[0];
  return line.length > 110 ? `${line.slice(0, 110)}…` : line;
};

/**
 * The queue.
 *
 * Sorted by when things arrived and never by when they were last touched — the
 * server does that, and the reason is worth knowing here too: a queue that
 * reorders as you work it moves rows between pages under the person going down
 * them one at a time.
 */
export function AdminFeedback() {
  const { user: me } = useAuth();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [openItem, setOpenItem] = useState(null);

  const writable = can(me, 'feedback:write');

  const load = useCallback(() => {
    adminApi
      .feedback({
        q: q || undefined,
        status: status || undefined,
        type: type || undefined,
        page,
        limit: 25,
      })
      .then(setData)
      .catch((err) => setLoadError(errorMessage(err, 'Could not load the feedback')));
  }, [q, status, type, page]);

  // Debounced so typing in the search box is one request, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  if (loadError) return <div className="alert">{loadError}</div>;
  if (!data) return <div className="loading">Loading feedback...</div>;

  const waiting = data.counts.open + data.counts.in_review;

  return (
    <>
      {!writable && (
        <div className="alert">Read-only — you can see the queue but not answer it.</div>
      )}

      <div className="filterbar">
        <div className="search admin-search">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search the text, or a name..."
            aria-label="Search feedback"
          />
        </div>

        <Dropdown
          variant="inline"
          ariaLabel="Status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Any status' },
            ...Object.entries(STATUS_LABEL).map(([value, label]) => ({
              value,
              label,
              note: `${data.counts[value] ?? 0} of them`,
            })),
          ]}
        />

        <Dropdown
          variant="inline"
          ariaLabel="Kind"
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Any kind' },
            ...data.types.map((value) => ({ value, label: TYPE_LABEL[value] || value })),
          ]}
        />

        <span className="spacer" />
        <span className="hint mono">
          {data.total} submissions · {waiting} waiting
        </span>
      </div>

      <div className="panel">
        <div className="panel-body">
          <table className="admin-table">
            <thead>
              <tr>
                <th>From</th>
                <th>Kind</th>
                <th>What they said</th>
                <th>Status</th>
                <th>Sent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.submissions.map((item) => (
                <tr key={item._id} className={CLOSED_STATUSES.includes(item.status) ? 'row-off' : ''}>
                  <td>
                    <div className="admin-person">
                      <AvatarButton
                        name={item.submitter.name}
                        email={item.submitter.email}
                        size={28}
                      />
                      <span>
                        <b>{item.submitter.name || 'Deleted account'}</b>
                        <span className="hint">{item.submitter.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="cell-dim">
                    <span className="tag-mini">{TYPE_LABEL[item.type] || item.type}</span>
                  </td>
                  <td>
                    <b>{item.title}</b>
                    <span className="hint">{firstLine(item.message)}</span>
                  </td>
                  <td>
                    <FeedbackStatusPill status={item.status} />
                    {item.response && <span className="tag-mini">answered</span>}
                  </td>
                  <td className="cell-dim mono" title={exact(item.createdAt)}>
                    {since(item.createdAt)}
                  </td>
                  <td className="admin-row-acts">
                    {/* "Answer", not "Open" — the column two along is a status
                        pill that already says Open, and two of them on one row
                        meaning different things is a row nobody reads twice. */}
                    <button className="link-btn" onClick={() => setOpenItem(item)}>
                      {writable ? 'Answer' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.submissions.length === 0 && (
            <p className="hint">
              {q || status || type
                ? 'Nothing matches those filters.'
                : 'Nobody has sent anything yet.'}
            </p>
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
          <button className="btn" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}

      {openItem && (
        <FeedbackDetailModal
          item={openItem}
          writable={writable}
          onClose={() => setOpenItem(null)}
          onSaved={load}
        />
      )}
    </>
  );
}
