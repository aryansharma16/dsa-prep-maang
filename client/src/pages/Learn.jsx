import { useEffect, useState } from 'react';
import { TrackCard } from '../components/learn/TrackCard.jsx';
import { useReadTopics } from '../learn/progress.js';
import { TRACKS, flatTopics } from '../learn/tracks.js';

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
 */
export function Learn() {
  const { countRead } = useReadTopics();
  const [topicsByTrack, setTopicsByTrack] = useState({});

  useEffect(() => {
    let live = true;
    Promise.all(
      TRACKS.filter((track) => track.status === 'live' && track.load).map((track) =>
        track
          .load()
          .then((module) => [track.slug, flatTopics(module.sections)])
          // A track whose chunk will not load still gets a card; it just has no
          // meter on it. Nothing here is worth an error state.
          .catch(() => null),
      ),
    ).then((entries) => {
      if (live) setTopicsByTrack(Object.fromEntries(entries.filter(Boolean)));
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <div className="page-head">
        <h1>Learn</h1>
        <p>
          Reference notes for the things around the algorithms — definitions, why each API exists,
          a small example, and what usually goes wrong. Written to be skimmed like a cheatsheet and
          read like docs.
        </p>
      </div>

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
    </>
  );
}
