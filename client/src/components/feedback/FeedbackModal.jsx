import { useMyFeedback } from '../../hooks/useMyFeedback.js';
import { feedbackModal, useFeedbackModal } from '../../store/feedbackModal.js';
import { Modal } from '../ui/Modal.jsx';
import { FeedbackForm } from './FeedbackForm.jsx';
import { FeedbackList } from './FeedbackList.jsx';

/**
 * Send something, or see what happened to what you already sent.
 *
 * A Modal rather than a dock like the chat panel, and the difference is not
 * cosmetic. A dock stays open over a page you are still reading, which is the
 * whole reason chat is one — and it costs that component a copy of the keyboard
 * scoping the rest of the app gets from Modal for free. Nobody fills in a
 * feedback form against the roadmap; it is twenty seconds of typing, so it takes
 * the screen, and Escape, the focus trap and the shortcut suppression come with
 * it.
 */
export function FeedbackModal() {
  const { tab } = useFeedbackModal();
  const { items, total, loading, error, remaining, openLimit, reload } = useMyFeedback({
    limit: 20,
  });

  const close = () => feedbackModal.close();

  return (
    <Modal title="Feedback" onClose={close} size="md">
      <div className="fb-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'send'}
          className={tab === 'send' ? 'on' : ''}
          onClick={() => feedbackModal.setTab('send')}
        >
          Send
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={tab === 'mine' ? 'on' : ''}
          onClick={() => feedbackModal.setTab('mine')}
        >
          Yours{total > 0 && <span className="tag-mini">{total}</span>}
        </button>
      </div>

      {tab === 'send' ? (
        <FeedbackForm
          variant="modal"
          /*
            Straight to Yours, and refetch rather than pushing the returned row
            onto the list by hand. The server decides the status, and a list that
            invented one would be wrong the first time somebody changed how a
            submission starts.
          */
          onSent={() => {
            feedbackModal.setTab('mine');
            reload();
          }}
        />
      ) : (
        <div className="modal-body">
          {error && <div className="alert">{error}</div>}
          {loading && !items.length && <div className="loading">Loading...</div>}

          {!loading && !error && items.length === 0 && (
            <div className="empty">
              <h3>Nothing yet</h3>
              <p>Anything you send shows up here, with what happened to it.</p>
            </div>
          )}

          {items.length > 0 && <FeedbackList items={items} />}

          {remaining === 0 && openLimit != null && (
            <p className="hint">
              You have {openLimit} submissions waiting for a reply, which is the limit. Answering
              one frees a slot.
            </p>
          )}
          {total > items.length && (
            <p className="hint">
              Showing {items.length} of {total}.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
