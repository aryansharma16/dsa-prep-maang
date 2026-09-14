import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESIGN_LIMITS } from '../../../config/design.js';
import { assertBoundedJson, opsSchema } from '../../../validation/designElements.js';
import { applyBoardLimits, foldMeta, foldOps } from '../ops.js';

const ctx = { boardKind: 'canvas' };
const rect = (eid, data = {}) => ({ op: 'put', el: { eid, type: 'rect', parent: null, z: 'a0', data: { x: 0, y: 0, w: 10, h: 10, ...data } } });
const doc = (eid, data = {}, extra = {}) => ({ eid, type: 'rect', parent: null, z: 'a0', data: { x: 0, y: 0, w: 10, h: 10, ...data }, bytes: 30, deletedAt: null, rev: 1, ...extra });

test('put creates, patch merges shallowly, del tombstones', () => {
  const stored = new Map([['existing1', doc('existing1', { fill: 'red', label: { text: 'a' } })]]);
  const { writes, rejected } = foldOps(
    stored,
    [
      rect('newrect1'),
      { op: 'patch', eid: 'existing1', set: { fill: 'blue', label: { text: 'b' } }, unset: ['w'] },
      { op: 'patch', eid: 'newrect1', z: 'a1', set: { x: 5 } },
    ],
    ctx,
  );
  assert.deepEqual(rejected, []);
  assert.equal(writes.get('newrect1').data.x, 5);
  assert.equal(writes.get('newrect1').z, 'a1');
  assert.equal(writes.get('newrect1').wasLive, false);
  const patched = writes.get('existing1');
  assert.equal(patched.data.fill, 'blue');
  assert.deepEqual(patched.data.label, { text: 'b' });
  assert.equal('w' in patched.data, false);

  const del = foldOps(stored, [{ op: 'del', eid: 'existing1' }], ctx);
  assert.equal(del.writes.get('existing1').deleted, true);
  assert.equal(del.writes.get('existing1').bytes, 0);
});

test('a patch to a missing element is rejected without sinking the batch', () => {
  const { writes, rejected } = foldOps(new Map(), [rect('goodrect'), { op: 'patch', eid: 'ghostrect', set: { x: 1 } }], ctx);
  assert.ok(writes.has('goodrect'));
  assert.deepEqual(rejected, [{ eid: 'ghostrect', code: 'MISSING', current: null }]);
});

test('put revives a tombstone (redo of a delete)', () => {
  const stored = new Map([['deadrect', doc('deadrect', {}, { deletedAt: new Date() })]]);
  const { writes } = foldOps(stored, [rect('deadrect', { x: 9 })], ctx);
  const w = writes.get('deadrect');
  assert.equal(w.deleted, false);
  assert.equal(w.wasLive, false);
  assert.equal(w.data.x, 9);
});

test('create then delete in one batch writes nothing', () => {
  const { writes, rejected } = foldOps(new Map(), [rect('tempory1'), { op: 'del', eid: 'tempory1' }], ctx);
  assert.equal(writes.size, 0);
  assert.equal(rejected.length, 0);
});

test('invalid final state is rejected and reports the stored copy', () => {
  const stored = new Map([['existing1', doc('existing1')]]);
  const { writes, rejected } = foldOps(stored, [{ op: 'patch', eid: 'existing1', set: { x: 'nope' } }], ctx);
  assert.equal(writes.size, 0);
  assert.equal(rejected[0].code, 'INVALID');
  assert.equal(rejected[0].current.eid, 'existing1');
});

