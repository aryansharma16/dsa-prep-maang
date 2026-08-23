import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * The client must reach the API on its own origin.
 *
 * `api/http.js` builds its baseURL from `VITE_API_URL || ''`, so an unset
 * variable means `/api` — the Vite proxy below in dev, the `vercel.json`
 * rewrite in production. Both keep the auth cookies first-party.
 *
 * Setting it bakes the API host into the bundle, and the cookies become
 * third-party. Chrome on a desktop still sends those; every browser on iOS is
 * WebKit and blocks them outright, so sign-in succeeds, the `Set-Cookie` is
 * dropped, and the next call 401s straight back to the login screen. It is a
 * one-line dashboard setting that breaks one platform completely and leaves
 * the one you develop on working, which is the worst shape a bug can have.
 *
 * So a production build refuses to start with it set. The escape hatch stays
 * open for a host that genuinely cannot proxy — see ALLOW_CROSS_ORIGIN_API.
 */
function assertSameOriginApi(env, command) {
  if (command !== 'build') return;
  if (!env.VITE_API_URL) return;
  if (env.ALLOW_CROSS_ORIGIN_API === 'true') {
    console.warn(
      `\n[vite] VITE_API_URL is set to ${env.VITE_API_URL} and ALLOW_CROSS_ORIGIN_API=true.\n` +
        '       Auth cookies will be third-party. Sign-in will fail on iOS.\n',
    );
    return;
  }

  throw new Error(
    `VITE_API_URL is set to "${env.VITE_API_URL}".\n\n` +
      'That bypasses the /api rewrite and makes the auth cookies third-party,\n' +
      'which every browser on iOS blocks — sign-in fails there and nowhere else.\n\n' +
      'Unset it and let the rewrite in client/vercel.json do the work.\n' +
      'If this really is a host that cannot proxy, set ALLOW_CROSS_ORIGIN_API=true\n' +
      'alongside it to state that out loud.',
  );
}

// Vite only exposes VITE_-prefixed vars to the app. PORT and API_URL are read
// here instead, so client/.env controls the dev server without needing the
// prefix (they never reach the browser bundle, which is what you want).
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');

  assertSameOriginApi(env, command);

  return {
    plugins: [react()],
    server: {
      port: Number(env.PORT) || 5173,
      // Fail loudly instead of silently hopping to another port — otherwise the
      // URL you open and the one CORS is configured for can drift apart.
      strictPort: true,
      proxy: {
        // Dev goes through the proxy so cookies stay same-origin.
        '/api': {
          target: env.API_URL || 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  };
});
