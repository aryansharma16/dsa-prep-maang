import { useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { authApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { feedbackModal } from '../../store/feedbackModal.js';
import { moduleVisible } from '../../store/modules.js';
import { useToast } from '../../store/ToastContext.jsx';
import { IconMegaphone } from '../ui/Icons.jsx';
import { Modal } from '../ui/Modal.jsx';
import { StarRating } from '../ui/StarRating.jsx';

/**
 * Sign out, and the one moment worth asking how it is going.
 *
 * Leaving is when somebody has just finished using the thing and has an opinion
 * they will not have again in an hour, so this is where the question is cheapest
 * to ask and most likely to be answered honestly.
 *
 * It stays a confirmation dialog first. The stars are optional, the feedback
 * button is optional, and neither blocks the button people opened this to press
 * — an exit survey you have to dismiss to leave is how you teach people to stop
 * reading dialogs.
 *
 * Not built on ConfirmDialog: this needs a third action and a control in the
 * body, and bolting both onto the shared component would complicate every other
 * confirmation in the app to serve this one.
 */
export function SignOutDialog({ onCancel }) {
  const { user, logout, modules, applyUser } = useAuth();
  const { error } = useToast();

  const [stars, setStars] = useState(user?.rating?.stars || 0);
  const [busy, setBusy] = useState(false);

  const rated = Boolean(user?.rating?.stars);

  const rate = async (next) => {
    // Optimistic: the star fills under the cursor and stays filled. A rating
    // that waits for a round trip to light up feels like it did not register,
    // and people click it a second time.
    setStars(next);
    try {
      applyUser(await authApi.rate(next));
    } catch (err) {
      setStars(user?.rating?.stars || 0);
      error(errorMessage(err, 'Could not save that rating'));
    }
  };

  const signOut = async () => {
    setBusy(true);
    await logout();
  };

  const openFeedback = () => {
    onCancel();
    feedbackModal.open('send');
  };

  // `md`, not the `sm` a bare confirmation would take: at 390px the account
  // email wraps mid-address and the star row sits tight against the edge.
  return (
    <Modal title="Sign out?" onClose={onCancel} size="md">
      <div className="modal-body">
        <p>
          You'll be signed out of <b>{user?.email}</b>.
        </p>
        <p className="hint">
          Your progress is saved to your account — signing back in picks up exactly where you
          left off.
        </p>

        <div className="signout-ask">
          <span className="signout-ask-q">
            {rated ? 'You rated this' : 'Before you go — how is this working out?'}
          </span>

          <StarRating value={stars} onChange={rate} size={19} />

          {moduleVisible(modules, 'feedback') && (
            <>
              <p className="hint">
                {stars > 0 && stars <= 3
                  ? 'Something specific behind that? Tell us and it gets read.'
                  : 'Anything you would change, or anything broken?'}
              </p>
              <button type="button" className="btn warn" onClick={openFeedback}>
                <IconMegaphone size={13} />
                Send feedback
              </button>
            </>
          )}
        </div>
      </div>

      <div className="modal-foot">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn danger" onClick={signOut} disabled={busy}>
          {busy ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </Modal>
  );
}
