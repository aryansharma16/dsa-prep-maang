import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { can } from '../../store/caps.js';
import { Dropdown } from '../ui/Dropdown.jsx';
import { Modal } from '../ui/Modal.jsx';
import { StatusChip } from '../ui/StatusChip.jsx';
import { exact, since } from './time.js';

/**
 * Who has asked for an account.
 *
 * This is the only queue in the panel where acting on a row creates something
 * — approving mints a `User` — so the two buttons are not symmetric and the UI
 * says so: Approve is the primary action and Decline opens a dialog, because
 * declining sends a stranger an email with your sentence in it and that should
 * not happen on one click of a small button in a table row.
 *
 * Sorted by arrival, like every other queue here, for the same reason: a list
 * that reorders as you work it moves rows under the person working them.
 */

const STATUS_LABEL = { pending: 'Waiting', approved: 'Approved', rejected: 'Declined' };
const STATUS_STATE = { pending: 'warn', approved: 'ok', rejected: 'off' };

/** "Pune, India · mobile · Android" — whatever of it we actually know. */
const context = (c = {}) =>
  [[c.city, c.country].filter(Boolean).join(', '), c.device, [c.os, c.browser].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');

export function AdminSignups() {
  const { user: me } = useAuth();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  // Opens on the only tab worth opening on: the people still waiting.
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [declining, setDeclining] = useState(null);
  const [note, setNote] = useState('');

  const writable = can(me, 'signup:write');

  const load = useCallback(() => {
    adminApi
      .signups({ q: q || undefined, status: status || undefined, page, limit: 25 })
      .then(setData)
      .catch((err) => setLoadError(errorMessage(err, 'Could not load the requests')));
  }, [q, status, page]);

  // Debounced so typing in the search box is one request, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const approve = async (row) => {
    setBusyId(row._id);
    setActionError('');
    try {
      await adminApi.approveSignup(row._id);
      load();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not approve that request'));
    } finally {
      setBusyId('');
    }
  };

  const decline = async () => {
    setBusyId(declining._id);
    setActionError('');
    try {
      await adminApi.rejectSignup(declining._id, note.trim());
      setDeclining(null);
      setNote('');
      load();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not decline that request'));
    } finally {
      setBusyId('');
    }
  };

  if (loadError) return <div className="alert">{loadError}</div>;
  if (!data) return <div className="loading">Loading requests...</div>;

  return (
    <>
      {!writable && (
        <div className="alert">Read-only — you can see the queue but not decide on it.</div>
      )}
      {actionError && <div className="alert">{actionError}</div>}

      <div className="filterbar">
        <div className="admin-search">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search a name, email or number..."
            aria-label="Search requests"
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
            ...data.statuses.map((value) => ({
              value,
              label: STATUS_LABEL[value] || value,
              note: `${data.counts[value] ?? 0} of them`,
            })),
          ]}
        />

        <span className="spacer" />
        <span className="hint mono">{data.counts.pending} waiting</span>
      </div>

      <div className="panel">
        <div className="panel-body">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Who</th>
                <th>Mobile</th>
                <th>Why</th>
                <th>Where from</th>
                <th>Status</th>
                <th>Asked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.requests.map((row) => (
                <tr key={row._id} className={row.status === 'pending' ? '' : 'row-off'}>
                  <td>
                    <div className="admin-person">
                      <div>
                        <b>{row.name}</b>
                        <small className="mono">{row.email}</small>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{row.mobile}</td>
                  <td className="admin-why">{row.reason || <span className="hint">—</span>}</td>
                  {/* The IP is the title rather than a column: it is what you
                      want on the one row in fifty that looks wrong, and a column
                      of them makes the table unreadable for the other forty-nine. */}
                  <td className="hint" title={row.context.ip ? `IP ${row.context.ip}` : undefined}>
                    {context(row.context) || '—'}
                  </td>
                  <td>
                    <StatusChip state={STATUS_STATE[row.status]}>
                      {STATUS_LABEL[row.status] || row.status}
                    </StatusChip>
                    {row.status !== 'pending' && row.decidedBy && (
                      <small className="hint decided-by" title={exact(row.decidedAt)}>
                        by {row.decidedBy}
                      </small>
                    )}
                  </td>
                  <td className="hint" title={exact(row.createdAt)}>
                    {since(row.createdAt)}
                  </td>
                  <td className="admin-actions">
                    {row.status === 'pending' && writable && (
                      <div>
                        <button
                          type="button"
                          className="btn primary sm"
                          disabled={busyId === row._id}
                          onClick={() => approve(row)}
                        >
                          {busyId === row._id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          disabled={busyId === row._id}
                          onClick={() => {
                            setDeclining(row);
                            setNote('');
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!data.requests.length && (
                <tr>
                  <td colSpan={7} className="hint">
                    {status === 'pending' ? 'Nobody is waiting.' : 'Nothing here.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.pages > 1 && (
        <div className="filterbar">
          <button type="button" className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="hint mono">
            Page {data.page} of {data.pages}
          </span>
          <button
            type="button"
            className="btn ghost sm"
            disabled={page >= data.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/*
        Its own dialog rather than a ConfirmDialog, because there is something to
        type: the note is sent to the applicant, so it has to be written in the
        same breath as the decision rather than added afterwards to a row that
        has already emailed them.
      */}
      {declining && (
        <Modal title={`Decline ${declining.name}?`} size="sm" onClose={() => setDeclining(null)}>
          <div className="modal-body">
            <p className="hint">
              {declining.email} is told their request was not approved. If you write a line here, it
              goes in that email — leave it empty to say nothing.
            </p>
            <label className="field">
              <span>Reason (optional)</span>
              <textarea
                className="auth-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Sent to them, in your words"
              />
            </label>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={() => setDeclining(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={busyId === declining._id}
              onClick={decline}
            >
              {busyId === declining._id ? 'Declining…' : 'Decline and email them'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
