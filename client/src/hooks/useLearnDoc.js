import { useEffect, useState } from 'react';

/**
 * Loads one Learn document — a track index, or a topic's body.
 *
 * The same shape as `useGuide`, and for the same reason: the page wants
 * `{ data, loading, error }` and does not want to know where the words came
 * from. What differs is the source. A guide is prose in Mongo behind an
 * endpoint; a Learn topic is a module in this bundle, so the "request" is a
 * dynamic `import()` and there is nothing to invalidate — a deploy is the only
 * thing that can change it.
 *
 * The cache is redundant in the happy path, since the bundler already keeps a
 * resolved module. It is here for the unhappy one: a chunk that fails to load
 * (a stale index.html pointing at a deleted chunk after a deploy, or a dropped
 * connection) must be retryable on the next visit rather than remembered as
 * broken, and the loading flag must be right on the very first frame so a cached
 * topic does not flash a skeleton on the way back to it.
 *
 * `inflight` collapses a double-click, or two components asking at once, into
 * one import.
 */
const cache = new Map();
const inflight = new Map();

function loadDoc(key, load) {
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);

  const pending = Promise.resolve()
    .then(load)
    .then((module) => {
      cache.set(key, module);
      return module;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, pending);
  return pending;
}

/**
 * `{ data, loading, error }` for one lazily imported content module.
 *
 * `key` identifies it for the cache; `load` is the `() => import(...)` thunk off
 * the registry. Pass a null key while the route is still resolving — the hook
 * stays idle rather than importing nothing.
 */
export function useLearnDoc(key, load) {
  const [data, setData] = useState(() => (key && cache.get(key)) || null);
  const [loading, setLoading] = useState(() => Boolean(key) && !cache.has(key));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!key || !load) {
      setData(null);
      setLoading(false);
      return undefined;
    }

    if (cache.has(key)) {
      setData(cache.get(key));
      setLoading(false);
      setError('');
      return undefined;
    }

    // Moving between topics must not leave the previous one's words on screen
    // under the new one's title.
    let live = true;
    setData(null);
    setLoading(true);
    setError('');

    loadDoc(key, load)
      .then((module) => live && setData(module))
      .catch(() => {
        if (!live) return;
        /*
          A chunk import fails for one of two reasons and neither is worth
          telling apart here: the network dropped, or this tab is running a
          build whose chunks have since been replaced. Reloading fixes both,
          which is why that is what the message asks for.
        */
        setError('Could not load this page. Refresh and try again.');
      })
      .finally(() => live && setLoading(false));

    return () => {
      live = false;
    };
  }, [key, load]);

  return { data, loading, error };
}
