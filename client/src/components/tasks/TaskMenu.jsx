import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconEdit, IconTrash } from '../ui/Icons.jsx';

/**
 * The card's overflow menu.
 *
 * It exists so that dragging is a shortcut and not the only way to move a card.
 * A touchscreen has no hover, a keyboard has no drag, and the board has to work
 * on both — the same argument the column layout editor makes by putting up and
 * down buttons next to its grip.
 *
 * A plain popover rather than `Dropdown`: that component is a listbox bound to
 * a value, and this is a list of actions of which "move to" is only one.
 *
 * **Portalled**, for the reason Dropdown documents and this one learned the
 * hard way: `.tk-col-body` scrolls, so an absolutely positioned menu is clipped
 * by it. On the last card of a column that put half the menu — including
 * Delete — outside the column's box and out of reach.
 */

const WIDTH = 176;
const GUTTER = 8;
/** Enough for the whole menu; below this it opens upward instead. */
const MIN_ROOM = 260;

export function TaskMenu({ anchorRef, task, statuses, onMove, onOpen, onDelete, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < MIN_ROOM && r.top > below;

    setPos({
      // Right-aligned to the trigger, then pulled back inside the window.
      left: Math.max(GUTTER, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - GUTTER)),
      top: up ? undefined : r.bottom + 5,
      bottom: up ? window.innerHeight - r.top + 5 : undefined,
      maxHeight: Math.max(160, (up ? r.top : below) - 16),
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    place();
    // Capture phase: the scroll that moves this is the column's, not the
    // window's, and a bubbling listener never hears it.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [place]);

  useEffect(() => {
    const onDown = (event) => {
      if (ref.current?.contains(event.target) || anchorRef.current?.contains(event.target)) return;
      onClose();
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      // The drawer and any dialog behind this must not also close.
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  const act = (fn) => (event) => {
    event.stopPropagation();
    fn();
    onClose();
  };

  if (!pos) return null;

  return createPortal(
    <div
      className="tk-menu"
      ref={ref}
      role="menu"
      style={pos}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" role="menuitem" className="tk-menu-item" onClick={act(onOpen)}>
        <IconEdit size={12} />
        Open
      </button>

      <div className="tk-menu-label">Move to</div>
      {statuses.map((status) => {
        const here = String(status.id) === String(task.status);
        return (
          <button
            key={status.id}
            type="button"
            role="menuitem"
            className={`tk-menu-item ${here ? 'on' : ''}`}
            data-hue={status.hue}
            disabled={here}
            onClick={act(() => onMove(status.id))}
          >
            <i className="tk-dot" />
            {status.name}
            {here && <IconCheck size={11} />}
          </button>
        );
      })}

      <button type="button" role="menuitem" className="tk-menu-item danger" onClick={act(onDelete)}>
        <IconTrash size={12} />
        Delete
      </button>
    </div>,
    document.body,
  );
}
