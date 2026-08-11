import { FeedbackStatusPill } from './FeedbackStatusPill.jsx';
import { TYPE_LABEL } from './vocab.js';

const when = (value) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const exact = (value) => (value ? new Date(value).toLocaleString() : '');

function FeedbackItem({ item }) {
  return (
    <li className="fb-item">
      <div className="fb-item-head">
        <b>{item.title}</b>
        <FeedbackStatusPill status={item.status} />
      </div>

      {/* pre-wrap because people press Enter, and a bug report written as three
          steps should not arrive as one paragraph. */}
      <p className="fb-item-msg">{item.message}</p>

      <div className="fb-meta">
        <span className="tag-mini">{TYPE_LABEL[item.type] || item.type}</span>
        <time dateTime={item.createdAt} title={exact(item.createdAt)}>
          {when(item.createdAt)}
        </time>
        {item.path && <span className="mono">{item.path}</span>}
      </div>

      {item.response && (
        <div className="fb-reply">
          <div className="fb-reply-label">
            {item.response.by} replied
            {item.response.at && (
              <time dateTime={item.response.at} title={exact(item.response.at)}>
                {when(item.response.at)}
              </time>
            )}
          </div>
          <p>{item.response.text}</p>
        </div>
      )}
    </li>
  );
}

/**
 * Submissions as cards, for the three learner surfaces that list them.
 *
 * Presentation only — it fetches nothing and holds no state, so the popup, the
 * page and the profile panel can each decide how many rows they want and where
 * the data came from.
 *
 * The admin queue deliberately does not use this. It is a table with different
 * columns for a different audience, and a component with a prop that switched it
 * between `<li>` and `<tr>` would be two components sharing a name.
 */
export function FeedbackList({ items }) {
  return (
    <ul className="fb-list">
      {items.map((item) => (
        <FeedbackItem key={item._id} item={item} />
      ))}
    </ul>
  );
}
