import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { can } from '../../store/caps.js';
import { useToast } from '../../store/ToastContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { IconPlus } from '../ui/Icons.jsx';
import { MotivationDraftModal } from './MotivationDraftModal.jsx';
import { MotivationEditModal } from './MotivationEditModal.jsx';
import { MotivationPreview } from './MotivationPreview.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';

/**
 * The motivation corpus.
 *
 * The trigger vocabulary arrives with the list rather than from a second
 * endpoint, so the editor's dropdowns are always the server's current set — a
 * condition added in config/motivationTriggers.js shows up here with no client
 * change at all.
 */
export function AdminMotivation() {
  const { user: me } = useAuth();
  const { success, error } = useToast();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [trigger, setTrigger] = useState('');
  const [surface, setSurface] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);

  const writable = can(me, 'content:write');

  const load = useCallback(() => {
    adminApi
      .motivation({
        q: q || undefined,
        trigger: trigger || undefined,
        surface: surface || undefined,
        active: active || undefined,
        page,
        limit: 25,
      })
      .then(setData)
      .catch((err) => setLoadError(errorMessage(err, 'Could not load the lines')));
  }, [q, trigger, surface, active, page]);

  // Debounced so typing in the search box is one request, not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = async () => {
    setBusy(true);
    try {
      const res = await adminApi.deleteMotivation(deleting._id);
      success(
        res.seeded
          ? 'Deleted — it will come back on the next seed run'
          : 'Line deleted',
      );
      setDeleting(null);
      load();
    } catch (err) {
      error(errorMessage(err, 'Could not delete that line'));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <div className="alert">{loadError}</div>;
  if (!data) return <div className="loading">Loading lines...</div>;

  const catalogue = {
    triggers: data.triggers,
    categories: data.categories,
    surfaces: data.surfaces,
  };
  const labelFor = (key) => data.triggers.find((t) => t.key === key)?.label || key;

  return (
    <>
      {!writable && (
        <div className="alert">Read-only — only the super admin can change these.</div>
      )}

      <MotivationPreview triggers={data.triggers} />

      <div className="filterbar">
        <div className="search admin-search">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search the text..."
            aria-label="Search motivation lines"
          />
        </div>

        <Dropdown
          variant="inline"
          ariaLabel="Condition"
          value={trigger}
          onChange={(v) => {
            setTrigger(v);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Any condition' },
            ...data.triggers.map((t) => ({ value: t.key, label: t.label })),
          ]}
        />

        <Dropdown
          variant="inline"
          ariaLabel="Page"
          value={surface}
          onChange={(v) => {
            setSurface(v);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Any page' },
            ...data.surfaces.map((s) => ({ value: s, label: s })),
          ]}
        />

        <Dropdown
          variant="inline"
          ariaLabel="Active state"
          value={active}
          onChange={(v) => {
            setActive(v);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Active and retired' },
            { value: 'true', label: 'Active only' },
            { value: 'false', label: 'Retired only' },
          ]}
        />

        <span className="spacer" />
        <span className="hint mono">{data.total} lines</span>

        {/* Grouped so the two never split across a wrap — they are one cluster
            of actions, and the filterbar wraps at narrow widths. */}
        {writable && (
          <span className="filterbar-acts">
            <button
              className="btn"
              disabled={!data.ai}
              title={data.ai ? undefined : 'Set GEMINI_API_KEY on the server to enable this'}
              onClick={() => setDrafting(true)}
            >
              Draft with AI
            </button>
            <button className="btn primary" onClick={() => setEditing({ isNew: true })}>
              <IconPlus size={13} />
              New line
            </button>
          </span>
        )}
      </div>

      <div className="panel">
        <div className="panel-body">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Shows when</th>
                <th>Pages</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line._id} className={line.active ? '' : 'row-off'}>
                  <td>
                    <b>{line.text}</b>
                    <span className="hint">
                      {line.category}
                      {line.weight > 1 && ` · weight ${line.weight}`}
                      {!line.active && ' · retired'}
                      {line.editedAt && line.key && ' · edited'}
                      {!line.key && ' · written here'}
                    </span>
                  </td>
                  <td className="cell-dim">
                    {labelFor(line.trigger)}
                    {line.threshold != null && <span className="mono"> · {line.threshold}</span>}
                  </td>
                  <td className="cell-dim mono">{line.surfaces.join(', ')}</td>
                  <td className="admin-row-acts">
                    <button className="link-btn" onClick={() => setEditing(line)}>
                      {writable ? 'Edit' : 'View'}
                    </button>
                    {writable && (
                      <button className="link-btn danger" onClick={() => setDeleting(line)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.lines.length === 0 && <p className="hint">Nothing matches those filters.</p>}
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
        <MotivationEditModal
          line={editing.isNew ? null : editing}
          catalogue={catalogue}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      {drafting && (
        <MotivationDraftModal
          catalogue={catalogue}
          onClose={() => setDrafting(false)}
          onSaved={load}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this line?"
          message={deleting.text}
          detail={
            deleting.key
              ? 'This one came from the content file, so `npm run seed:motivation` will put it back. To retire it for good, uncheck Active instead.'
              : 'This line was written here and exists nowhere else. It cannot be recovered.'
          }
          confirmLabel="Delete line"
          tone="danger"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
