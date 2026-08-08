import { useEffect, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { problemsApi } from '../api/index.js';

/**
 * Guides are static prose — once fetched, they are good for the session. The
 * cache lives at module scope rather than in state or context so it survives
 * the drawer unmounting, which it does on every close.
 *
 * `inflight` collapses the double-click case into one request.
 */
const cache = new Map();
const inflight = new Map();

function fetchGuide(slug) {
  if (cache.has(slug)) return Promise.resolve(cache.get(slug));
  if (inflight.has(slug)) return inflight.get(slug);

  const pending = problemsApi
    .guide(slug)
    .then((data) => {
      cache.set(slug, data);
      return data;
    })
    .finally(() => inflight.delete(slug));

  inflight.set(slug, pending);
  return pending;
}

/** `{ data, loading, error }` for one pattern's guide. Cached across opens. */
export function useGuide(slug) {
  const [data, setData] = useState(() => cache.get(slug) || null);
  const [loading, setLoading] = useState(() => !cache.has(slug));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return undefined;

    if (cache.has(slug)) {
      setData(cache.get(slug));
      setLoading(false);
      setError('');
      return undefined;
    }

    // Reopening on a different pattern must not show the previous one's text.
    let live = true;
    setData(null);
    setLoading(true);
    setError('');

    fetchGuide(slug)
      .then((result) => live && setData(result))
      .catch((err) => live && setError(errorMessage(err, 'Could not load this guide')))
      .finally(() => live && setLoading(false));

    return () => {
      live = false;
    };
  }, [slug]);

  return { data, loading, error };
}
