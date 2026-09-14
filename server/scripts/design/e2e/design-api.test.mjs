// End-to-end checks for /api/design against a throwaway in-memory MongoDB replica set.
//
// Never touches the database in server/.env: the env is set before the app is imported,
// and it is run from this folder, which has no .env for dotenv to find.
// mongodb-memory-server is deliberately not a dependency; install it without saving:
//
//   cd server && npm i --no-save mongodb-memory-server@10
//   cd server/scripts/design/e2e && node --test design-api.test.mjs
//
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const SERVER = new URL('../../../src', import.meta.url).pathname;

let replSet;
let server;
let base;
let mongoose;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGO_URI: replSet.getUri('design-test'),
    JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret',
    CLIENT_URL: 'http://localhost:3003',
    SUPER_ADMIN_EMAIL: 'admin@test.local',
  });
  ({ default: mongoose } = await import(`${SERVER}/../node_modules/mongoose/index.js`));
  const { connectDb } = await import(`${SERVER}/config/db.js`);
  const { createApp } = await import(`${SERVER}/app.js`);
  await connectDb();
  await new Promise((resolve) => {
    server = createApp().listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  await mongoose?.disconnect();
  await replSet?.stop();
});

/* ------------------------------------------------------------ helpers */

function client() {
  let cookie = '';
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  };
  return {
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, b) => call('POST', p, b ?? {}),
    patch: (p, b) => call('PATCH', p, b),
    del: (p) => call('DELETE', p),
    raw: call,
  };
}

let batchSeq = 0;
const batch = (baseRev, ops, extra = {}) => ({
  batchId: `batch-${Date.now()}-${(batchSeq += 1)}`,
  clientId: 'tabA',
  baseRev,
  ops,
  ...extra,
});
const rect = (eid, data = {}) => ({
  op: 'put',
  el: { eid, type: 'rect', parent: null, z: 'a0', data: { x: 0, y: 0, w: 100, h: 60, ...data } },
});

const admin = client();
const user = client();
let project;
let nodes;
const byName = (name) => nodes.find((n) => n.name === name);

/* ------------------------------------------------------------ tests */

