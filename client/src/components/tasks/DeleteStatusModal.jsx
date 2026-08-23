import { useState } from 'react';
import { Dropdown } from '../ui/Dropdown.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * Deleting a column that still holds tasks.
 *
 * A `ConfirmDialog` cannot do this, because the question is not yes or no — it
 * is "where do these six go". Deleting the tasks along with the column would
 * make a mistyped column name unrecoverable, and moving them somewhere the
 * caller did not pick is the sort of guess that is only ever noticed too late.
 *
 * An empty column skips all of this and just goes.
 */
export function DeleteStatusModal({ status, count, statuses, onConfirm, onClose }) {
  const others = statuses.filter((entry) => String(entry.id) !== String(status.id));
  const [moveTo, setMoveTo] = useState(others[0]?.id ? String(others[0].id) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(moveTo);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Delete “${status.name}”`} size="sm" onClose={onClose}>
      <div className="modal-body">
        <p>
          {count === 1 ? 'One task is' : `${count} tasks are`} in this column. Deleting it does not
          delete them — pick where they go.
        </p>

        <label className="field">
          <span>Move them to</span>
          <Dropdown
            ariaLabel="Destination column"
            value={moveTo}
            options={others.map((entry) => ({ value: String(entry.id), label: entry.name }))}
            onChange={setMoveTo}
          />
        </label>

        {error && <div className="alert">{error}</div>}
      </div>

      <div className="modal-foot">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn danger" disabled={!moveTo || busy} onClick={confirm}>
          {busy ? 'Deleting…' : 'Move and delete'}
        </button>
      </div>
    </Modal>
  );
}
