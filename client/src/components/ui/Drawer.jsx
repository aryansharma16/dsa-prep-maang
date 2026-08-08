import { useId, useRef } from 'react';
import { IconClose } from './Icons.jsx';
import { useDialog } from './useDialog.js';

/**
 * A dialog anchored to the right edge instead of the middle of the screen.
 *
 * Separate from Modal rather than a Modal size, because `.overlay` hard-centres
 * its child — a right-anchored panel needs its own overlay. The behaviour that
 * matters (focus trap, Escape, suppressing the page's single-key shortcuts)
 * comes from the same hook, so a drawer can never drift from a dialog on the
 * things that are easy to get wrong.
 *
 * Long content is expected, so the panel scrolls its body while the header
 * stays put.
 */
export function Drawer({ title, subtitle, onClose, children, initialFocus }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useDialog(panelRef, { onClose, initialFocus });

  return (
    <div
      className="drawer-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="drawer-head">
          <div className="drawer-title">
            <h3 id={titleId}>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </header>

        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}