test('accounts', async () => {
  let r = await admin.post('/auth/register', { email: 'admin@test.local', password: 'password123', name: 'Admin' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  r = await user.post('/auth/register', { email: 'user@test.local', password: 'password123', name: 'User' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test('module ships hidden: 404 for a learner, previewable by the super admin', async () => {
  assert.equal((await user.get('/design/projects')).status, 404);
  const me = await user.get('/auth/me');
  assert.equal(me.body.modules.visible.includes('design'), false);

  const adminMe = await admin.get('/auth/me');
  assert.ok(adminMe.body.modules.visible.includes('design'));
  assert.ok(adminMe.body.modules.preview.includes('design'));
  const r = await admin.get('/design/projects');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.projects, []);
});

test('create a project with starter folders, idempotently', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const r = await admin.post('/design/projects', { id, name: 'WhatsApp', template: 'system', hue: 'green' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  project = r.body.project;
  nodes = r.body.nodes;
  assert.equal(nodes.filter((n) => n.kind === 'folder').length, 3);
  assert.equal(nodes.filter((n) => n.kind === 'board').length, 3);
  assert.equal(nodes.find((n) => n.boardKind === 'schema').name, 'Schema');
  assert.equal(project.boardCount, 3);

  const again = await admin.post('/design/projects', { id, name: 'WhatsApp', template: 'system' });
  assert.equal(again.status, 201);
  assert.equal(again.body.project.id, project.id);
  assert.equal(again.body.nodes.length, 6);

  const list = await admin.get('/design/projects');
  assert.equal(list.body.projects.length, 1);
  assert.equal(list.body.projects[0].boardCount, 3);
});

test('tree: create, rename, move, refuse cycles', async () => {
  const hld = byName('HLD');
  let r = await admin.post(`/design/projects/${project.id}/nodes`, { kind: 'folder', name: 'Deep', parentId: hld.id });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const deep = r.body.node;

  r = await admin.post(`/design/nodes/${hld.id}/move`, { parentId: deep.id });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'MOVE_INTO_SELF');

  r = await admin.post(`/design/nodes/${hld.id}/move`, { parentId: hld.id });
  assert.equal(r.body.error.code, 'MOVE_INTO_SELF');

  r = await admin.post(`/design/projects/${project.id}/nodes`, { kind: 'board', name: 'Bad', parentId: byName('Architecture').id, boardKind: 'canvas' });
  assert.equal(r.body.error.code, 'BAD_PARENT');

  r = await admin.post(`/design/projects/${project.id}/nodes`, { kind: 'board', name: 'NoKind', parentId: null });
  assert.equal(r.status, 400);

  // Move LLD to be first at the root.
  r = await admin.post(`/design/nodes/${byName('LLD').id}/move`, { parentId: null, after: null });
  assert.equal(r.status, 200);
  assert.ok(r.body.node.order < byName('HLD').order);

  r = await admin.patch(`/design/nodes/${deep.id}`, { name: 'Deeper' });
  assert.equal(r.body.node.name, 'Deeper');

  const tree = await admin.get(`/design/projects/${project.id}`);
  assert.equal(tree.body.nodes.length, 7);
  assert.equal(tree.body.role, 'owner');
  assert.ok(tree.body.treeRev >= 4);
  nodes = tree.body.nodes;
});

test('depth limit', async () => {
  let parentId = null;
  let r;
  for (let i = 0; i < 13; i += 1) {
    r = await admin.post(`/design/projects/${project.id}/nodes`, { kind: 'folder', name: `L${i}`, parentId });
    if (r.status !== 201) break;
    parentId = r.body.node.id;
  }
  assert.equal(r.body.error.code, 'TOO_DEEP');
});

let boardId;

test('ops: commit, idempotent replay, partial rejection', async () => {
  boardId = byName('Architecture').id;
  const b1 = batch(0, [
    rect('rectAAAA', { label: 'API' }),
    rect('rectBBBB', { x: 300 }),
    { op: 'put', el: { eid: 'connAAAA', type: 'connector', parent: null, z: 'a1', data: { start: { eid: 'rectAAAA' }, end: { eid: 'rectBBBB' } } } },
  ]);
  let r = await admin.post(`/design/boards/${boardId}/ops`, b1);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.rev, 1);
  assert.deepEqual(r.body.rejected, []);

  r = await admin.post(`/design/boards/${boardId}/ops`, b1);
  assert.equal(r.body.rev, 1);
  assert.equal(r.body.duplicate, true);

  r = await admin.post(
    `/design/boards/${boardId}/ops`,
    batch(1, [
      { op: 'patch', eid: 'rectAAAA', set: { x: 20, fill: 'blue' } },
      { op: 'patch', eid: 'rectBBBB', set: { x: 'not a number' } },
      { op: 'put', el: { eid: 'tableAAA', type: 'dbtable', parent: null, z: 'a2', data: { x: 0, y: 0, name: 'users' } } },
      { op: 'patch', eid: 'ghostAAA', set: { x: 1 } },
      { op: 'meta', set: { background: 'dots' } },
    ]),
  );
  assert.equal(r.body.rev, 2);
  const codes = Object.fromEntries(r.body.rejected.map((x) => [x.eid || x.op, x.code]));
  assert.deepEqual(codes, { rectBBBB: 'INVALID', tableAAA: 'WRONG_BOARD', ghostAAA: 'MISSING' });
  assert.equal(r.body.rejected.find((x) => x.eid === 'rectBBBB').current.data.x, 300);

  const board = await admin.get(`/design/boards/${boardId}`);
  assert.equal(board.status, 200);
  assert.equal(board.body.board.rev, 2);
  assert.equal(board.body.board.elementCount, 3);
  assert.deepEqual(board.body.board.meta, { background: 'dots' });
  const a = board.body.elements.find((e) => e.eid === 'rectAAAA');
  assert.equal(a.data.x, 20);
  assert.equal(a.data.label, 'API');
  assert.equal(a.rev, 2);
});

test('envelope errors: bad field names and bad JSON', async () => {
  let r = await admin.post(`/design/boards/${boardId}/ops`, batch(2, [{ op: 'patch', eid: 'rectAAAA', set: { '$where': 1 } }]));
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'VALIDATION');
  r = await admin.raw('POST', `/design/boards/${boardId}/ops`, '{"nope":', {});
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'BAD_JSON');
});

test('a stale tab gets the other writes back, and delta sync agrees', async () => {
  const r = await admin.post(`/design/boards/${boardId}/ops`, batch(0, [rect('rectCCCC', { x: 600 })], { clientId: 'tabB' }));
  assert.equal(r.body.rev, 3);
  const eids = r.body.changes.map((c) => c.eid).sort();
  assert.deepEqual(eids, ['connAAAA', 'rectAAAA', 'rectBBBB']);

  await admin.post(`/design/boards/${boardId}/ops`, batch(3, [{ op: 'del', eid: 'rectCCCC' }]));
  const since = await admin.get(`/design/boards/${boardId}/changes?since=3`);
  assert.equal(since.body.rev, 4);
  assert.deepEqual(since.body.changes, [{ eid: 'rectCCCC', rev: 4, deleted: true }]);

  const future = await admin.get(`/design/boards/${boardId}/changes?since=99`);
  assert.equal(future.body.reset, true);

  // Redo of the delete revives the tombstone.
  const redo = await admin.post(`/design/boards/${boardId}/ops`, batch(4, [rect('rectCCCC', { x: 601 })]));
  assert.deepEqual(redo.body.rejected, []);
  const board = await admin.get(`/design/boards/${boardId}`);
  assert.equal(board.body.board.elementCount, 4);
});

test('a board load lists recent batch ids, and a contested element comes back merged', async () => {
  const start = (await admin.get(`/design/boards/${boardId}`)).body.board.rev;
  const mine = batch(start, [rect('contest1', { x: 1, color: 'green' })]);
  await admin.post(`/design/boards/${boardId}/ops`, mine);
  const loaded = await admin.get(`/design/boards/${boardId}`);
  assert.ok(loaded.body.board.recentBatches.includes(mine.batchId), 'a reopening client can tell its save landed');

  // Another device recolours it; this tab, still at the old rev, moves it.
  await admin.post(`/design/boards/${boardId}/ops`, batch(start + 1, [{ op: 'patch', eid: 'contest1', set: { color: 'red' } }], { clientId: 'phone' }));
  const r = await admin.post(`/design/boards/${boardId}/ops`, batch(start + 1, [{ op: 'patch', eid: 'contest1', set: { y: 50 } }]));
  const back = r.body.changes.find((c) => c.eid === 'contest1');
  assert.ok(back, 'the element this batch touched, which someone else also changed, is returned');
  assert.deepEqual([back.data.color, back.data.y, back.rev], ['red', 50, r.body.rev]);
});

test('concurrent saves to one board serialise into distinct revs', async () => {
  const before = (await admin.get(`/design/boards/${boardId}`)).body.board;
  const start = before.rev;
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      admin.post(`/design/boards/${boardId}/ops`, batch(start, [rect(`concur${String(i).padStart(2, '0')}`, { x: i * 10 })])),
    ),
  );
  for (const r of results) assert.equal(r.status, 200, JSON.stringify(r.body));
  const revs = results.map((r) => r.body.rev).sort((a, b) => a - b);
  assert.deepEqual(revs, Array.from({ length: 12 }, (_, i) => start + i + 1));
  const board = await admin.get(`/design/boards/${boardId}`);
  assert.equal(board.body.board.elementCount, before.elementCount + 12);
});

