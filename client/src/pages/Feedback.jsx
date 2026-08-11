import { FeedbackForm } from '../components/feedback/FeedbackForm.jsx';
import { FeedbackList } from '../components/feedback/FeedbackList.jsx';
import { useMyFeedback } from '../hooks/useMyFeedback.js';

/**
 * The whole feature on one page, for people who would rather not work in a
 * dialog.
 *
 * Same form and same list as the popup — the two are one pair of components with
 * different chrome, so there is no version of this page that can drift from what
 * the bubble does.
 */
export function Feedback() {
  const { items, total, loading, error, remaining, openLimit, reload } = useMyFeedback({
    limit: 50,
  });

  return (
    <>
      <div className="page-head">
        <h1>Feedback</h1>
        <p>
          Tell us what is broken, what is missing, or what gets in your way. Everything sent here
          reaches the people building this, and you can see what happened to it.
        </p>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">Send something</div>
          <div className="panel-body">
            {remaining === 0 && openLimit != null ? (
              <p className="hint">
                You have {openLimit} submissions still waiting for a reply, which is as many as
                one account can have open. Answering one frees a slot.
              </p>
            ) : (
              <FeedbackForm variant="page" onSent={reload} />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Yours</div>
          <div className="panel-body">
            {error && <div className="alert">{error}</div>}
            {loading && !items.length && <div className="loading">Loading your feedback...</div>}

            {!loading && !error && items.length === 0 && (
              <p className="hint">Nothing sent yet. The form beside this is the whole of it.</p>
            )}

            {items.length > 0 && <FeedbackList items={items} />}

            {total > items.length && (
              <p className="hint">
                Showing {items.length} of {total}.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
