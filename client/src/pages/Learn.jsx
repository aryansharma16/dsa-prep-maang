import { useMemo, useRef, useState } from 'react';
import { TopicCard } from '../components/learn/TopicCard.jsx';
import { TrackCard } from '../components/learn/TrackCard.jsx';
import { topicKey, useReadTopics } from '../learn/progress.js';
import { TRACK_STUBS } from '../learn/tracks.js';
import { useLearnCatalogue } from '../hooks/useLearnCatalogue.js';
import { useSearchHotkey } from '../hooks/useSearchHotkey.js';
import { IconSearch } from '../components/ui/Icons.jsx';

/**
 * The Learn hub.
 *
 * Deliberately thin. Everything it knows arrives in one catalogue request, so
 * adding a fifth track is a row in the database — not a change here, and not a
 * deploy.
 *
 * This page used to fan out over every track's index behind
 * `requestIdleCallback`: four chunk downloads and four module evaluations, all
 * deferred because putting them in front of the first paint made the hub feel
 * like it was thinking about it. Both the fan-out and the deferral are gone. One
 * request answers every question this page has, it blocks nothing, and on a
 * second visit the catalogue is already on disk — so the meters and the search
 * are there on the first frame rather than a beat later.
 *
 * The cards themselves still paint immediately either way. `TRACK_STUBS` is four
 * names and four colours in the bundle, and the catalogue replaces them the
 * moment it lands. See learn/tracks.js.
 */
export function Learn() {
  const { countRead, read } = useReadTopics();
  const { catalogue, loading } = useLearnCatalogue();

  /*
    The hub's own search, in the hub. It used to be the top bar's single box
    reaching in through the outlet — see `PageSearch` for why that stopped.

    Deliberately the same control the track pages already have rather than the
    `.filterbar` one the roadmap and the ladder use: this is Learn, and a reader
    moving between the hub and a track should meet the same box in the same
    place. The difference is only what it searches — every track at once here,
    one track there.
  */
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  useSearchHotkey(searchRef);

  const searching = Boolean(query.trim());

  /*
    The four cards, from whichever source can answer.

    Every word on this page used to be in the bundle, so it painted on the first
    frame. The words are a fetch now, and a hub that draws nothing while it
    arrives is the one regression this move could have shipped — so the stubs
    answer immediately and the catalogue takes over the moment it lands.
  */
  const tracks = catalogue?.tracks || TRACK_STUBS;

  /*
    Every track's topics, matched — the hub is the only page that can search
    *across* tracks, which is what makes it the right place for the top bar's box
    to land. A track page filters its own list; this answers "where in Learn is
    this mentioned at all".

    Matched on the same three fields a track page's own filter uses, so the two
    boxes do not disagree about what counts as a hit.
  */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !catalogue) return [];

    return catalogue.tracks
      .map((track) => ({
        track,
        topics: track.flat.filter(
          (topic) =>
            topic.title.toLowerCase().includes(q) ||
            (topic.summary || '').toLowerCase().includes(q) ||
            (topic.tags || []).some((tag) => tag.toLowerCase().includes(q)),
        ),
      }))
      .filter((group) => group.topics.length > 0);
  }, [query, catalogue]);

  const hits = results.reduce((n, group) => n + group.topics.length, 0);

  /*
    The one line of arithmetic on this page, and it only says something once the
    catalogue has landed — before that the hub would be claiming "0 topics",
    which is worse than saying nothing.
  */
  const totals = useMemo(() => {
    if (!catalogue) return null;
    return {
      tracks: catalogue.tracks.length,
      topics: catalogue.tracks.reduce((sum, track) => sum + track.flat.length, 0),
      read: catalogue.tracks.reduce((sum, track) => sum + countRead(track.slug, track.flat), 0),
    };
  }, [catalogue, countRead]);

  return (
    <div className="learn-shell learn-shell-hub">
      <header className="learn-hero">
        <span className="learn-hero-eyebrow">Reference</span>
        <h1>Learn</h1>
        <p>
          Reference notes for the things around the algorithms — definitions, why each API exists,
          a small example, and what usually goes wrong. Written to be skimmed like a cheatsheet and
          read like docs.
        </p>
        {totals && (
          <p className="learn-hero-stats">
            <span>
              <b className="mono">{totals.topics}</b> topics
            </span>
            <span>
              <b className="mono">{totals.tracks}</b> tracks
            </span>
            <span>
              <b className="mono">{totals.read}</b> read
            </span>
          </p>
        )}
      </header>

      <div className="learn-toolbar">
        <label className="learn-search">
          <IconSearch size={14} />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search every track — try 'join', 'closure', 'useMemo'"
            aria-label="Search Learn"
            spellCheck="false"
            autoComplete="off"
          />
          {searching ? (
            <span className="learn-search-count mono">{hits}</span>
          ) : (
            <kbd className="mono learn-search-key">/</kbd>
          )}
        </label>
      </div>

      {searching ? (
        <>
          {results.map(({ track, topics }) => (
            <section className="learn-section" key={track.slug} data-hue={track.hue}>
              <div className="learn-section-head">
                <h2>
                  {track.name}
                  <span className="learn-section-count mono">{topics.length}</span>
                </h2>
              </div>
              <div className="learn-topics">
                {topics.map((topic) => (
                  <TopicCard
                    key={topic.slug}
                    trackSlug={track.slug}
                    topic={topic}
                    read={Boolean(read[topicKey(track.slug, topic.slug)])}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* An empty result on a first visit may only mean the catalogue has
              not landed. Saying which of the two it is costs one line and saves
              the reader retyping. */}
          {hits === 0 && (
            <div className="empty">
              <h3>{loading ? 'Looking…' : 'Nothing matches'}</h3>
              {!loading && <p>No topic title, summary or tag contains that. Try a shorter word.</p>}
            </div>
          )}
        </>
      ) : (
        <div className="learn-hub">
          {tracks.map((track) => (
            <TrackCard
              key={track.slug}
              track={track}
              total={track.flat?.length || 0}
              read={countRead(track.slug, track.flat || [])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
