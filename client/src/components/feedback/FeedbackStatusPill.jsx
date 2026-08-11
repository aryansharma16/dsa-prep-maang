import { STATUS_LABEL, STATUS_NOTE } from './vocab.js';

/**
 * One submission's status, wherever it appears.
 *
 * Shared by the learner surfaces and the admin table deliberately. The two
 * audiences see different columns around it, but if "Not planned" ever reads as
 * one thing in the queue and another on somebody's profile, the status has
 * stopped meaning anything — so there is one component and one set of words.
 *
 * The class is prefixed. `.open` and `.planned` are ordinary enough words that a
 * bare modifier on `.status-pill` would eventually collide with something in a
 * stylesheet this size.
 */
export function FeedbackStatusPill({ status }) {
  return (
    <span className={`status-pill fb-${status}`} title={STATUS_NOTE[status] || ''}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}
