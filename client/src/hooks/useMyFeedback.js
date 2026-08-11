import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { feedbackApi } from '../api/index.js';

/**
 * Your own submissions, for the three places that show them.
 *
 * The popup's Yours tab, the /feedback page and the panel on your profile all
 * ask the same question and differ only in how many rows they draw, so the fetch
 * lives here once rather than three times.
 *
 * No module-scope cache, unlike useGuide and useMotivation. Those cache because
 * their answers are stable for the whole session; this list changes the moment
 * you use the form beside it, and a cache would mean the thing you just sent is
 * missing from the list directly below.
 */
export function useMyFeedback({ limit = 20 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Bumped to re-run the effect. A plain async `load` would leave the caller
  // holding a promise it has to remember not to race.
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    // Guards the unmount-mid-flight case the same way the activity feed does:
    // the popup closes while its first page is still in the air often enough to
    // matter.
    let live = true;
    setLoading(true);

    feedbackApi
      .mine({ limit })
      .then((res) => {
        if (!live) return;
        setData(res);
        setError('');
      })
      .catch((err) => {
        if (!live) return;
        setError(errorMessage(err, 'Could not load what you have sent'));
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [limit, nonce]);

  return {
    items: data?.submissions || [],
    total: data?.total || 0,
    remaining: data?.remaining ?? null,
    openLimit: data?.openLimit ?? null,
    loading,
    error,
    reload,
  };
}
