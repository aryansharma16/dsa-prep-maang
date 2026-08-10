import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { ROLE_LABEL, can } from '../../store/caps.js';
import { IconPlus } from '../ui/Icons.jsx';
import { AvatarButton } from '../ui/PhotoPreview.jsx';
import { CreateUserModal } from './CreateUserModal.jsx';
import { UserDetailModal } from './UserDetailModal.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';

const shortDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * How long ago, coarsely.
 *
 * A column scanned down a list wants "3d", not "3 days ago" — the unit is the
 * only part that varies and the eye is comparing magnitudes. The detail panel
 * spells the same fact out in words, where there is one of it to read.
 */
function since(value) {
  if (!value) return '—';
  const mins = Math.round((Date.now() - new Date(value)) / 60000);
  if (!Number.isFinite(mins)) return '—';
  if (mins < 60) return 'now';
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}d`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}mo` : `${Math.round(months / 12)}y`;
}

const exact = (value) => (value ? new Date(value).toLocaleString() : 'No record of this yet');

export function AdminUsers() {
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    adminApi
      .users({ q: q || undefined, role: role || undefined, page, limit: 25 })
      .then(setData)
      .catch((err) => setError(errorMessage(err, 'Could not load the user list')));
  }, [q, role, page]);

  // Debounced so typing in the search box is one request, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  if (error) return <div className="alert">{error}</div>;
  if (!data) return <div className="loading">Loading users...</div>;

  return (
    <>
      <div className="filterbar">
        <div className="search admin-search">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            aria-label="Search users"
          />
        </div>

        <Dropdown
          variant="inline"
          ariaLabel="Role"
          value={role}
          onChange={(v) => {
            setRole(v);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All roles' },
            ...Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />

        <span className="spacer" />
        <span className="hint mono">{data.total} accounts</span>

        {can(me, 'user:create') && (
          <button type="button" className="btn primary" onClick={() => setCreating(true)}>
            <IconPlus size={13} />
            New user
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-body">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Joined</th>
                {/* Active before signed-in: "are they still using this" is the
                    question this column gets opened for, and a sign-in months
                    ago on an account seen today only means the session held. */}
                <th>Active</th>
                <th>Signed in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="admin-person">
                      <AvatarButton name={u.name} email={u.email} src={u.avatar?.url} size={28} />
                      <span>
                        <b>{u.name}</b>
                        {u._id === me._id && <span className="tag-mini">you</span>}
                        <span className="hint">{u.email}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`role-pill ${u.role}`}>{ROLE_LABEL[u.role]}</span>
                  </td>
                  <td className="cell-dim mono">{shortDate(u.createdAt)}</td>
                  <td className="cell-dim mono" title={exact(u.lastSeenAt)}>
                    {since(u.lastSeenAt)}
                  </td>
                  <td className="cell-dim mono" title={exact(u.lastLoginAt)}>
                    {since(u.lastLoginAt)}
                  </td>
                  <td className="admin-row-acts">
                    <button className="link-btn" onClick={() => setOpenId(u._id)}>
                      {can(me, 'user:write') ? 'Manage' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.users.length === 0 && <p className="hint">No accounts match that search.</p>}
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

      {openId && (
        <UserDetailModal
          userId={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}

      {creating && <CreateUserModal onClose={() => setCreating(false)} onCreated={load} />}
    </>
  );
}
