import { useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useToast } from '../../store/ToastContext.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';

/**
 * One line, and the condition it fires under.
 *
 * The trigger list, its help text and whether a threshold input exists at all
 * come from the server's catalogue rather than being written out here — so
 * adding a condition in config/motivationTriggers.js gives this form a new
 * option with no edit to this file.
 */

const TOKEN_HELP = {
  weak_pattern: '{pattern} {patternSolved} {patternTotal} {patternRemaining}',
  lapsed: '{days}',
};

const UNIVERSAL_TOKENS = '{solved} {total} {remaining} {percent} {streak} {today} {due} {attempted}';

const blank = {
  text: '',
  category: 'grind',
  surfaces: ['roadmap'],
  trigger: 'always',
  threshold: null,
  weight: 1,
  active: true,
};

export function MotivationEditModal({ line, catalogue, onClose, onSaved }) {
  const { success, error } = useToast();
  const isNew = !line;

  const [form, setForm] = useState(() =>
    line
      ? {
          text: line.text,
          category: line.category,
          surfaces: [...line.surfaces],
          trigger: line.trigger,
          threshold: line.threshold,
          weight: line.weight,
          active: line.active,
        }
      : blank,
  );
  const [busy, setBusy] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const spec = catalogue.triggers.find((t) => t.key === form.trigger);
  const loginOnly = form.surfaces.length > 0 && form.surfaces.every((s) => s === 'login');

  /*
    The signed-out page is handed no signals, so a token there can never be
    filled and the picker would discard the line at selection time — it would
    sit in the list looking healthy and never once appear. Cheaper to say so.
  */
  const usedTokens = [...form.text.matchAll(/\{(\w+)\}/g)].map(([, t]) => t);
  const tokenWarning =
    loginOnly && usedTokens.length
      ? 'The sign-in page knows nothing about the reader, so this line would never be shown.'
      : '';

  const toggleSurface = (surface) =>
    set({
      surfaces: form.surfaces.includes(surface)
        ? form.surfaces.filter((s) => s !== surface)
        : [...form.surfaces, surface],
    });

  const valid = form.text.trim().length >= 4 && form.surfaces.length > 0 && !tokenWarning;

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        text: form.text.trim(),
        category: form.category,
        surfaces: form.surfaces,
        trigger: form.trigger,
        // Only meaningful when the trigger takes one; null otherwise, so
        // switching a line from "streak of 7" to "any time" clears the 7.
        threshold: spec?.threshold ? Number(form.threshold ?? spec.threshold.default) : null,
        weight: Number(form.weight),
        active: form.active,
      };

      if (isNew) await adminApi.createMotivation(body);
      else await adminApi.updateMotivation(line._id, body);

      success(isNew ? 'Line added' : 'Line saved');
      onSaved?.();
      onClose();
    } catch (err) {
      error(errorMessage(err, 'Could not save that line'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? 'New line' : 'Edit line'} onClose={onClose} size="lg">
      <div className="modal-body">
        <label className="field">
          <span>Text</span>
          <textarea
            rows={3}
            maxLength={240}
            value={form.text}
            disabled={busy}
            placeholder="Say something true about where they are."
            onChange={(e) => set({ text: e.target.value })}
          />
          <span className={`field-hint ${240 - form.text.length < 30 ? 'warn' : ''}`}>
            {240 - form.text.length} characters left · placeholders: {UNIVERSAL_TOKENS}
            {TOKEN_HELP[form.trigger] ? ` ${TOKEN_HELP[form.trigger]}` : ''}
          </span>
          {tokenWarning && <span className="field-hint warn">{tokenWarning}</span>}
        </label>

        <div className="field-row">
          <div className="field" style={{ flex: 2 }}>
            <span>Show when</span>
            <Dropdown
              ariaLabel="Show when"
              value={form.trigger}
              disabled={busy}
              onChange={(v) => {
                const next = catalogue.triggers.find((t) => t.key === v);
                set({ trigger: v, threshold: next?.threshold?.default ?? null });
              }}
              options={catalogue.triggers.map((t) => ({ value: t.key, label: t.label }))}
            />
            {spec?.hint && <span className="field-hint">{spec.hint}</span>}
          </div>

          {/* Only for conditions that take a number — the form is built from
              the catalogue, so a new trigger needs no change here. */}
          {spec?.threshold && (
            <label className="field" style={{ flex: 1 }}>
              <span>At least</span>
              <input
                type="number"
                min={spec.threshold.min}
                max={spec.threshold.max}
                value={form.threshold ?? spec.threshold.default}
                disabled={busy}
                onChange={(e) => set({ threshold: e.target.value === '' ? null : Number(e.target.value) })}
              />
              <span className="field-hint">{spec.threshold.unit || ''}</span>
            </label>
          )}
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
          {form.surfaces.length === 0 && (
            <span className="field-hint warn">Pick at least one, or it can never appear.</span>
          )}
        </div>

        <div className="field-row">
          <div className="field" style={{ flex: 1 }}>
            <span>Theme</span>
            <Dropdown
              ariaLabel="Theme"
              value={form.category}
              disabled={busy}
              onChange={(v) => set({ category: v })}
              options={catalogue.categories.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <label className="field" style={{ flex: 1 }}>
            <span>Weight</span>
            <input
              type="number"
              min={1}
              max={5}
              value={form.weight}
              disabled={busy}
              onChange={(e) => set({ weight: e.target.value })}
            />
            <span className="field-hint">How often, against lines with the same condition.</span>
          </label>
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={form.active}
            disabled={busy}
            onChange={(e) => set({ active: e.target.checked })}
          />
          <span>Active — uncheck to retire it without deleting it</span>
        </label>
      </div>

      <div className="modal-foot">
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn primary" onClick={save} disabled={!valid || busy}>
          {busy ? 'Saving...' : isNew ? 'Add line' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}
