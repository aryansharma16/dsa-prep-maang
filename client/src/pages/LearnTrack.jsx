import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TopicCard } from '../components/learn/TopicCard.jsx';
import { IconArrowLeft, IconSearch } from '../components/ui/Icons.jsx';
import { useLearnDoc } from '../hooks/useLearnDoc.js';
import { topicKey, useReadTopics } from '../learn/progress.js';
import { findTrack, flatTopics } from '../learn/tracks.js';

/**
 * A track's table of contents.
 *
 * The filter is client-side and deliberately dumb — every title, summary and tag
 * in the track is already in memory the moment the index chunk lands, so there
 * is nothing to fetch and no reason to debounce. It matches tags as well as
 * prose because "hook" and "performance" are how you look for something whose
 * name you have forgotten, which is the whole reason this page exists.
 */
export function LearnTrack() {
  const { track: trackSlug } = useParams();
  const track = findTrack(trackSlug);

  // A `soon` track has no index to import, so the loader stays idle for it and
  // the empty state below is what renders.
  const { data, loading, error } = useLearnDoc(
    track?.status === 'live' ? trackSlug : null,
    track?.load,
  );

  const [query, setQuery] = useState('');
  const { read, countRead, clearTrack } = useReadTopics();

  const allSections = data?.sections || [];
  const allTopics = useMemo(() => flatTopics(allSections), [allSections]);
  const readCount = countRead(trackSlug, allTopics);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allSections;

    return allSections
      .map((section) => ({
        ...section,
        topics: section.topics.filter((topic) =>
          `${topic.title} ${topic.summary} ${topic.tags?.join(' ') || ''}`
            .toLowerCase()
            .includes(needle),
        ),
      }))
      .filter((section) => section.topics.length > 0);
  }, [allSections, query]);

  const matches = useMemo(
    () => sections.reduce((sum, section) => sum + section.topics.length, 0),
    [sections],
  );

  if (!track || track.status !== 'live') {
    return (
      <div className="empty">
        <h3>{track ? `${track.name} is not written yet` : 'No such track'}</h3>
        <p>
          <Link to="/learn">Back to Learn</Link>
        </p>
      </div>
    );
  }

  if (loading) return <div className="loading">Loading {track.name}...</div>;
  if (error) {
    return (
      <div className="empty">
        <h3>Could not load</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="learn-crumb">
        <Link to="/learn">
          <IconArrowLeft size={13} />
          Learn
        </Link>
      </div>

      <div className="page-head">
        <h1>{data.title}</h1>
        <p>{data.summary}</p>
      </div>

      <div className="learn-toolbar">
        <label className="learn-search">
          <IconSearch size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter topics — try 'hook', 'performance', 'ref'"
            aria-label={`Filter ${track.name} topics`}
          />
          {query && <span className="learn-search-count mono">{matches}</span>}
        </label>

        {readCount > 0 && (
          <span className="learn-progress">
            <span className="minibar">
              <span style={{ width: `${Math.round((readCount / allTopics.length) * 100)}%` }} />
            </span>
            <span className="mono">
              {readCount}/{allTopics.length} read
            </span>
            <button type="button" className="learn-progress-clear" onClick={() => clearTrack(trackSlug)}>
              Reset
            </button>
          </span>
        )}
      </div>

      {sections.length === 0 ? (
        <div className="empty">
          <h3>Nothing matches "{query}"</h3>
          <p>Try a broader word, or clear the filter to see every topic.</p>
        </div>
      ) : (
        sections.map((section) => (
          <section className="learn-section" key={section.key}>
            <div className="learn-section-head">
              <h2>
                {section.title}
                <span className="learn-section-count mono">
                  {countRead(trackSlug, section.topics)}/{section.topics.length}
                </span>
              </h2>
              <p>{section.blurb}</p>
            </div>
            <div className="learn-topics">
              {section.topics.map((topic) => (
                <TopicCard
                  key={topic.slug}
                  trackSlug={trackSlug}
                  topic={topic}
                  read={Boolean(read[topicKey(trackSlug, topic.slug)])}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
