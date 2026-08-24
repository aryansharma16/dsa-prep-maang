import { Link } from 'react-router-dom';
import { IconCheck } from '../ui/Icons.jsx';

/**
 * One topic in a track's index.
 *
 * Prefetches its own body on hover. The chunk is a few kilobytes and the
 * pointer sits on a card for a beat before the click lands, so by the time the
 * route changes the import has usually already resolved and the topic renders
 * without a skeleton. Failure is ignored on purpose — this is a guess about
 * what you are about to do, and a wrong guess must cost nothing.
 */
export function TopicCard({ trackSlug, topic, read = false }) {
  return (
    <Link
      className={`topic-card ${read ? 'read' : ''}`}
      to={`/learn/${trackSlug}/${topic.slug}`}
      onMouseEnter={() => topic.load?.().catch(() => {})}
      onFocus={() => topic.load?.().catch(() => {})}
    >
      <span className="topic-card-head">
        <span className="topic-card-title">{topic.title}</span>
        {/* Present but invisible until read, so a row of cards does not reflow
            the moment one of them is ticked. */}
        <span className="topic-card-tick" aria-hidden={!read}>
          <IconCheck size={11} />
        </span>
      </span>
      <span className="topic-card-summary">{topic.summary}</span>
      {topic.tags?.length > 0 && (
        <span className="topic-card-tags">
          {topic.tags.map((tag) => (
            <span className="topic-tag" key={tag}>
              {tag}
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}
