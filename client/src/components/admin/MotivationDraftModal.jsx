import { useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useToast } from '../../store/ToastContext.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * Drafting lines with Gemini.
 *
 * Nothing a model writes reaches a learner without someone choosing it — the
 * endpoint returns candidates and saves none of them, and this dialog only
 * writes the ones that are ticked. That is the whole reason it is a two-step
 * flow rather than a button that fills the table.
 *
 * Everything is editable before saving, because the interesting outcome is
 * usually a line that is nearly right.
 */
export function MotivationDraftModal({ catalogue, onClose, onSaved }) {
  const { success, error } = useToast();

  const [form, setForm] = useState({
    trigger: 'always',
    category: 'grind',
    surfaces: ['roadmap'],
    count: 5,
    brief: '',
  });
  const [drafts, setDrafts] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const spec = catalogue.triggers.find((t) => t.key === form.trigger);

  const toggleSurface = (surface) =>
    set({
      surfaces: form.surfaces.includes(surface)
        ? form.surfaces.filter((s) => s !== surface)
        : [...form.surfaces, surface],
    });

  const draft = async () => {
    setBusy(true);
    try {
      const result = await adminApi.draftMotivation({
        trigger: form.trigger,
        category: form.category,
        surfaces: form.surfaces,
        count: Number(form.count),
        ...(form.brief.trim() ? { brief: form.brief.trim() } : {}),
      });
      // Everything starts unticked. An opt-in list is the difference between
      // reviewing what a model wrote and rubber-stamping it.
      setDrafts(result.map((d) => ({ ...d, keep: false })));
      if (result.length === 0) error('The model returned nothing usable — try again');
    } catch (err) {
      error(errorMessage(err, 'Could not reach the model'));
    } finally {
      setBusy(false);
    }
  };

  const saveChecked = async () => {
    const keeping = drafts.filter((d) => d.keep && d.text.trim());
    if (keeping.length === 0) return;

    setBusy(true);
    try {
      for (const d of keeping) {
        await adminApi.createMotivation({
          text: d.text.trim(),
          category: d.category,
          surfaces: d.surfaces,
          trigger: d.trigger,
          threshold: spec?.threshold ? spec.threshold.default : null,
          weight: 1,
          active: true,
        });
      }
      success(`${keeping.length} line${keeping.length === 1 ? '' : 's'} added`);
      onSaved?.();
      onClose();
    } catch (err) {
      error(errorMessage(err, 'Could not save those lines'));
    } finally {
      setBusy(false);
    }
  };

  const checked = drafts?.filter((d) => d.keep).length || 0;

  return (
    <Modal title="Draft lines with AI" onClose={onClose} size="lg">
      <div className="modal-body">
        {!drafts ? (
          <>
            <div className="field-row">
              <label className="field" style={{ flex: 2 }}>
                <span>Show when</span>
                <select
                  value={form.trigger}
                  disabled={busy}
                  onChange={(e) => set({ trigger: e.target.value })}
                >
                  {catalogue.triggers.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {spec?.hint && <span className="field-hint">{spec.hint}</span>}
              </label>

              <label className="field" style={{ flex: 1 }}>
                <span>Theme</span>
                <select
                  value={form.category}
                  disabled={busy}
                  onChange={(e) => set({ category: e.target.value })}
                >
                  {catalogue.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field" style={{ flex: 1 }}>
                <span>How many</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.count}
                  disabled={busy}
                  onChange={(e) => set({ count: e.target.value })}
                />
              </label>
            </div>

            <div className="field">
              <span>Pages</span>
              <div className="chip-row">
                {catalogue.surfaces.map((surface) => (
                  <button
                    key={surface}
                    type="button"
                    className={`chip ${form.surfaces.includes(surface) ? 'on' : ''}`}
                    disabled={busy}
                    onClick={() => toggleSurface(surface)}
                  >
                    {surface}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Extra direction (optional)</span>
              <input
                value={form.brief}
                disabled={busy}
                placeholder="Aim these at people in their first month."
                onChange={(e) => set({ brief: e.target.value })}
              />
              <span className="field-hint">
                The placeholders this condition can fill are added to the prompt automatically.
              </span>
            </label>
          </>
        ) : (
          <>
            <p className="hint" style={{ marginTop: 0 }}>
              Nothing is saved until you tick it. Edit anything that is nearly right.
            </p>
            {drafts.map((d, i) => (
              <div className="draft-row" key={i}>
                <input
                  type="checkbox"
                  checked={d.keep}
                  disabled={busy}
                  aria-label={`Keep line ${i + 1}`}
                  onChange={(e) =>
                    setDrafts((rows) =>
                      rows.map((row, j) => (j === i ? { ...row, keep: e.target.checked } : row)),
                    )
                  }
                />
                <textarea
                  rows={2}
                  maxLength={240}
                  value={d.text}
                  disabled={busy}
                  onChange={(e) =>
                    setDrafts((rows) =>
                      rows.map((row, j) => (j === i ? { ...row, text: e.target.value } : row)),
                    )
                  }
                />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="modal-foot">
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        {!drafts ? (
          <button
            type="button"
            className="btn primary"
            onClick={draft}
            disabled={busy || form.surfaces.length === 0}
          >
            {busy ? 'Writing...' : 'Draft'}
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => setDrafts(null)} disabled={busy}>
              Start over
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={saveChecked}
              disabled={busy || checked === 0}
            >
              {busy ? 'Saving...' : `Save ${checked || ''}`.trim()}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
