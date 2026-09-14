import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A menu of verbs — the "…" menu on a project card, a right-click on a tree
 * row or on the canvas.
 *
 * The same contract as layout/AccountMenu.jsx (arrow keys walk the items,
 * Escape closes and hands focus back, a click outside closes), but portalled
 * and fixed so it can open from inside a scrolling explorer or over a canvas
 * without being clipped, and positioned from either an element or a point.
 *
 *   <ActionMenu anchor={{ x, y }} items={[{ label, icon, onSelect, danger, disabled, shortcut }, 'sep']} onClose={…} />
 */
let openMenus = 0;

export function ActionMenu({ anchor, items, onClose, label = 'Actions', returnFocus }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const rect =
      anchor instanceof Element
        ? anchor.getBoundingClientRect()
        : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
    const gutter = 8;
    let left = anchor instanceof Element ? rect.right - width : rect.left;
    let top = rect.bottom + (anchor instanceof Element ? 4 : 0);
    if (left + width > window.innerWidth - gutter) left = window.innerWidth - width - gutter;
    if (top + height > window.innerHeight - gutter) {
      top = anchor instanceof Element ? rect.top - height - 4 : window.innerHeight - height - gutter;
    }
    setPos({ left: Math.max(gutter, left), top: Math.max(gutter, top) });
  }, [anchor]);

  useEffect(() => {
    ref.current?.querySelector('.sd-menu-item:not(:disabled)')?.focus();
    // The canvas leaves keys alone while any menu is open (editor.js).
    openMenus += 1;
    document.documentElement.classList.add('sd-menu-open');

    const onDown = (event) => {
      // A press on the button that opened the menu is left to that button, which toggles it shut.
      if (anchor instanceof Element && anchor.contains(event.target)) return;
      if (ref.current && !ref.current.contains(event.target)) onClose();
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      returnFocus?.focus?.();
    };
    // Capture, so a pointerdown the canvas would otherwise swallow still closes the menu.
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
      openMenus -= 1;
      if (!openMenus) document.documentElement.classList.remove('sd-menu-open');
    };
  }, [onClose, returnFocus, anchor]);

  const onKeyDown = (event) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const list = [...ref.current.querySelectorAll('.sd-menu-item:not(:disabled)')];
    const at = list.indexOf(document.activeElement);
    list[(at + step + list.length) % list.length]?.focus();
  };

  return createPortal(
    <div
      ref={ref}
      className="sd-menu"
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      {items.filter(Boolean).map((item, index) =>
        item === 'sep' ? (
          // eslint-disable-next-line react/no-array-index-key -- separators have no identity
          <div key={`sep-${index}`} className="sd-menu-sep" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`sd-menu-item ${item.danger ? 'danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            <span className="sd-menu-icon">{item.icon}</span>
            <span className="sd-menu-label">{item.label}</span>
            {item.shortcut && <kbd className="sd-menu-kbd">{item.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
