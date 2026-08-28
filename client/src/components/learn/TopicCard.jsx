import { memo } from 'react';
import { Link } from 'react-router-dom';
import { IconCheck } from '../ui/Icons.jsx';

/**
 * One topic in a track's index.
 *
 * ---------------------------------------------------------------------------
 * It used to prefetch its own body on hover, and deliberately does not now.
 *
 * The rule this page follows is that **a request means you opened something**.
 * A hover is a guess, and a guess is indistinguishable from a mistake when you
 * are looking at a network panel trying to work out what the app is doing —
 * which is the state anybody debugging this is in. The old version waited 120ms
 * for the pointer to settle before firing, so a sweep down the grid cost
 * nothing; but resting on four cards while deciding still fetched four topics
 * you never opened, and that is exactly what it looked like.
 *
 * What it costs is one round trip on the click instead of zero — a few
 * kilobytes, gzipped, against an ETag. The body is cached for the session once
 * it arrives, so going back to a topic is still free.
 * ---------------------------------------------------------------------------
 *
 * Memoised, and the reason is the filter box above it. Typing into that
 * re-renders the track page on every keystroke, and the Node track is 68 of
 * these — none of which has changed, because the topic objects are the ones
 * `JSON.parse` produced when the catalogue was shaped and nothing maps over them
 * per render, and `read` only moves when a topic is actually marked. The props
 * are three primitives and one stable object, so the comparison is nearly free
 * and it takes 68 re-renders per keystroke down to however many actually
 * appeared or disappeared.
 */
export const TopicCard = memo(function TopicCard({ trackSlug, topic, read = false }) {
  return (
    <Link className={`topic-card ${read ? 'read' : ''}`} to={`/learn/${trackSlug}/${topic.slug}`}>
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
});
