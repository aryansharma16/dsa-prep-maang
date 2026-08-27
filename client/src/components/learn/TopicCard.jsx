import { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { IconCheck } from '../ui/Icons.jsx';

/*
  How long the pointer has to stay on a card before it counts as interest.

  Firing on `mouseenter` itself is what the Node track exposed: 68 cards in a
  grid, and reaching the one at the bottom drags the pointer across a dozen on
  the way, each of which fetched its own chunk. In development, where every
  module is its own request, that is a stall you can watch happen. A short rest
  separates "on the way past" from "about to click", and 120ms is short enough
  that the import still lands before the click does.
*/
const REST = 120;

/**
 * One topic in a track's index.
 *
 * Prefetches its own body once the pointer has settled on it. The chunk is a
 * few kilobytes and a card is hovered for a beat before the click lands, so by
 * the time the route changes the import has usually already resolved and the
 * topic renders without a skeleton. Failure is ignored on purpose — this is a
 * guess about what you are about to do, and a wrong guess must cost nothing.
 */
export function TopicCard({ trackSlug, topic, read = false }) {
  const timer = useRef(0);

  const prefetch = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => topic.load?.().catch(() => {}), REST);
  }, [topic]);

  const cancel = useCallback(() => clearTimeout(timer.current), []);

  // A card unmounted mid-wait — the filter box narrowed the list — must not
  // leave a timer holding a reference to it.
  useEffect(() => cancel, [cancel]);

  return (
    <Link
      className={`topic-card ${read ? 'read' : ''}`}
      to={`/learn/${trackSlug}/${topic.slug}`}
      onMouseEnter={prefetch}
      onMouseLeave={cancel}
      onFocus={prefetch}
      onBlur={cancel}
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
