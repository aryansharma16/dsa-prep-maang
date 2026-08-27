import { useCallback, useEffect, useState } from 'react';
import { learnApi } from '../api/index.js';
import { useLocalState } from '../hooks/useLocalState.js';

/**
 * Which topics you have read, and which you have put into revision.
 *
 * Two different facts, kept in two different places on purpose.
 *
 * **Read** is local, in localStorage, and stays that way. It is set by scrolling
 * to the bottom of a page as well as by the button, so it means "my eyes have
 * been over this" — a browsing fact, cheap, and one that would be actively wrong
 * to sync: a topic you skimmed on the train should not turn up in your revision
 * queue on Tuesday. The cost is the one this file always carried, and it is
 * still worth stating: it does not follow you to another browser.
 *
 * **Scheduled** is on the server, and is the deliberate act. It is only ever set
 * by pressing the control and saying how solid it felt, and it puts the topic on
 * the same 3/7/21/60 ladder a problem goes on — see
 * server/src/models/LearnProgress.js. That is the fact worth a collection, and
 * the reason Learn finally has an API.
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

/* -------------------------------------------------------------------------- */
/* scheduled for revision — the server half                                    */
/* -------------------------------------------------------------------------- */

/*
  One fetch per session, shared.

  Three pages want this list — the topic, the track and the hub — and they mount
  and unmount as you read. A `useEffect` per component would re-fetch on every
  navigation; a module-level promise means the first one to ask pays and the rest
  get the same answer. Cleared on a write so the next reader sees it.
*/
let cache = null;

const load = () => {
  if (!cache) {
    cache = learnApi.progress().catch(() => {
      // Learn hidden, or the module gate said no. An empty list is the right
      // answer: the pages render exactly as they did before any of this.
      cache = null;
      return [];
    });
  }
  return cache;
};

/**
 * Whether one topic is on the revision ladder, and how to put it there.
 *
 * Returns `null` for `scheduled` until the list arrives, so the control can draw
 * its resting state rather than flashing "not scheduled" and correcting itself.
 */
export function useTopicRevision(trackSlug, topicSlug) {
  const [scheduled, setScheduled] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    load().then((rows) => {
      if (!live) return;
      setScheduled(
        rows.find((r) => r.track === trackSlug && r.topic === topicSlug && r.readAt) || false,
      );
    });
    return () => {
      live = false;
    };
  }, [trackSlug, topicSlug]);

  const set = useCallback(
    async (body) => {
      setBusy(true);
      try {
        const row = await learnApi.mark(trackSlug, topicSlug, body);
        setScheduled(row.readAt ? row : false);
        cache = null;
        return true;
      } catch {
        return false;
      } finally {
        setBusy(false);
      }
    },
    [trackSlug, topicSlug],
  );

  return {
    scheduled,
    busy,
    schedule: (confidence, title) => set({ confidence, title, read: true }),
    unschedule: () => set({ read: false }),
  };
}
