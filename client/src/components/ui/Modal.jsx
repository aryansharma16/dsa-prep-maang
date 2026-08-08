import { useEffect, useId, useRef } from 'react';
import { IconClose } from './Icons.jsx';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// The roadmap and the app shell both bind global single-key shortcuts. Without
// this, pressing "s" inside a dialog would also toggle a problem behind it.
let openCount = 0;
export const isAnyModalOpen = () => openCount > 0;

/**
 * Base dialog. Renders only when the caller mounts it, so usage is
 * `{open && <Modal ...>}`.
 *
 * Children are rendered raw below the header — wrap them in `.modal-body` and
 * `.modal-foot` yourself. That way a form can span both, which a fixed
 * body/footer contract would prevent.
 */
export function Modal({ title, onClose, children, size = 'md', initialFocus }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    openCount += 1;
    const restoreTo = document.activeElement;
    const node = dialogRef.current;

    const focusables = () => [...node.querySelectorAll(FOCUSABLE)];
    (initialFocus?.current || focusables()[0] || node).focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // Keep Tab inside the dialog.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Capture phase so the dialog sees Escape before any page-level handler.
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      openCount -= 1;
      restoreTo?.focus?.();
    };
  }, [onClose, initialFocus]);

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
