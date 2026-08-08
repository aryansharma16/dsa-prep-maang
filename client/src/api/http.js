import axios from 'axios';

// Dev: '' + '/api' -> hits the Vite proxy, same origin, cookies just work.
// Prod: VITE_API_URL is the Render origin.
const baseURL = `${import.meta.env.VITE_API_URL || ''}/api`;

export const http = axios.create({ baseURL, withCredentials: true });

let refreshing = null;

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
        refreshing = refreshing || http.post('/auth/refresh');
        await refreshing;
        return http(config);
      } catch (err) {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
        return Promise.reject(err);
      } finally {
        refreshing = null;
      }
    }

    return Promise.reject(error);
  },
);

export const errorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.error?.message || err?.message || fallback;
