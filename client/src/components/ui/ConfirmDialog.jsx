import { useRef } from 'react';
import { Modal } from './Modal.jsx';

/**
 * Confirmation built on Modal. Cancel is focused first so that Enter and Escape
 * both take the safe path — you have to deliberately reach the action.
 *
 *   {leaving && (
 *     <ConfirmDialog
 *       title="Sign out?"
 *       message="..."
 *       confirmLabel="Sign out"
 *       tone="danger"
 *       onConfirm={logout}
 *       onCancel={() => setLeaving(false)}
 *     />
 *   )}
 */
export function ConfirmDialog({
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel} size="sm" initialFocus={cancelRef}>
      <div className="modal-body">
        <p className="confirm-message">{message}</p>
        {detail && <p className="hint">{detail}</p>}
      </div>

      <div className="modal-foot">
        <button
          type="button"
          className="btn ghost"
          ref={cancelRef}
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${tone === 'danger' ? 'danger' : 'primary'}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
