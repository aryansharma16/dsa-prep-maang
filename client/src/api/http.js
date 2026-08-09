import axios from 'axios';

/**
 * Always same-origin `/api`, in both environments:
 *   dev  — the Vite proxy forwards to localhost:4000 (see vite.config.js)
 *   prod — the Vercel rewrite forwards to the API host (see vercel.json)
 *
 * That keeps the auth cookies first-party. Pointing this straight at the API
 * host instead would make them third-party, which Safari and Brave block by
 * default — login would silently fail there and nowhere else.
 *
 * VITE_API_URL is an escape hatch for hosting the client somewhere that cannot
 * proxy. Leave it unset on Vercel, or it defeats the rewrite.
 */
export const baseURL = `${import.meta.env.VITE_API_URL || ''}/api`;

export const http = axios.create({ baseURL, withCredentials: true });

let refreshing = null;

/**
 * The one in-flight refresh, shared.
 *
 * The interceptor below used to own this outright. It is exported because the
 * chat reply arrives over raw `fetch` — axios hands you a growing string, not a
 * stream — and no axios interceptor can see that request. Without sharing the
 * promise, a stream and a normal call hitting 401 together would fire two
 * refreshes at a rotating refresh cookie, and the loser of that race logs you
 * out.
 */
export const refreshSession = () => {
  refreshing =
    refreshing ||
    http.post('/auth/refresh').finally(() => {
      refreshing = null;
    });
  return refreshing;
};

/**
 * Fired when the refresh token itself is dead — the session cannot be revived,
 * so the app has to fall back to the login screen instead of leaving you on a
 * page where every action fails.
 */
export const AUTH_EXPIRED_EVENT = 'auth-expired';

// Access tokens live 15 minutes. On the first 401 caused by expiry, silently
// refresh and replay the request; a second failure means the session is really
// gone and the auth store logs out.
http.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const code = response?.data?.error?.code;

    // Only the endpoints that mint or clear tokens are excluded — retrying those
    // would loop. /auth/me must be retryable, otherwise reloading the page more
    // than 15 minutes after signing in logs you out despite a valid refresh
    // token.
    const url = String(config?.url || '');
    const isTokenEndpoint = /\/auth\/(refresh|login|register|logout)$/.test(url);

    const canRetry = response?.status === 401 && !config?._retried && !isTokenEndpoint;

    if (canRetry && (code === 'TOKEN_EXPIRED' || code === 'NO_TOKEN')) {
      config._retried = true;
      try {
        await refreshSession();
        return http(config);
      } catch (err) {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  },
);

export const errorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.error?.message || err?.message || fallback;
