import { useEffect } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The roadmap and the app shell both bind global single-key shortcuts. Without
 * this, pressing "s" inside a dialog would also toggle a problem behind it, and
 * "o" would open LeetCode in a new tab while you were reading something else.
 *
 * Every overlay in the app has to go through this hook for that to hold — a
 * panel that renders its own markup without registering here stays invisible to
 * the guard.
 */
const stack = [];
export const isAnyModalOpen = () => stack.length > 0;

/**
 * Shared modal behaviour: shortcut suppression, Escape, a Tab loop that keeps
 * focus inside, and returning focus where it came from on close.
 *
 * `ref` is the element that owns the focus trap — the dialog or drawer panel.
 */
export function useDialog(ref, { onClose, initialFocus } = {}) {
  useEffect(() => {
    // Dialogs can stack (a confirm over a panel). All their capture listeners see every key, and
    // stopPropagation cannot stop listeners on the same node — so each checks it is the top one.
    const token = {};
    stack.push(token);
    const restoreTo = document.activeElement;
    const node = ref.current;

    const focusables = () => [...node.querySelectorAll(FOCUSABLE)];
    (initialFocus?.current || focusables()[0] || node).focus();

    const onKey = (event) => {
      if (stack.at(-1) !== token) return;
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
      stack.splice(stack.indexOf(token), 1);
      restoreTo?.focus?.();
    };
  }, [ref, onClose, initialFocus]);
}
