import assert from 'node:assert/strict';
import { test } from 'node:test';
import { opsFromCommit, opForChange } from '../engine/diff.js';
import { createHistory } from '../engine/history.js';
import { createStore } from '../engine/store.js';
import { coalesce, createOpQueue } from '../sync/opQueue.js';

const rect = (id, extra = {}) => ({ id, type: 'rect', parent: null, z: 'a0', data: { x: 0, y: 0, w: 10, h: 10 }, ...extra });

test('store: transact creates, updates immutably, and notifies precisely', () => {
  const store = createStore();
  let aCalls = 0;
  let rootCalls = 0;
  store.subscribeElement('a', () => (aCalls += 1));
  store.subscribeChildren(null, () => (rootCalls += 1));

  store.transact((tx) => {
    tx.create(rect('a'));
    tx.create(rect('b', { z: 'Zz' }));
  });
  assert.deepEqual(store.childIds(null), ['b', 'a']);
  assert.equal(aCalls, 1);
  assert.equal(rootCalls, 1);

  const before = store.get('a');
  const commit = store.transact((tx) => tx.update('a', { data: { x: 5 } }));
  assert.notEqual(store.get('a'), before);
  assert.equal(before.data.x, 0);
  assert.equal(store.get('a').data.x, 5);
  assert.equal(rootCalls, 1, 'a data-only change does not touch the parent list');
  assert.equal(commit.changes.get('a')[0], before);

  assert.equal(store.transact((tx) => tx.update('a', { data: { x: 5 } })), null, 'a no-op commits nothing');
});

test('store: gestures render live and commit once; cancel restores', () => {
  const store = createStore();
  store.transact((tx) => tx.create(rect('a')));
  const commits = [];
  store.onCommit((c) => commits.push(c));

  const g = store.beginGesture({ label: 'Move' });
  for (let i = 1; i <= 30; i += 1) g.update('a', { data: { x: i } });
  assert.equal(store.get('a').data.x, 30);
  assert.equal(commits.length, 0);
  g.commit();
  assert.equal(commits.length, 1);
  assert.equal(commits[0].changes.get('a')[0].data.x, 0);
  assert.equal(commits[0].changes.get('a')[1].data.x, 30);

  const g2 = store.beginGesture();
  g2.update('a', { data: { x: 99 } });
  g2.cancel();
  assert.equal(store.get('a').data.x, 30);
  assert.equal(commits.length, 1);
});

test('store: remote changes wait for a live gesture', () => {
  const store = createStore();
  store.transact((tx) => tx.create(rect('a')));
  const g = store.beginGesture();
  g.update('a', { data: { x: 1 } });
  store.applyRemote((tx) => tx.create(rect('r')));
  assert.equal(store.has('r'), false);
  g.commit();
  assert.equal(store.has('r'), true);
});

test('store: side effects cascade inside the same transaction', () => {
  const store = createStore({
    sideEffects: {
      beforeDelete(tx, record) {
        for (const child of tx.childIds(record.id)) tx.remove(child);
      },
    },
  });
  store.transact((tx) => {
    tx.create({ id: 'frame', type: 'frame', parent: null, z: 'a0', data: {} });
    tx.create(rect('kid1', { parent: 'frame' }));
    tx.create(rect('kid2', { parent: 'frame', z: 'a1' }));
  });
  const commit = store.transact((tx) => tx.remove('frame'));
  assert.equal(commit.changes.size, 3);
  assert.equal(store.size, 0);
});

test('history: undo and redo restore records and selection; mergeKey folds', () => {
  const store = createStore();
  let selection = [];
  const history = createHistory(store, { getSelection: () => selection, setSelection: (s) => (selection = s) });

  store.transact((tx) => tx.create(rect('a')), { label: 'Create', selectionBefore: [], selectionAfter: ['a'] });
  selection = ['a'];
  store.transact((tx) => tx.update('a', { data: { x: 1 } }), { mergeKey: 'nudge' });
  store.transact((tx) => tx.update('a', { data: { x: 2 } }), { mergeKey: 'nudge' });
  store.transact((tx) => tx.update('a', { data: { x: 3 } }), { mergeKey: 'nudge' });

  assert.equal(history.undo(), true);
  assert.equal(store.get('a').data.x, 0, 'one undo takes back the whole merged run');
  assert.equal(history.undo(), true);
  assert.equal(store.has('a'), false);
  assert.deepEqual(selection, []);
  assert.equal(history.redo(), true);
  assert.equal(store.has('a'), true);
  assert.deepEqual(selection, ['a']);
  assert.equal(history.redo(), true);
  assert.equal(store.get('a').data.x, 3);
  assert.equal(history.canRedo, false);
});

test('history ignores remote and undo commits', () => {
  const store = createStore();
  const history = createHistory(store);
  store.applyRemote((tx) => tx.create(rect('r')));
  assert.equal(history.canUndo, false);
});

test('diff: put, patch with set/unset, del', () => {
  const a = rect('a');
  const b = { ...a, z: 'a1', data: { x: 5, y: 0, w: 10, fill: 'red' } };
  assert.deepEqual(opForChange('a', a, b), { op: 'patch', eid: 'a', z: 'a1', set: { x: 5, fill: 'red' }, unset: ['h'] });
  assert.equal(opForChange('a', null, a).op, 'put');
  assert.deepEqual(opForChange('a', a, null), { op: 'del', eid: 'a' });
  assert.equal(opForChange('a', a, a), null);
  assert.equal(opForChange('a', a, { ...a, type: 'ellipse' }).op, 'put');

  const store = createStore();
  const commits = [];
  store.onCommit((c) => commits.push(c));
  store.transact((tx) => tx.create(rect('x')));
  assert.equal(opsFromCommit(commits[0])[0].el.eid, 'x');
});

test('queue: coalescing rules', () => {
  const put = { op: 'put', el: { eid: 'a', type: 'rect', parent: null, z: 'a0', data: { x: 0, y: 0, w: 1 } } };
  const patch1 = { op: 'patch', eid: 'a', set: { x: 1 }, unset: ['w'] };
  const patch2 = { op: 'patch', eid: 'a', z: 'a2', set: { w: 5 } };
  const del = { op: 'del', eid: 'a' };

  assert.deepEqual(coalesce(put, patch1).el.data, { x: 1, y: 0 });
  assert.deepEqual(coalesce(patch1, patch2), { op: 'patch', eid: 'a', z: 'a2', set: { x: 1, w: 5 } });
  assert.deepEqual(coalesce(put, del), del);
  assert.deepEqual(coalesce(del, put), put);
  assert.deepEqual(coalesce(del, patch1), del);
});

test('queue: take respects limits, requeue keeps newer edits on top', () => {
  const q = createOpQueue();
  for (let i = 0; i < 10; i += 1) q.add({ op: 'put', el: { eid: `e${i}`, type: 'rect', parent: null, z: 'a0', data: { x: i } } });
  q.add({ op: 'meta', set: { grid: 'dots' } });
  const batch = q.take({ maxOps: 4 });
  assert.equal(batch.length, 4);
  assert.equal(batch[0].op, 'meta');

  q.add({ op: 'patch', eid: 'e0', set: { x: 100 } });
  q.requeue(batch);
  const all = q.take({ maxOps: 100 });
  const e0 = all.find((op) => op.el?.eid === 'e0');
  assert.equal(e0.el.data.x, 100, 'the newer patch folds onto the requeued put');
  assert.ok(all.some((op) => op.op === 'meta'));
  assert.equal(q.size, 0);
});
