import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { can } from '../../store/caps.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { Modal } from '../ui/Modal.jsx';
import { TagInput } from '../ui/TagInput.jsx';

export function AdminPatterns() {
  const { user: me } = useAuth();
  const { reload } = useRoadmap();
  const { success, error } = useToast();

  const [patterns, setPatterns] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const writable = can(me, 'content:write');

  const load = () =>
    adminApi
      .patterns()
      .then(setPatterns)
      .catch((err) => setLoadError(errorMessage(err, 'Could not load patterns')));

  useEffect(() => {
    load();
  }, []);

  const open = (pattern) => {
    setEditing(pattern);
    setForm({
      name: pattern.name,
      order: pattern.order,
      blurb: pattern.blurb || '',
      keyTechniques: pattern.keyTechniques || [],
    });
  };

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.updatePattern(editing.slug, {
        name: form.name.trim(),
        order: Number(form.order),
        blurb: form.blurb.trim(),
        keyTechniques: form.keyTechniques,
      });
      success('Pattern saved');
      setConfirming(false);
      setEditing(null);
      load();
      reload();
    } catch (err) {
      error(errorMessage(err, 'Could not save that pattern'));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <div className="alert">{loadError}</div>;
  if (!patterns) return <div className="loading">Loading patterns...</div>;

  return (
    <>
      {!writable && (
        <div className="alert">Read-only — only the super admin can change the curriculum.</div>
      )}

      <div className="panel">
        <div className="panel-body">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Pattern</th>
                <th>Problems</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {patterns.map((p) => (
                <tr key={p.slug}>
                  <td className="cell-dim mono">{String(p.order).padStart(2, '0')}</td>
                  <td>
                    <b>{p.name}</b>
                    {p.editedAt && <span className="tag-mini">edited</span>}
                    <span className="hint">{p.blurb}</span>
                  </td>
                  <td className="cell-dim mono">{p.problemCount}</td>
                  <td className="admin-row-acts">
                    <button className="link-btn" onClick={() => open(p)}>
                      {writable ? 'Edit' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && form && (
        <Modal title={editing.name} onClose={() => setEditing(null)} size="lg">
          <div className="modal-body">
            {!writable && <div className="alert">Read-only.</div>}

            <div className="field-row">
              <label className="field" style={{ flex: 3 }}>
                <span>Name</span>
                <input
                  value={form.name}
                  disabled={!writable}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Order</span>
                <input
                  type="number"
                  value={form.order}
                  disabled={!writable}
                  onChange={(e) => setForm({ ...form, order: e.target.value })}
                />
              </label>
            </div>

            <label className="field">
              <span>Blurb</span>
              <textarea
                rows={3}
                value={form.blurb}
                disabled={!writable}
                onChange={(e) => setForm({ ...form, blurb: e.target.value })}
              />
              <span className="field-hint">
                The one line under the pattern heading on the roadmap.
              </span>
            </label>

            <div className="field">
              <span>Key techniques</span>
              <TagInput
                value={form.keyTechniques}
                onChange={(keyTechniques) => writable && setForm({ ...form, keyTechniques })}
              />
            </div>

            <p className="hint mono">slug: {editing.slug} — permanent</p>
          </div>

          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={() => setEditing(null)}>
              {writable ? 'Cancel' : 'Close'}
            </button>
            {writable && (
              <button
                type="button"
                className="btn primary"
                disabled={busy || !form.name.trim()}
                onClick={() => setConfirming(true)}
              >
                {busy ? 'Saving...' : 'Save pattern'}
              </button>
            )}
          </div>
        </Modal>
      )}

      {confirming && (
        <ConfirmDialog
          title="Save this pattern?"
          message={`Every user sees the change to “${form.name.trim()}” on their roadmap and in the sidebar.`}
          detail="Saving marks this pattern as hand-edited, so `npm run seed:db` will skip it from now on — the content files will no longer refresh it until someone re-seeds with --force."
          confirmLabel="Save pattern"
          busy={busy}
          onConfirm={save}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