test('conditional GET answers 304 until the board changes', async () => {
  const first = await admin.get(`/design/boards/${boardId}`);
  const etag = first.headers.get('etag');
  assert.ok(etag);
  const second = await admin.get(`/design/boards/${boardId}`, { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' });
  assert.equal(second.status, 304);
  await admin.post(`/design/boards/${boardId}/ops`, batch(first.body.board.rev, [{ op: 'patch', eid: 'rectAAAA', set: { x: 21 } }]));
  const third = await admin.get(`/design/boards/${boardId}`, { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' });
  assert.equal(third.status, 200);
});

test('body limits: 2MB for saves, 1MB elsewhere', async () => {
  const big = batch(0, [rect('rectBIGG', { note: 'x'.repeat(19_000) })]);
  big.ops = Array.from({ length: 150 }, (_, i) => rect(`big${String(i).padStart(5, '0')}`, { note: 'x'.repeat(19_000) }));
  const r = await admin.raw('POST', `/design/boards/${boardId}/ops`, JSON.stringify(big), {});
  assert.equal(r.status, 413);
  assert.equal(r.body.error.code, 'PAYLOAD_TOO_LARGE');

  const tasks = await admin.raw('POST', '/tasks', JSON.stringify({ title: 'x'.repeat(1_200_000) }), {});
  assert.equal(tasks.status, 413);
});

test('schema boards: compare-and-set on the DBML source', async () => {
  const schemaId = byName('Schema').id;
  let r = await admin.post(`/design/boards/${schemaId}/ops`, batch(0, [
    { op: 'source', base: 0, text: 'Table users {\n  id uuid [pk]\n}' },
    { op: 'put', el: { eid: 'tblusers', type: 'dbtable', parent: null, z: 'a0', data: { x: 10, y: 10, name: 'public.users' } } },
  ]));
  assert.deepEqual(r.body.rejected, []);
  const sourceRev = r.body.rev;

  r = await admin.post(`/design/boards/${schemaId}/ops`, batch(0, [{ op: 'source', base: 0, text: 'Table other {}' }], { clientId: 'tabB' }));
  const conflict = r.body.rejected.find((x) => x.code === 'SOURCE_CONFLICT');
  assert.ok(conflict);
  assert.equal(conflict.current.sourceRev, sourceRev);
  assert.match(conflict.current.source, /Table users/);

  const board = await admin.get(`/design/boards/${schemaId}`);
  assert.match(board.body.board.source, /Table users/);

  r = await admin.post(`/design/boards/${boardId}/ops`, batch(99, [{ op: 'source', base: 0, text: 'x' }]));
  assert.equal(r.body.rejected[0].code, 'NOT_SCHEMA');
});

test('duplicate a board', async () => {
  const r = await admin.post(`/design/nodes/${boardId}/duplicate`, {});
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.node.name, 'Architecture copy');
  const copy = await admin.get(`/design/boards/${r.body.node.id}`);
  const original = await admin.get(`/design/boards/${boardId}`);
  assert.equal(copy.body.elements.length, original.body.elements.length);
  assert.equal(copy.body.board.elementCount, original.body.board.elementCount);
  assert.equal(copy.body.board.rev, 1);
});

test('trash: delete a folder, restore exactly what went with it, purge', async () => {
  const hld = byName('HLD');
  // A board trashed on its own first...
  const extra = await admin.post(`/design/projects/${project.id}/nodes`, { kind: 'board', name: 'Scratch', boardKind: 'canvas', parentId: hld.id });
  await admin.del(`/design/nodes/${extra.body.node.id}`);
  // ...then the folder.
  let r = await admin.del(`/design/nodes/${hld.id}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.ids.length >= 3);

  assert.equal((await admin.get(`/design/boards/${boardId}`)).status, 410);
  assert.equal((await admin.post(`/design/boards/${boardId}/ops`, batch(0, [rect('afterdel')]))).status, 410);

  const trash = await admin.get('/design/trash');
  const roots = trash.body.nodes.map((n) => n.node.name).sort();
  assert.deepEqual(roots, ['HLD', 'Scratch']);

  r = await admin.post(`/design/nodes/${boardId}/restore`);
  assert.equal(r.body.error.code, 'NOT_TRASH_ROOT');

  r = await admin.post(`/design/nodes/${hld.id}/restore`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.nodes.some((n) => n.name === 'Scratch'), false);
  assert.equal((await admin.get(`/design/boards/${boardId}`)).status, 200);
  assert.equal((await admin.get(`/design/boards/${extra.body.node.id}`)).status, 410);

  r = await admin.del(`/design/nodes/${hld.id}/permanent`);
  assert.equal(r.body.error.code, 'NOT_IN_TRASH');
  r = await admin.del(`/design/nodes/${extra.body.node.id}/permanent`);
  assert.equal(r.status, 200);
  assert.equal((await admin.get(`/design/boards/${extra.body.node.id}`)).status, 404);
});

test('a restored node whose folder is gone lands at the root', async () => {
  const lld = byName('LLD');
  const board = nodes.find((n) => n.parentId === lld.id);
  await admin.del(`/design/nodes/${board.id}`);
  await admin.del(`/design/nodes/${lld.id}`);
  // Restoring the board on its own: its folder is still in the trash, so it lands at the root.
  let r = await admin.post(`/design/nodes/${board.id}/restore`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const tree = await admin.get(`/design/projects/${project.id}`);
  assert.equal(tree.body.nodes.find((n) => n.id === board.id).parentId, null);
  // Purging the folder no longer takes the board, which has moved out from under it.
  r = await admin.del(`/design/nodes/${lld.id}/permanent`);
  assert.equal(r.status, 200);
  assert.equal((await admin.get(`/design/boards/${board.id}`)).status, 200);
});

test('ownership: once shown, another account still cannot see this project', async () => {
  const shown = await admin.patch('/admin/modules', { key: 'design', hidden: false });
  assert.equal(shown.status, 200, JSON.stringify(shown.body));
  // Settings are cached per process; the PATCH invalidates.
  const mine = await user.get('/design/projects');
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.projects, []);
  assert.equal((await user.get(`/design/projects/${project.id}`)).status, 404);
  assert.equal((await user.get(`/design/boards/${boardId}`)).status, 404);
  assert.equal((await user.post(`/design/boards/${boardId}/ops`, batch(0, [rect('intruder')]))).status, 404);
  assert.equal((await user.patch(`/design/nodes/${byName('HLD').id}`, { name: 'pwned' })).status, 404);

  // Hiding again re-hides, and the default no longer applies once decided.
  await admin.patch('/admin/modules', { key: 'design', hidden: true });
  assert.equal((await user.get('/design/projects')).status, 404);
  await admin.patch('/admin/modules', { key: 'design', hidden: false });
  assert.equal((await user.get('/design/projects')).status, 200);
});

test('archived projects are read-only; trash and purge a project', async () => {
  let r = await admin.patch(`/design/projects/${project.id}`, { archived: true });
  assert.equal(r.body.project.archived, true);
  r = await admin.post(`/design/boards/${boardId}/ops`, batch(0, [rect('archived')]));
  assert.equal(r.body.error.code, 'PROJECT_ARCHIVED');
  assert.equal((await admin.get(`/design/boards/${boardId}`)).status, 200);
  await admin.patch(`/design/projects/${project.id}`, { archived: false });

  r = await admin.del(`/design/projects/${project.id}/permanent`);
  assert.equal(r.body.error.code, 'NOT_IN_TRASH');
  await admin.del(`/design/projects/${project.id}`);
  assert.equal((await admin.get(`/design/projects/${project.id}`)).status, 404);
  assert.equal((await admin.get('/design/trash')).body.projects.length, 1);
  r = await admin.del(`/design/projects/${project.id}/permanent`);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.elements > 0);
  const { DesignElement } = await import(`${SERVER}/models/DesignElement.js`);
  assert.equal(await DesignElement.countDocuments({}), 0);
});

test('unknown design routes 404 without falling through', async () => {
  const r = await admin.post('/design/nope', {});
  assert.equal(r.status, 404);
});
