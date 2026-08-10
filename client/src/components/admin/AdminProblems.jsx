import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { can } from '../../store/caps.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { IconPlus } from '../ui/Icons.jsx';
import { ProblemEditModal } from './ProblemEditModal.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';

export function AdminProblems() {
  const { user: me } = useAuth();
  const { groups, reload } = useRoadmap();
  const { success, error } = useToast();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [pattern, setPattern] = useState('');
  const [scope, setScope] = useState('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const writable = can(me, 'content:write');

  const load = useCallback(() => {
    adminApi
      .problems({ q: q || undefined, pattern: pattern || undefined, scope, page, limit: 25 })
      .then(setData)
      .catch((err) => setLoadError(errorMessage(err, 'Could not load problems')));
  }, [q, pattern, scope, page]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = async () => {
    setBusy(true);
    try {
      const res = await adminApi.deleteProblem(deleting._id);
      success(
        res.progressDeleted
          ? `Deleted — ${res.progressDeleted} progress rows went with it`
          : 'Problem deleted',
      );
      setDeleting(null);
      load();
      reload();
    } catch (err) {
      error(errorMessage(err, 'Could not delete that problem'));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <div className="alert">{loadError}</div>;
  if (!data) return <div className="loading">Loading problems...</div>;

  return (
    <>
      {!writable && (
        <div className="alert">
          Read-only — only the super admin can change problems.
        </div>
      )}

      <div className="filterbar">
        <div className="search admin-search">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title or slug..."
            aria-label="Search problems"
          />
        </div>

        <Dropdown
          variant="inline"
          ariaLabel="Pattern"
          value={pattern}
          onChange={(v) => {
            setPattern(v);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All patterns' },
            ...groups.map((g) => ({ value: g.slug, label: g.name })),
          ]}
        />

        {/* "Everything" is this one's neutral, not the empty string, so the
            highlight has to be stated rather than inferred from having a value. */}
        <Dropdown
          variant="inline"
          ariaLabel="Scope"
          value={scope}
          on={scope !== 'all'}
          onChange={(v) => {
            setScope(v);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Everything' },
            { value: 'shared', label: 'Shared curriculum' },
            { value: 'custom', label: 'User-added' },
            { value: 'edited', label: 'Hand-edited' },
          ]}
        />

        <span className="spacer" />
        <span className="hint mono">{data.total} problems</span>
        {writable && (
          <button className="btn" onClick={() => setEditing({ isNew: true })}>
            <IconPlus size={13} />
            New
          </button>
        )}
      </div>

      <div className="panel">
        <div className="panel-body">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Problem</th>
                <th>Pattern</th>
                <th>Difficulty</th>
                <th>Whose</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.problems.map((p) => (
                <tr key={p._id}>
                  <td>
                    <b>{p.title}</b>
                    {p.editedAt && (
                      <span className="tag-mini" title="Edited here — the seed script leaves it alone">
                        edited
                      </span>
                    )}
                    <span className="hint mono">{p.slug}</span>
                  </td>
                  <td className="cell-dim">{p.patternSlug}</td>
                  <td>
                    <span className={`diff ${p.difficulty}`}>{p.difficulty}</span>
                  </td>
                  {/*
                    Whose, not just "someone's". The scope filter can already
                    narrow to user-added problems; without a name that list is a
                    pile of rows nobody can attribute, and attributing them is
                    the reason to look at it.
                  */}
                  <td className="cell-dim">
                    {p.owner ? (
                      <>
                        <b>{p.owner.name}</b>
                        <span className="hint">{p.owner.email}</span>
                      </>
                    ) : (
                      'shared'
                    )}
                  </td>
                  <td className="admin-row-acts">
                    <button className="link-btn" onClick={() => setEditing(p)}>
                      {writable ? 'Edit' : 'View'}
                    </button>
                    {writable && (
                      <button className="link-btn danger" onClick={() => setDeleting(p)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.problems.length === 0 && <p className="hint">Nothing matches those filters.</p>}
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

      {editing && (
        <ProblemEditModal
          problem={editing.isNew ? null : editing}
          readOnly={!writable}
          onClose={() => setEditing(null)}
          onSaved={() => {
            load();
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this problem?"
          /* Now that the owner has a name, say whose it is. "Removed for
             everyone" was true of the curriculum and wrong about a private
             addition, which is the case where it mattered most. */
          message={
            deleting.owner
              ? `“${deleting.title}” is removed from ${deleting.owner.name}’s roadmap.`
              : `“${deleting.title}” is removed for everyone.`
          }
          detail={
            deleting.owner
              ? `This is ${deleting.owner.email}’s own problem — nobody else can see it. Their progress on it goes too.`
              : 'This is part of the shared curriculum. Every user’s progress on it — solved status, notes, attempts — is deleted with it and cannot be recovered.'
          }
          confirmLabel="Delete problem"
          tone="danger"
          confirmText={deleting.owner ? undefined : deleting.title}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
