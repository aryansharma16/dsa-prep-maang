import { useCallback } from 'react';
import { useLocalState } from '../hooks/useLocalState.js';

/**
 * Which topics you have read.
 *
 * Kept in localStorage rather than on the server, which is a deliberate
 * downgrade from how the roadmap stores progress. Learn has no API — its
 * content is modules in this bundle — and inventing a collection, a route and a
 * requireModule guard so a reference page can draw a tick would be a lot of
 * machinery for a convenience. The cost is real and worth stating: this does
 * not follow you to another browser, and clearing site data clears it.
 *
 * One key holding a map rather than a key per topic, so reading forty topics
 * does not leave forty entries behind, and so the track page can count them in
 * one read.
 */
const KEY = 'learn-read';

/** `track/slug` — unique across tracks, so Node.js can reuse a React slug. */
export const topicKey = (trackSlug, topicSlug) => `${trackSlug}/${topicSlug}`;

export function useReadTopics() {
  const [read, setRead] = useLocalState(KEY, {});

  /*
    Idempotent on purpose: this is called from a scroll handler as well as from
    the button, and an unconditional write would re-render the page on every
    frame of scrolling past the end. Returning the same object is what lets
    React bail out.
  */
  const mark = useCallback(
    (key, value = true) =>
      setRead((prev) => {
        if (Boolean(prev[key]) === value) return prev;
        const next = { ...prev };
        if (value) next[key] = true;
        else delete next[key];
        return next;
      }),
    [setRead],
  );

  const countRead = useCallback(
    (trackSlug, topics) => topics.filter((t) => read[topicKey(trackSlug, t.slug)]).length,
    [read],
  );

  const clearTrack = useCallback(
    (trackSlug) =>
      setRead((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([key]) => !key.startsWith(`${trackSlug}/`)),
        ),
      ),
    [setRead],
  );

  return { read, mark, countRead, clearTrack };
}
