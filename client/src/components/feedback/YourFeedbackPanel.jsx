import { Link } from 'react-router-dom';
import { useMyFeedback } from '../../hooks/useMyFeedback.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { moduleVisible } from '../../store/modules.js';
import { FeedbackList } from './FeedbackList.jsx';

/** Enough to see the last thing you said and whether anyone answered it. */
const SHOW = 3;

/**
 * The tail of your feedback, on your profile.
 *
 * Three rows and a link, not the whole list — this is a page about your progress,
 * and the panel is here so a reply does not sit unread behind a bubble you have
 * stopped noticing.
 */
export function YourFeedbackPanel() {
  const { modules } = useAuth();
  const { items, total, loading, error } = useMyFeedback({ limit: SHOW });

  if (!moduleVisible(modules, 'feedback')) return null;

  return (
    <div className="panel">
      {/* `heat-head`, not a bare `panel-head` — the latter is not a flex
          container, so a link inside one drops onto its own line under the
          heading. */}
      <div className="panel-head heat-head">
        <b>Your feedback</b>
        <Link className="link-btn" to="/feedback">
          All of it
        </Link>
      </div>
      <div className="panel-body">
        {/* A hint rather than an .alert: this is one card on a page about your
            progress, and a red box here reads as "your profile failed". */}
        {error && <p className="hint">Could not load your feedback just now.</p>}
        {loading && !items.length && !error && <p className="hint">Loading...</p>}

        {!loading && !error && items.length === 0 && (
          <p className="hint">
            Nothing sent yet — <Link to="/feedback">tell us something</Link>.
          </p>
        )}

        {items.length > 0 && <FeedbackList items={items} />}

        {total > items.length && (
          <p className="hint">
            Showing {items.length} of {total}.
          </p>
        )}
      </div>
    </div>
  );
}
