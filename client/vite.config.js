import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Vite only exposes VITE_-prefixed vars to the app. PORT and API_URL are read
// here instead, so client/.env controls the dev server without needing the
// prefix (they never reach the browser bundle, which is what you want).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

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
