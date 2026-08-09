import { useRef, useState } from 'react';
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
  confirmText,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const [typed, setTyped] = useState('');

  /*
    `confirmText` is for the handful of actions that cannot be undone. Typing
    the name out is not friction for its own sake — it is the only thing that
    reliably separates "I meant this account" from "I clicked the wrong row".
    Compared case-insensitively because emails are stored lowercased.
  */
  const locked = Boolean(confirmText) && typed.trim().toLowerCase() !== confirmText.toLowerCase();

  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel} size="sm" initialFocus={cancelRef}>
      <div className="modal-body">
        <p className="confirm-message">{message}</p>
        {detail && <p className="hint">{detail}</p>}

        {confirmText && (
          <label className="field" style={{ marginTop: 12, marginBottom: 0 }}>
            <span>
              Type <b>{confirmText}</b> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
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
          disabled={busy || locked}
        >
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
