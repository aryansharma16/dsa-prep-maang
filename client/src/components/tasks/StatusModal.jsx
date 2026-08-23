import { useRef, useState } from 'react';
import { STATUS_HUES } from './hues.js';
import { Dropdown } from '../ui/Dropdown.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * Add or edit one column. One component for both, so a field added to one
 * cannot go missing from the other — the argument the add/edit problem dialog
 * already makes.
 */

const KINDS = [
  {
    value: 'open',
    label: 'Not started',
    note: 'Work that is waiting. Most columns are this.',
  },
  {
    value: 'active',
    label: 'In progress',
    note: 'Where work you have started lives.',
  },
  {
    value: 'done',
    label: 'Finished',
    note: 'Dropping a card here completes it and stops its timer. Only one column can be this.',
  },
];

export function StatusModal({ status, hasDone, onSave, onClose }) {
  const editing = Boolean(status);
  const nameRef = useRef(null);

  const [name, setName] = useState(status?.name || '');
  const [hue, setHue] = useState(status?.hue || 'slate');
  const [kind, setKind] = useState(status?.kind || 'open');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /*
    The done kind is offered only when it is available — this column already has
    it, or nothing does. Letting it be picked and then refused by the server
    would be a round trip to learn something the client already knows.
  */
  const kinds = KINDS.filter(
    (entry) => entry.value !== 'done' || !hasDone || status?.kind === 'done',
  );

  const submit = async (event) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;

    setBusy(true);
    setError('');
    try {
      await onSave({ name: value, hue, kind });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit column' : 'New column'} onClose={onClose} initialFocus={nameRef}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Name</span>
            <input
              ref={nameRef}
              value={name}
              maxLength={40}
              placeholder="In review"
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Means</span>
            <Dropdown ariaLabel="What this column means" value={kind} options={kinds} onChange={setKind} />
          </label>

          <div className="field">
            <span>Colour</span>
            <div className="tk-hues" role="radiogroup" aria-label="Column colour">
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

          {error && <div className="alert">{error}</div>}
        </div>

        <div className="modal-foot">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!name.trim() || busy}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Add column'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
