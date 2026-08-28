import { useEffect, useMemo, useRef, useState } from 'react';
import { TopicCard } from '../components/learn/TopicCard.jsx';
import { TrackCard } from '../components/learn/TrackCard.jsx';
import { topicKey, useReadTopics } from '../learn/progress.js';
import { TRACKS, flatTopics } from '../learn/tracks.js';
import { useSearchHotkey } from '../hooks/useSearchHotkey.js';
import { IconSearch } from '../components/ui/Icons.jsx';

/**
 * Waits for the browser to be idle, falling back to a timeout where
 * `requestIdleCallback` does not exist — which is Safari, and is why this is a
 * helper rather than a call. Returns its own cancel.
 */
function whenIdle(fn, timeout = 1200) {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(fn, { timeout });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(fn, 200);
  return () => clearTimeout(handle);
}

/**
 * The Learn hub.
 *
 * Deliberately thin. Everything it knows comes from the track registry, so
 * adding Node.js later is an entry in `learn/tracks.js` and a folder — not a
 * change here.
 *
 * It does pull each live track's index, which is the only thing here that costs
 * anything. That buys the "12 of 35 read" meter on the card, and it doubles as
 * a prefetch of the page you are about to open — the index is metadata only,
 * with every topic's prose behind a further import.
 *
 * Behind `requestIdleCallback`, though, and that is the whole difference
 * between this page feeling instant and feeling like it thinks about it. Every
 * word on the hub is already in `TRACKS`, so the cards paint on the first
 * frame; the three indexes together are the largest thing Learn fetches, and
 * firing them from a plain mount effect put that download and its parse in
 * front of the paint they contribute nothing to. The meters are a detail that
 * can arrive a beat late. The page cannot.
 */
export function Learn() {
  const { countRead, read } = useReadTopics();

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

  const [topicsByTrack, setTopicsByTrack] = useState({});

  const searching = Boolean(query.trim());

  useEffect(() => {
    let live = true;

    const load = () => {
      Promise.all(
        TRACKS.filter((track) => track.status === 'live' && track.load).map((track) =>
          track
            .load()
            .then((module) => [track.slug, flatTopics(module.sections)])
            // A track whose chunk will not load still gets a card; it just has
            // no meter on it. Nothing here is worth an error state.
            .catch(() => null),
        ),
      ).then((entries) => {
        if (live) setTopicsByTrack(Object.fromEntries(entries.filter(Boolean)));
      });
    };

    /*
      Idle is right for the meters and wrong for a search: the indexes *are* the
      search, so waiting for a quiet frame before fetching them would mean typing
      into a box that answers "nothing found" until the browser gets around to
      it. A query jumps the queue; everything else still waits.
    */
    if (searching) {
      load();
      return () => {
        live = false;
      };
    }

    const cancel = whenIdle(load);
    return () => {
      live = false;
      cancel();
    };
  }, [searching]);

  /*
    Every live track's topics, flattened and matched — the hub is the only page
    that can search *across* tracks, which is what makes it the right place for
    the top bar's box to land. A track page filters its own list; this answers
    "where in Learn is this mentioned at all".

    Matched on the same three fields a track page's own filter uses, so the two
    boxes do not disagree about what counts as a hit.
  */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return TRACKS.map((track) => {
      const topics = (topicsByTrack[track.slug] || []).filter(
        (topic) =>
          topic.title.toLowerCase().includes(q) ||
          (topic.summary || '').toLowerCase().includes(q) ||
          (topic.tags || []).some((tag) => tag.toLowerCase().includes(q)),
      );
      return { track, topics };
    }).filter((group) => group.topics.length > 0);
  }, [query, topicsByTrack]);

  const hits = results.reduce((n, group) => n + group.topics.length, 0);

  /*
    The one line of arithmetic on this page, and it only says something once
    the indexes have landed — before that the hub would be claiming "0 topics",
    which is worse than saying nothing.
  */
  const totals = useMemo(() => {
    const lists = Object.entries(topicsByTrack);
    if (!lists.length) return null;
    return {
      tracks: lists.length,
      topics: lists.reduce((sum, [, topics]) => sum + topics.length, 0),
      read: lists.reduce((sum, [slug, topics]) => sum + countRead(slug, topics), 0),
    };
  }, [topicsByTrack, countRead]);

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

          {/* The indexes are three lazy chunks, so an empty result a beat after
              a keystroke may only mean they have not landed. Saying which of the
              two it is costs one line and saves the reader retyping. */}
          {hits === 0 && (
            <div className="empty">
              <h3>{Object.keys(topicsByTrack).length ? 'Nothing matches' : 'Looking…'}</h3>
              {Object.keys(topicsByTrack).length > 0 && (
                <p>No topic title, summary or tag contains that. Try a shorter word.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="learn-hub">
          {TRACKS.map((track) => {
            const topics = topicsByTrack[track.slug] || [];
            return (
              <TrackCard
                key={track.slug}
                track={track}
                total={topics.length}
                read={countRead(track.slug, topics)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
