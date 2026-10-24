import { useEffect, useRef } from 'react';

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
  /*
    Callers pass `onClose` inline, so it is a new function on every render. If
    it were an effect dependency, every parent re-render (an autosave landing,
    say) would tear the dialog down and set it up again — and setup moves focus
    to `initialFocus`, yanking the caret out of whatever field you were typing
    in. So the effect runs once per open and reads the latest values from refs.
  */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const initialFocusRef = useRef(initialFocus);
  initialFocusRef.current = initialFocus;

  useEffect(() => {
    // Dialogs can stack (a confirm over a panel). All their capture listeners see every key, and
    // stopPropagation cannot stop listeners on the same node — so each checks it is the top one.
    const token = {};
    stack.push(token);
    const restoreTo = document.activeElement;
    const node = ref.current;

    const focusables = () => [...node.querySelectorAll(FOCUSABLE)];
    (initialFocusRef.current?.current || focusables()[0] || node).focus();

    const onKey = (event) => {
      if (stack.at(-1) !== token) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        // Blur first, so a field that saves on blur gets to save before it unmounts.
        if (node.contains(document.activeElement)) document.activeElement.blur?.();
        onCloseRef.current?.();
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
  }, [ref]);
}
