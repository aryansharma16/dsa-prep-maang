import { useEffect } from 'react';
import { isAnyModalOpen } from '../components/ui/Modal.jsx';

/**
 * `/` focuses a page's search box; Escape leaves it.
 *
 * This used to live in `AppShell`, bound to the one box in the top bar. That
 * box is gone — every page owns its own now — so the shortcut moved with it,
 * and moving it *into* the box is what makes it correct rather than merely
 * relocated: whichever search is mounted is the one `/` reaches, and a page
 * with no search box simply has no handler bound.
 *
 * Escape blurs rather than clearing. Clearing is what the box's own clear
 * button is for, and an Escape that silently threw away a long query would be a
 * keystroke people learn not to press.
 */
export function useSearchHotkey(ref) {
  useEffect(() => {
    const onKey = (event) => {
      /* A dialog is open — the key belongs to it, not to the page behind it. */
      if (isAnyModalOpen()) return;

      const el = ref.current;
      if (!el) return;

      if (event.key === 'Escape' && document.activeElement === el) {
        el.blur();
        return;
      }

      /* Typing a slash into any field must produce a slash. */
      const typing =
        /^(INPUT|TEXTAREA)$/.test(event.target.tagName) || event.target.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        el.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ref]);
}
