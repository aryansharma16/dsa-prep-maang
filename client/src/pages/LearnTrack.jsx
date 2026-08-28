import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TopicCard } from '../components/learn/TopicCard.jsx';
import { IconArrowLeft, IconSearch } from '../components/ui/Icons.jsx';
import { findTrack, useLearnCatalogue } from '../hooks/useLearnCatalogue.js';
import { topicKey, useReadTopics } from '../learn/progress.js';

/* Sections are never empty and never one card, so a grid of eight under two
   headings is close enough to any track to hold the page still while the
   catalogue lands. Frozen at module scope: a fresh array per render would re-key
   the skeletons and restart their shimmer on every keystroke. */
const SKELETON = [8, 6];

/* The one empty list, shared, for a track whose topics have not arrived. */
const EMPTY = [];

/**
 * A track's table of contents.
 *
 * The filter is client-side and deliberately dumb — every title, summary and tag
 * in the track is already in memory the moment the catalogue lands, so there is
 * nothing to fetch and no reason to debounce. It matches tags as well as prose
 * because "hook" and "performance" are how you look for something whose name you
 * have forgotten, which is the whole reason this page exists.
 */
export function LearnTrack() {
  const { track: trackSlug } = useParams();
  const { catalogue, loading: catalogueLoading, error } = useLearnCatalogue();

  /*
    The stub answers first, the catalogue answers properly. `findTrack` was
    synchronous when the registry was a module, and this page leaned on that in
    three places — the hue on the shell, the name in the crumb, and the "No such
    track" gate below. It still answers on the first frame for the four tracks
    this build knows; only a track added since needs the request.
  */
  const track = findTrack(catalogue, trackSlug);

  // A track only has topics once the catalogue has landed — the stub carries
  // chrome and nothing else, which is why `loading` is about the sections.
  const sectionsFromApi = track?.sections;
  const loading = !sectionsFromApi;

  const [query, setQuery] = useState('');
  const { read, countRead, clearTrack } = useReadTopics();

  const allSections = sectionsFromApi || EMPTY;
  const allTopics = track?.flat || EMPTY;
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

  /*
    A slug in neither the stub nor a landed catalogue. It is a bad bookmark, or a
    track added since this build — and until the catalogue answers there is no
    way to tell, so this draws the empty shell rather than a verdict. No hue on
    it, because nothing knows which one yet.

    Everything below this point can read `track.hue` and `track.name` freely,
    which is what the early return is protecting.
  */
  if (!track) {
    if (catalogueLoading) return <div className="learn-shell" aria-busy="true" />;
    return (
      <div className="learn-shell">
        <div className="empty">
          <h3>No such track</h3>
          <p>
            <Link to="/learn">Back to Learn</Link>
          </p>
        </div>
      </div>
    );
  }

  if (track.status !== 'live') {
    return (
      <div className="learn-shell" data-hue={track.hue}>
        <div className="empty">
          <h3>{track.name} is not written yet</h3>
          <p>
            <Link to="/learn">Back to Learn</Link>
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="learn-shell" data-hue={track.hue}>
        <div className="empty">
          <h3>Could not load</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  /*
    The catalogue is one request, but a request is still a round trip on a cold
    visit, and what used to sit here was the word `Loading React...` on an
    otherwise blank page — no title, no toolbar, nothing where the cards were
    about to be. Everything except the section titles is known before it
    resolves, so the page draws itself and only the parts that genuinely need the
    catalogue come in as cards of the right size. The layout never moves; it
    fills in.

    The hero is a fallback chain rather than the ternary it used to be. The stub
    has a blurb and the catalogue has a summary written for exactly this spot, so
    the sentence improves when the request lands instead of being replaced.
  */
  return (
    <div className="learn-shell" data-hue={track.hue}>
      <div className="learn-crumb">
        <Link to="/learn">
          <IconArrowLeft size={13} />
          Learn
        </Link>
      </div>

      <header className="learn-hero">
        <span className="learn-hero-eyebrow">{track.name}</span>
        <h1>{track.name}</h1>
        <p>{track.summary || track.blurb}</p>
      </header>

      <div className="learn-toolbar">
        <label className="learn-search">
          <IconSearch size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter topics — try 'hook', 'performance', 'ref'"
            aria-label={`Filter ${track.name} topics`}
            disabled={loading}
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

      {loading ? (
        <div className="learn-skeleton" aria-busy="true" aria-label={`Loading ${track.name}`}>
          {SKELETON.map((count, section) => (
            <section className="learn-section" key={section}>
              <div className="learn-section-head">
                <span className="skeleton sk-title" />
              </div>
              <div className="learn-topics">
                {Array.from({ length: count }).map((_, i) => (
                  <span className="skeleton sk-card" key={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : sections.length === 0 ? (
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
    </div>
  );
}
