import { useEffect, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { learnApi } from '../api/index.js';

/**
 * One topic's words.
 *
 * The same `cache` / `inflight` / `generation` shape as `useGuide.js`, and now
 * for the same reason: this is prose in Mongo behind an endpoint, and something
 * can change it. `useLearnDoc` — which this replaces — deliberately had no
 * generation counter, because a deploy was the only thing that could change a
 * module in the bundle. That is no longer true.
 *
 * What also went away is the `load` thunk it took as a second argument. That
 * only existed because the loader came off a frozen registry, and it was the
 * source of the footgun its own docblock warned about: `[key, load]` in the
 * effect deps meant a caller who built that closure inline re-ran forever. The
 * key *is* the request now, so the deps are one string and the footgun is gone
 * by construction rather than by everyone remembering.
 */
const cache = new Map();
const inflight = new Map();
let generation = 0;

function fetchTopic(key) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);

  const startedAt = generation;
  const [track, slug] = key.split('/');

  const pending = learnApi
    .topic(track, slug)
    .then((payload) => {
      if (startedAt === generation) cache.set(key, payload);
      return payload;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, pending);
  return pending;
}

/**
 * The state for one key, decided in one place so that mounting on a topic and
 * navigating to one cannot disagree about whether it is loading.
 */
const seed = (key) => {
  if (!key) return { key, payload: null, loading: false, error: '' };
  const hit = cache.get(key);
  return { key, payload: hit || null, loading: !hit, error: '' };
};

/*
  There is no prefetch helper here, and that is a decision rather than an
  omission.

  Both a hover prefetch on `TopicCard` and an idle prefetch of the two
  neighbours on `LearnTopic` were built, and both were removed for the same
  reason: **a request should mean you opened something.** Speculative fetches are
  individually cheap and collectively make the network panel unreadable, which
  is a bad trade for a page whose whole job is being read. The cache below still
  makes the second visit to a topic free.
*/

/** Drops one topic, or all of them. For the editor, after a save. */
export function invalidateLearnTopic(track, slug) {
  generation += 1;
  if (track && slug) {
    const key = `${track}/${slug}`;
    cache.delete(key);
    inflight.delete(key);
  } else {
    cache.clear();
    inflight.clear();
  }
}

/**
 * `{ topic, canonical, loading, error }` for one topic. Pass a null slug to stay
 * idle while the route is still resolving.
 */
export function useLearnTopic(track, slug) {
  const key = track && slug ? `${track}/${slug}` : '';
  const [state, setState] = useState(() => seed(key));

  /*
    The reset happens during render, not in an effect, and the difference is one
    painted frame.

    `LearnTopic` does not remount between topics — same route, changed params —
    so a lazy `useState` initialiser runs once and never again. The old hook
    cleared the previous topic's body from inside its effect, which runs *after*
    paint, so every prev/next navigation drew the last topic's words under the
    new one's title for a frame before correcting itself. That is precisely the
    thing that hook's own comment said must not happen. Setting state during
    render makes React throw this pass away and re-run from the seed before
    anything reaches the screen.
  */
  if (state.key !== key) setState(seed(key));
  const view = state.key === key ? state : seed(key);

  useEffect(() => {
    if (!key || cache.has(key)) return undefined;

    let live = true;
    fetchTopic(key)
      .then((payload) => {
        if (live) setState((s) => (s.key === key ? { ...s, payload, loading: false } : s));
      })
      .catch((err) => {
        if (!live) return;
        /*
          Whatever the server said. The copy here used to be a hardcoded
          "Refresh and try again", which was honest about a chunk import — the
          two ways that failed were a dropped connection and a stale index.html,
          and reloading fixed both. It is not honest about a request that can 404
          a renamed topic or 401 an expired session.
        */
        const message = errorMessage(err, 'Could not load this topic');
        setState((s) => (s.key === key ? { ...s, loading: false, error: message } : s));
      });

    return () => {
      live = false;
    };
  }, [key]);

  return {
    topic: view.payload?.topic || null,
    /** Set when the URL held an old slug — the page corrects the address bar. */
    canonical: view.payload?.canonical || null,
    loading: view.loading,
    error: view.error,
  };
}
