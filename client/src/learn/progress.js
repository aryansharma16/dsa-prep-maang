import { useCallback, useEffect, useState } from 'react';
import { learnApi } from '../api/index.js';

/**
 * Which topics you have read, and which you have put into revision.
 *
 * Two different facts, and they are still two different facts — what changed is
 * that both now live on the server.
 *
 * **Read** means "my eyes have been over this". It is set by scrolling to the
 * bottom of a page as well as by the button, so it is cheap and it is not a
 * claim about understanding. It used to be kept in localStorage *specifically*
 * to keep it out of the revision queue — a topic skimmed on a train must not
 * turn up on Tuesday — and that separation is now enforced where it belongs, by
 * `scheduledAt` on the row rather than by which storage the fact lives in. So it
 * can follow you between browsers, which is the whole point.
 *
 * **Scheduled** is the deliberate act: press the control, say how solid it felt,
 * and the topic goes on the same 3/7/21/60 ladder a problem goes on.
 *
 * localStorage is still here, and its job changed. It is a **write-through
 * mirror**, not the record — read synchronously at module load so the hub's
 * meters and every tick paint on the first frame instead of after a round trip,
 * and overwritten by the server's answer the moment it arrives.
 */
const KEY = 'learn-read';
/** Set once the old localStorage map has been handed to the server. */
const MIGRATED = 'learn-read-migrated';

/** `track/slug` — unique across tracks, so Node.js can reuse a React slug. */
export const topicKey = (trackSlug, topicSlug) => `${trackSlug}/${topicSlug}`;

const readMirror = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

const writeMirror = (map) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* Private mode or a full quota. The server is the record; this is a cache. */
  }
};

/*
  One shared map and one shared fetch.

  Three pages want this — the hub, the track and the topic — and they mount and
  unmount as you read. A `useEffect` per component would re-fetch on every
  navigation; a module-level promise means the first to ask pays and the rest get
  the same answer. Subscribers are notified in place so a tick set on the topic
  page is on the track page when you go back to it, with no refetch.
*/
let readMap = readMirror();
let rowsCache = null;
const listeners = new Set();

function publish(next) {
  readMap = next;
  writeMirror(next);
  listeners.forEach((fn) => fn(next));
}

const fromRows = (rows) =>
  Object.fromEntries(rows.filter((r) => r.readAt).map((r) => [topicKey(r.track, r.topic), true]));

/**
 * Loads the server's copy once, handing over the old localStorage map first if
 * this browser still has one.
 *
 * The migration is additive and runs at most once per browser: the map is one
 * device's memory of what was read, so treating an absence in it as "not read"
 * would let the first laptop to sync erase the second one's ticks.
 */
function load() {
  if (rowsCache) return rowsCache;

  const pending = (async () => {
    let migrated = false;
    try {
      migrated = localStorage.getItem(MIGRATED) === '1';
    } catch {
      /* Cannot read the flag, so do not attempt a migration that cannot be recorded. */
      migrated = true;
    }

    const local = Object.keys(readMap);

    const rows =
      !migrated && local.length
        ? await learnApi.bulkRead(local.slice(0, 500)).then((r) => {
            try {
              localStorage.setItem(MIGRATED, '1');
            } catch {
              /* It will be attempted again; the endpoint is idempotent. */
            }
            return r.topics;
          })
        : await learnApi.progress();

    if (!migrated) {
      try {
        localStorage.setItem(MIGRATED, '1');
      } catch {
        /* As above. */
      }
    }

    publish(fromRows(rows));
    return rows;
  })().catch(() => {
    /*
      Learn hidden, or the module gate said no. Keep whatever the mirror had —
      the pages then render exactly as they did before any of this, rather than
      losing every tick because one request failed.
    */
    rowsCache = null;
    return [];
  });

  rowsCache = pending;
  return pending;
}

export function useReadTopics() {
  const [read, setRead] = useState(readMap);

  useEffect(() => {
    listeners.add(setRead);
    load();
    return () => listeners.delete(setRead);
  }, []);

  /*
    Idempotent, and that is not a nicety here: this is called from a scroll
    handler at 90% of the page as well as from the button, so without the guard
    it would be one PUT per animation frame. Bailing when the value already
    matches also returns the same object, which is what lets React skip the
    re-render.

    Optimistic — the tick appears immediately and the request follows. A failed
    write rolls back, because a tick that silently did not persist is worse than
    one that visibly did not appear.
  */
  const mark = useCallback((key, value = true) => {
    if (Boolean(readMap[key]) === value) return;

    const previous = readMap;
    const next = { ...readMap };
    if (value) next[key] = true;
    else delete next[key];
    publish(next);

    const [track, topic] = key.split('/');
    learnApi.markRead(track, topic, value).catch(() => publish(previous));
  }, []);

  const countRead = useCallback(
    (trackSlug, topics) => topics.filter((t) => read[topicKey(trackSlug, t.slug)]).length,
    [read],
  );

  const clearTrack = useCallback((trackSlug) => {
    const doomed = Object.keys(readMap).filter((key) => key.startsWith(`${trackSlug}/`));
    if (!doomed.length) return;

    const previous = readMap;
    publish(
      Object.fromEntries(Object.entries(readMap).filter(([key]) => !key.startsWith(`${trackSlug}/`))),
    );

    Promise.all(
      doomed.map((key) => {
        const [track, topic] = key.split('/');
        return learnApi.markRead(track, topic, false);
      }),
    ).catch(() => publish(previous));
  }, []);

  return { read, mark, countRead, clearTrack };
}

/* -------------------------------------------------------------------------- */
/* scheduled for revision                                                      */
/* -------------------------------------------------------------------------- */

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
      /*
        `scheduledAt`, not `readAt`. Read is a browsing fact now and most rows
        have it — keying off it would show every topic you have scrolled to the
        bottom of as scheduled for revision.
      */
      setScheduled(
        rows.find((r) => r.track === trackSlug && r.topic === topicSlug && r.scheduledAt) || false,
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
        setScheduled(row.scheduledAt ? row : false);
        rowsCache = null;
        // Scheduling is also a reading, and the server says so — keep the tick
        // in step rather than waiting for the next page load to reveal it.
        if (row.readAt && !readMap[topicKey(trackSlug, topicSlug)]) {
          publish({ ...readMap, [topicKey(trackSlug, topicSlug)]: true });
        }
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
    schedule: (confidence) => set({ confidence, read: true }),
    unschedule: () => set({ read: false }),
  };
}
