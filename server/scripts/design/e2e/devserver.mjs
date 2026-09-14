// An isolated API for trying the System Design UI without touching a real database:
// in-memory MongoDB replica set, the real Express app on :4100, and a seeded super admin
// (admin@test.local / password123) with a starter project.
//
//   cd server && npm i --no-save mongodb-memory-server@10
//   cd server/scripts/design/e2e && node devserver.mjs
//   cd client && PORT=3100 API_URL=http://localhost:4100 npx vite
//
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const SERVER = new URL('../../../src', import.meta.url).pathname;
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
Object.assign(process.env, {
  NODE_ENV: 'development',
  PORT: '4100',
  MONGO_URI: replSet.getUri('design-dev'),
  JWT_ACCESS_SECRET: 'dev-access-secret-dev-access-secret',
  JWT_REFRESH_SECRET: 'dev-refresh-secret-dev-refresh-secret',
  CLIENT_URL: 'http://localhost:3100',
  SUPER_ADMIN_EMAIL: 'admin@test.local',
  RATE_LIMIT_DISABLED: 'true',
});
const { connectDb } = await import(`${SERVER}/config/db.js`);
const { createApp } = await import(`${SERVER}/app.js`);
await connectDb();
createApp().listen(4100, () => console.log('[dev] api on http://localhost:4100'));

// Seed.
const base = 'http://127.0.0.1:4100/api';
let cookie = '';
const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() || [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  return res.json().catch(() => null);
};
await new Promise((r) => setTimeout(r, 300));
await call('POST', '/auth/register', { email: 'admin@test.local', password: 'password123', name: 'Aryan' });
const { project, nodes } = await call('POST', '/design/projects', { name: 'WhatsApp', icon: '💬', hue: 'green', template: 'system' });
await call('POST', '/design/projects', { name: 'URL shortener', icon: '🔗', hue: 'blue', template: 'blank' });
const board = nodes.find((n) => n.name === 'Architecture');
console.log(`[dev] seeded project ${project.id}, board ${board.id}`);
console.log(`[dev] open http://localhost:3100/design/${project.id}/${board.id}`);
