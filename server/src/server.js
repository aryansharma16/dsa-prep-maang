import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { reconcileSuperAdmin } from './services/auth.service.js';

async function start() {
  await connectDb();
  // Before listening: the owner should hold their role from the first request,
  // not from their next sign-in.
  await reconcileSuperAdmin();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err.message);
  process.exit(1);
});