test('per-type rules: urls, strokes, connectors, dbtables', () => {
  const bad = (el) => foldOps(new Map(), [{ op: 'put', el: { parent: null, z: 'a0', ...el } }], ctx).rejected[0]?.code;
  assert.equal(bad({ eid: 'embed001', type: 'embed', data: { x: 0, y: 0, url: 'javascript:alert(1)' } }), 'INVALID');
  assert.equal(bad({ eid: 'embed002', type: 'embed', data: { x: 0, y: 0, url: 'https://youtu.be/x' } }), undefined);
  assert.equal(bad({ eid: 'stroke01', type: 'stroke', data: { x: 0, y: 0, points: [1, 2] } }), 'INVALID');
  assert.equal(bad({ eid: 'stroke02', type: 'stroke', data: { x: 0, y: 0, points: [1, 2, 0.5] } }), undefined);
  assert.equal(bad({ eid: 'conn0001', type: 'connector', data: { start: {}, end: { point: [0, 0] } } }), 'INVALID');
  assert.equal(bad({ eid: 'conn0002', type: 'connector', data: { start: { eid: 'rect0001' }, end: { point: [0, 0] } } }), undefined);
  assert.equal(bad({ eid: 'table001', type: 'dbtable', data: { x: 0, y: 0, name: 'users' } }), 'WRONG_BOARD');
  assert.equal(bad({ eid: 'rect0001', type: 'rect', data: { x: 0, y: 0, $where: 1 } }), 'INVALID');
});

test('passthrough keeps fields the server does not know about', () => {
  const { writes } = foldOps(new Map(), [rect('futurist', { sparkle: { on: true } })], ctx);
  assert.deepEqual(writes.get('futurist').data.sparkle, { on: true });
});

test('board limits refuse growth but never shrinkage or deletes', () => {
  const stored = new Map([['existing1', doc('existing1')]]);
  const board = { elementCount: DESIGN_LIMITS.elementsPerBoard, bytes: 100 };
  const folded = foldOps(stored, [rect('onetoomany'), { op: 'del', eid: 'existing1' }], ctx);
  // The delete frees one slot, so the create fits.
  applyBoardLimits(folded, board, stored);
  assert.ok(folded.writes.has('onetoomany'));

  const full = foldOps(stored, [rect('onetoomany'), { op: 'patch', eid: 'existing1', set: { x: 3 } }], ctx);
  applyBoardLimits(full, board, stored);
  assert.equal(full.writes.has('onetoomany'), false);
  assert.ok(full.writes.has('existing1'));
  assert.equal(full.rejected[0].code, 'BOARD_FULL');
});

test('meta folds and is capped', () => {
  assert.equal(foldMeta({ grid: 'dots' }, []), undefined);
  assert.deepEqual(foldMeta({ grid: 'dots' }, [{ op: 'meta', set: { snap: true } }]), { grid: 'dots', snap: true });
  assert.equal(foldMeta({}, [{ op: 'meta', set: { big: 'x'.repeat(5000) } }]), null);
});

test('assertBoundedJson', () => {
  assert.doesNotThrow(() => assertBoundedJson({ a: [1, 2, { b: 'c' }], d: null }));
  assert.throws(() => assertBoundedJson({ 'a.b': 1 }));
  assert.throws(() => assertBoundedJson(JSON.parse('{"__proto__": {"x": 1}}')));
  assert.throws(() => assertBoundedJson({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }));
  assert.throws(() => assertBoundedJson({ n: Infinity }));
  assert.throws(() => assertBoundedJson({ d: new Date() }));
});

test('envelope', () => {
  const ok = { batchId: 'b-12345678', clientId: 'tab1', baseRev: 0, ops: [rect('rect0001')] };
  assert.equal(opsSchema.safeParse(ok).success, true);
  assert.equal(opsSchema.safeParse({ ...ok, ops: [] }).success, false);
  assert.equal(opsSchema.safeParse({ ...ok, extra: 1 }).success, false);
  assert.equal(
    opsSchema.safeParse({ ...ok, ops: [{ op: 'patch', eid: 'rect0001', set: { 'a.b': 1 } }] }).success,
    false,
  );
  assert.equal(
    opsSchema.safeParse({
      ...ok,
      ops: [
        { op: 'source', base: 0, text: 'a' },
        { op: 'source', base: 0, text: 'b' },
      ],
    }).success,
    false,
  );
});
