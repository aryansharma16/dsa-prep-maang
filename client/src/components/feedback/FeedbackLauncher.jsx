import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext.jsx';
import { feedbackModal, useFeedbackModal } from '../../store/feedbackModal.js';
import { moduleVisible } from '../../store/modules.js';
import { IconClose, IconMegaphone } from '../ui/Icons.jsx';
import { FeedbackModal } from './FeedbackModal.jsx';

/**
 * The bubble, and the dialog it opens.
 *
 * Mounted once in the shell, so it is on every signed-in page and none of the
 * signed-out ones — the same arrangement ChatLauncher has, and it sits beside it
 * in the corner rather than under it.
 */
export function FeedbackLauncher() {
  const { open } = useFeedbackModal();
  const { modules } = useAuth();
  const { pathname } = useLocation();

  /*
    The store lives at module scope, which is what lets three unrelated places
    open this — and it means the boolean outlives the component. The moment that
    matters is signing out: the shell unmounts and takes the bubble with it, and
    without this the next person to sign in on the same machine arrives with the
    popup already open over their roadmap.
  */
  useEffect(() => () => feedbackModal.close(), []);

  /*
    The bubble floats over every page, so it is the part of this feature that
    outlives its own nav item — hiding the module has to take it too, or the side
    menu loses a link and the app keeps a button that opens the whole thing
    anyway. The form behind it would post into a 404 regardless.
  */
  if (!moduleVisible(modules, 'feedback')) return null;

  /*
    The bubble hides on the page that is this feature — a shortcut to where you
    already are is clutter, and that page has the same form on it.

    The *dialog* is not hidden with it. This component owns the only mount point
    for it, and other things open it: the topbar button, and the sign-out dialog.
    Returning null for the whole component on /feedback left those opening a
    dialog that was never rendered — a button that does nothing at all, on one
    route only.
  */
  const showBubble = pathname !== '/feedback';

  return (
    <>
      {showBubble && (
        <button
          type="button"
          className={`fb-launcher ${open ? 'on' : ''}`}
          onClick={() => (open ? feedbackModal.close() : feedbackModal.open('send'))}
          aria-expanded={open}
          aria-label="Send feedback"
          title="Send feedback"
        >
          {open ? <IconClose size={17} /> : <IconMegaphone size={18} />}
        </button>
      )}

      {/* Escape, the ✕ and the overlay are all Modal's — unlike the chat dock,
          this one has nothing of its own to wire up. */}
      {open && <FeedbackModal />}
    </>
  );
}
