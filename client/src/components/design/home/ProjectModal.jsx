import { useRef, useState } from 'react';
import { EmojiPicker } from '../../ui/EmojiPicker.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { STATUS_HUES } from '../../tasks/hues.js';

/**
 * Create a project, or edit one's name, icon, colour and description.
 *
 * The starter-folders box is on by default for a new project, because the
 * empty tree is the hardest place to start from and the shape it gives — a
 * folder per layer — is the one this module is built around. It is one untick
 * away for the person who knows what they want.
 *
 * `initialName` is what the home page's "or start from WhatsApp" buttons fill
 * in: the field is still empty of a decision, so it stays editable and focused
 * rather than skipping the dialog altogether.
 */
export function ProjectModal({ project, initialName = '', onSubmit, onClose }) {
  const editing = Boolean(project);
  const [name, setName] = useState(project?.name || initialName);
  const [description, setDescription] = useState(project?.description || '');
  const [icon, setIcon] = useState(project?.icon || '');
  const [hue, setHue] = useState(project?.hue || 'violet');
  const [starter, setStarter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the project a name');
      nameRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        name: trimmed,
        description: description.trim(),
        icon,
        hue,
        ...(editing ? {} : { template: starter ? 'system' : 'blank' }),
      });
    } catch (err) {
      setError(err?.response?.data?.error?.message || err.message || 'Could not save the project');
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit project' : 'New project'} onClose={busy ? () => {} : onClose} size="sm" initialFocus={nameRef}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="sd-pm-name">
            <EmojiPicker value={icon} onChange={setIcon} className="sd-pm-emoji" title="Project icon" />
            <label className="field" style={{ flex: 1, marginBottom: 0 }}>
              <span>Name</span>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="e.g. WhatsApp, URL shortener"
                autoComplete="off"
              />
            </label>
          </div>

          <label className="field sd-pm-field">
            <span>
              Description <small>optional</small>
            </span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={160}
              placeholder="One line — what this system is"
              autoComplete="off"
            />
          </label>

          <div className="field">
            <span>Colour</span>
            <div className="tk-hues" role="radiogroup" aria-label="Project colour">
              {STATUS_HUES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={hue === option}
                  aria-label={option}
                  title={option}
                  data-hue={option}
                  className={`tk-hue ${hue === option ? 'on' : ''}`}
                  onClick={() => setHue(option)}
                />
              ))}
            </div>
          </div>

          {!editing && (
            <label className="sd-pm-starter">
              <input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} />
              <span>
                <b>Start with HLD, LLD and Database folders</b>
                <small>Each with one board: two canvases and a schema.</small>
              </span>
            </label>
          )}

          {error && <div className="alert">{error}</div>}
        </div>
        <div className="modal-foot">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
