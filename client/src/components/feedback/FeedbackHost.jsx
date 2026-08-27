import { useEffect } from 'react';
import { useAuth } from '../../store/AuthContext.jsx';
import { feedbackModal, useFeedbackModal } from '../../store/feedbackModal.js';
import { moduleVisible } from '../../store/modules.js';
import { FeedbackModal } from './FeedbackModal.jsx';

/**
 * The feedback dialog's one mount point.
 *
 * It used to own a bubble as well, in the corner beside the chat one. That
 * bubble is gone: two floating circles for two unrelated features is one too
 * many for a corner, and of the two, feedback is the one you go looking for
 * rather than the one you keep open while you work. Its doors are the account
 * menu, the sign-out dialog, and the page itself.
 *
 * What is left is deliberately not folded into AppShell. Subscribing to the
 * store is what re-renders on every open and close, and the shell — the
 * sidebar, the topbar, the whole routed tree — has no reason to be redrawn
 * because a dialog opened over it.
 */
export function FeedbackHost() {
  const { open } = useFeedbackModal();
  const { modules } = useAuth();

  /*
    The store lives at module scope, which is what lets three unrelated places
    open this — and it means the boolean outlives the component. The moment that
    matters is signing out: the shell unmounts and takes this with it, and
    without this the next person to sign in on the same machine arrives with the
    dialog already open over their roadmap.
  */
  useEffect(() => () => feedbackModal.close(), []);

  /*
    Hiding the module has to close the door as well as remove the sign on it.
    Every caller checks too, so this is belt and braces — but it is the check
    that cannot be forgotten by whoever adds the fourth caller.
  */
  if (!moduleVisible(modules, 'feedback')) return null;

  // Escape, the ✕ and the overlay are all Modal's — unlike the chat dock, this
  // one has nothing of its own to wire up.
  return open ? <FeedbackModal /> : null;
}
