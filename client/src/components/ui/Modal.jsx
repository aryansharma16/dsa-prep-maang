import { useId, useRef } from 'react';
import { IconClose } from './Icons.jsx';
import { useDialog } from './useDialog.js';

// Re-exported so the two global key handlers keep importing it from here.
export { isAnyModalOpen } from './useDialog.js';

/**
 * Base dialog. Renders only when the caller mounts it, so usage is
 * `{open && <Modal ...>}`.
 *
 * Children are rendered raw below the header — wrap them in `.modal-body` and
 * `.modal-foot` yourself. That way a form can span both, which a fixed
 * body/footer contract would prevent.
 *
 * Focus trapping, Escape and shortcut suppression live in useDialog, shared
 * with the guide reader.
 */
export function Modal({ title, onClose, children, size = 'md', initialFocus }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useDialog(dialogRef, { onClose, initialFocus });

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal ${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="icon-btn"
            style={{ marginLeft: 'auto' }}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <IconClose size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
