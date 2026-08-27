import { useEffect, useMemo, useState } from 'react';
import { TrackCard } from '../components/learn/TrackCard.jsx';
import { useReadTopics } from '../learn/progress.js';
import { TRACKS, flatTopics } from '../learn/tracks.js';

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
  const { countRead } = useReadTopics();
  const [topicsByTrack, setTopicsByTrack] = useState({});

  useEffect(() => {
    let live = true;
    const cancel = whenIdle(() => {
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
    });
    return () => {
      live = false;
      cancel();
    };
  }, []);

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
    </div>
  );
}
