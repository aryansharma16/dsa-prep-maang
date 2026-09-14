import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createAutosave } from '../sync/autosave.js';
import { MIRROR_LIVE_MS, mirrorKey, planRestore, readMirrors } from '../sync/mirror.js';

function fakeStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};
const put = (eid, x = 0) => ({ op: 'put', el: { eid, type: 'rect', parent: null, z: 'a0', data: { x } } });
const failure = (status, body) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: body } });

test('a failed batch is retried under the same id, ahead of newer edits', async (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  globalThis.localStorage = fakeStorage();
  t.after(() => delete globalThis.localStorage);

  const sent = [];
  let failures = 2;
  const autosave = createAutosave({
    boardId: 'b1',
    baseRev: 1,
    send: async (batch) => {
      sent.push(batch);
      if (failures > 0) {
        failures -= 1;
        throw failure(502);
      }
      return { rev: batch.baseRev + 1, rejected: [], changes: [] };
    },
  });

  autosave.enqueue([put('a', 1)]);
  mock.timers.tick(800);
  await settle();
  assert.equal(sent.length, 1);
  // A newer edit arrives while the first batch's fate is unknown.
  autosave.enqueue([put('b', 2)]);
  assert.deepEqual([...autosave.pendingIds()].sort(), ['a', 'b']);
  mock.timers.tick(60_000);
  await settle();
  mock.timers.tick(60_000);
  await settle();
  mock.timers.tick(60_000);
  await settle();

  const ids = sent.map((b) => b.batchId);
  assert.equal(ids[0], ids[1], 'first retry reuses the id');
  assert.equal(ids[1], ids[2], 'second retry reuses the id');
  assert.deepEqual(sent[2].ops.map((op) => op.el.eid), ['a'], 'the retried batch is exactly the original');
  assert.notEqual(sent[3].batchId, ids[0], 'the newer edit goes in a batch of its own');
  assert.deepEqual(sent[3].ops.map((op) => op.el.eid), ['b']);
  assert.equal(autosave.hasPending, false);
  assert.equal(globalThis.localStorage.map.size, 0, 'mirror removed once everything is saved');
  autosave.dispose();
});

test('413 splits the batch under new ids; 400 is not retried and does not block later saves', async (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const sent = [];
  let mode = '413';
  const autosave = createAutosave({
    boardId: 'b2',
    baseRev: 1,
    onFatal: () => {},
    send: async (batch) => {
      sent.push(batch);
      if (mode === '413' && batch.ops.length > 1) throw failure(413);
      if (mode === '400') {
        mode = 'ok';
        throw failure(400);
      }
      return { rev: 2, rejected: [], changes: [] };
    },
  });
  autosave.enqueue([put('a'), put('b'), put('c'), put('d')]);
  mock.timers.tick(800);
  await settle();
  await settle();
  await settle();
  const sizes = sent.map((b) => b.ops.length);
  assert.equal(sizes[0], 4);
  assert.ok(sizes.slice(1).every((n) => n <= 2), `split sizes ${sizes}`);
  assert.equal(new Set(sent.map((b) => b.batchId)).size, sent.length, 'every split batch has its own id');
  assert.equal(autosave.hasPending, false);

  mode = '400';
  sent.length = 0;
  autosave.enqueue([put('bad')]);
  mock.timers.tick(800);
  await settle();
  autosave.enqueue([put('good')]);
  mock.timers.tick(800);
  await settle();
  mock.timers.tick(60_000);
  await settle();
  assert.deepEqual(sent.map((b) => b.ops.map((op) => op.el.eid)), [['bad'], ['good']], 'the rejected batch is not retried');
  autosave.dispose();
});

test('mirrors: each tab writes its own key, and planRestore separates live, landed, silent and conflicting copies', () => {
  const store = fakeStorage();
  const now = 1_000_000;
  const write = (clientId, value) => store.setItem(mirrorKey('board', clientId), JSON.stringify({ v: 2, clientId, ...value }));
  write('live', { baseRev: 5, at: now - 2000, sent: [], ops: [put('l')] });
  write('reloaded', { baseRev: 7, at: now - 500, closed: true, sent: [], ops: [put('r')] });
  write('landed', { baseRev: 5, at: now - 60_000, sent: [{ batchId: 'b-landed', ops: [put('x')] }], ops: [] });
  write('quiet', { baseRev: 6, at: now - 60_000, sent: [{ batchId: 'b-lost', ops: [put('q1')] }], ops: [put('q2')] });
  write('behind', { baseRev: 2, at: now - 90_000, sent: [], ops: [put('old')] });
  store.setItem('sd-pending:board', JSON.stringify({ baseRev: 7, at: now - 120_000, ops: [put('legacy')] }));
  store.setItem(mirrorKey('other-board', 'z'), JSON.stringify({ clientId: 'z', baseRev: 1, at: 0, ops: [put('nope')] }));
  write('me', { baseRev: 7, at: now - 99_999, sent: [], ops: [put('mine')] });

  const mirrors = readMirrors('board', 'me', store);
  assert.deepEqual(mirrors.map((m) => m.clientId), [null, 'behind', 'landed', 'quiet', 'live', 'reloaded'], 'oldest first, own and other boards excluded');

  // The board is at rev 7: batch "b-landed" is among its recent batches.
  const plan = planRestore(mirrors, { rev: 7, recentBatches: ['b-landed', 'b-other'] }, now);
  assert.ok(plan.waitFor > 0 && plan.waitFor <= MIRROR_LIVE_MS, 'a live tab is waited for, not restored');
  assert.deepEqual(plan.remove, [mirrorKey('board', 'landed')], 'a mirror whose batch landed is just removed');
  // "quiet" was at rev 6 and its batch did not land, but the board is at 7 — someone else wrote.
  assert.deepEqual(plan.ask.ops.map((op) => op.el.eid).sort(), ['old', 'q1', 'q2'].sort());
  assert.deepEqual(plan.ask.keys.sort(), [mirrorKey('board', 'behind'), mirrorKey('board', 'quiet')].sort());
  // The legacy copy (rev 7, nothing landed) and the copy written as its page closed half a second ago restore without asking.
  assert.deepEqual(plan.silent.ops.map((op) => op.el.eid), ['legacy', 'r']);
  assert.deepEqual(plan.silent.keys, ['sd-pending:board', mirrorKey('board', 'reloaded')]);
});
