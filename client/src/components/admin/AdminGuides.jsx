import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { invalidateGuide } from '../../hooks/useGuide.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { can } from '../../store/caps.js';
import { useToast } from '../../store/ToastContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { GuideEditor } from './GuideEditor.jsx';

const shortDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—';

export function AdminGuides() {
  const { user: me } = useAuth();
  const { success, error } = useToast();

  const [guides, setGuides] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);
  const [unlocking, setUnlocking] = useState(null);
  const [busy, setBusy] = useState(false);

  const writable = can(me, 'guide:write');

  const load = () =>
    adminApi
      .guides()
      .then(setGuides)
      .catch((err) => setLoadError(errorMessage(err, 'Could not load guides')));

  useEffect(() => {
    load();
  }, []);

  const unlock = async () => {
    setBusy(true);
    try {
      await adminApi.unlockGuide(unlocking.patternSlug);
      invalidateGuide(unlocking.patternSlug);
      success('Handed back to the seeder');
      setUnlocking(null);
      load();
    } catch (err) {
      error(errorMessage(err, 'Could not do that'));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <div className="alert">{loadError}</div>;
  if (!guides) return <div className="loading">Loading guides...</div>;

  return (
    <>
      <div className="panel">
        <div className="panel-body">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Guide</th>
                <th>Size</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {guides.map((g) => (
                <tr key={g.patternSlug}>
                  <td className="cell-dim mono">{String(g.order).padStart(2, '0')}</td>
                  <td>
                    <b>{g.patternName}</b>
                    {!g.exists && <span className="tag-mini">not written</span>}
                    <span className="hint mono">{g.patternSlug}</span>
                  </td>
                  <td className="cell-dim mono">
                    {g.exists ? `${g.blockCount} blocks · ${g.wordCount} words` : '—'}
                  </td>
                  <td className="cell-dim">
                    {g.editedAt ? (
                      <span title="The seed script leaves this alone">
                        hand-edited {shortDate(g.editedAt)}
                      </span>
                    ) : (
                      'from the repo'
                    )}
                  </td>
                  <td className="admin-row-acts">
                    <button className="link-btn" onClick={() => setEditing(g.patternSlug)}>
                      {writable ? 'Edit' : 'View'}
                    </button>
                    {writable && g.editedAt && (
                      <button className="link-btn danger" onClick={() => setUnlocking(g)}>
                        Hand back
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <GuideEditor slug={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}

      {unlocking && (
        <ConfirmDialog
          title="Hand this guide back to the seeder?"
          message={`“${unlocking.patternName}” stops being hand-edited.`}
          detail="The next `npm run seed:guides` will overwrite it with whatever is in the repo's content file, discarding what was written here."
          confirmLabel="Hand back"
          tone="danger"
          busy={busy}
          onConfirm={unlock}
          onCancel={() => setUnlocking(null)}
        />
      )}
    </>
  );
}
