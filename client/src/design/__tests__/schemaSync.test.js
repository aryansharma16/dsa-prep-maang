import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeDbml } from '../schema/analyze.js';
import { highlightDbml } from '../schema/highlight.js';
import { tableSize } from '../schema/layout.js';
import { freeSpot, placeNewTables, reconcileTables, SETTLE_MS } from '../schema/reconcile.js';

const model = (src) => analyzeDbml(src);
const elementsFor = (m, ids = {}) => m.tables.map((t, i) => ({ id: ids[t.key] || `el${i}`, table: t.key, columns: t.columns.map((c) => c.name) }));

test('first text on an empty board creates every table at once', () => {
  const m = model('Table a {\n  id int\n}\nTable b {\n  id int\n}');
  const r = reconcileTables(m, []);
  assert.deepEqual(r.create, ['public.a', 'public.b']);
});

test('typing a name renames in place instead of creating and deleting', () => {
  let m = model('Table user {\n  id int\n}\nTable orders {\n  id int\n}');
  const elements = elementsFor(m, { 'public.user': 'u1', 'public.orders': 'o1' });
  m = model('Table users {\n  id int\n}\nTable orders {\n  id int\n}');
  const r = reconcileTables(m, elements);
  assert.deepEqual(r.rename, [{ id: 'u1', table: 'public.users' }]);
  assert.deepEqual([r.create, r.remove], [[], []]);
});

test('two changes at once pair by column overlap; unmatched ones wait to settle', () => {
  const before = model('Table a {\n  id int\n  x int\n  y int\n}\nTable b {\n  id int\n  p int\n}\nTable c {\n  id int\n}');
  const elements = elementsFor(before, { 'public.a': 'A', 'public.b': 'B', 'public.c': 'C' });
  // a → alpha (same columns), b removed, new table "zeta" typed.
  const after = model('Table alpha {\n  id int\n  x int\n  y int\n}\nTable c {\n  id int\n}\nTable zeta {\n  q int\n}');
  const t0 = 1_000_000;
  let r = reconcileTables(after, elements, undefined, t0);
  assert.deepEqual(r.rename, [{ id: 'A', table: 'public.alpha' }]);
  assert.deepEqual([r.create, r.remove], [[], []], 'nothing created or removed before settling');
  assert.ok(r.wakeIn > 0 && r.wakeIn <= SETTLE_MS);
  assert.ok(r.pending.added.has('public.zeta') && r.pending.removed.has('B'));

  // The caller applied the rename; later, with the same text, both settle.
  const renamed = elements.map((e) => (e.id === 'A' ? { ...e, table: 'public.alpha' } : e));
  r = reconcileTables(after, renamed, r.pending, t0 + SETTLE_MS + 1);
  assert.deepEqual([r.create, r.remove, r.rename], [['public.zeta'], ['B'], []]);

  // A table cut and pasted back within the settle time is never removed.
  const cut = model('Table alpha {\n  id int\n  x int\n  y int\n}\nTable zeta {\n  q int\n}');
  const placed = [...renamed.filter((e) => e.id !== 'B'), { id: 'Z', table: 'public.zeta', columns: ['q'] }];
  r = reconcileTables(cut, placed, undefined, t0);
  assert.deepEqual(r.remove, []);
  r = reconcileTables(after, placed, r.pending, t0 + 500);
  assert.deepEqual([r.remove, r.pending.removed.size], [[], 0]);
});

test('new tables are placed beside a related table, never on top of one', () => {
  const m = model('Table users {\n  id int\n}\nTable orders {\n  id int\n  user_id int [ref: > users.id]\n}\nTable audit {\n  id int\n}');
  const sizes = new Map(m.tables.map((t) => [t.key, tableSize(t)]));
  const positions = new Map([['public.users', { x: 0, y: 0 }]]);
  const placed = placeNewTables(m, positions, sizes, ['public.orders', 'public.audit']);
  const orders = placed.get('public.orders');
  assert.equal(orders.x, sizes.get('public.users').w + 120);
  const boxes = [...positions, ...placed].map(([k, p]) => ({ ...p, ...sizes.get(k) }));
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), 'no overlap');
    }
  }
});

test('highlighting: keywords, names, types, settings, strings, comments, operators', () => {
  const src = `// users\nTable users as U [headercolor: #fff] {\n  id int [pk, note: 'key']\n  "full name" varchar(120)\n}\nRef: a.b > c.d`;
  const kinds = highlightDbml(src).map((t) => `${t.kind}:${src.slice(t.start, t.end)}`);
  for (const expected of ['comment:// users', 'keyword:Table', 'name:users', 'keyword:as', 'setting:headercolor', 'color:#fff', 'type:int', 'setting:pk', 'setting:note', "string:'key'", 'type:varchar', 'number:120', 'keyword:Ref', 'op:>']) {
    assert.ok(kinds.includes(expected), `missing ${expected} in ${kinds.join(' ')}`);
  }
  // Never throws on half-typed input.
  for (const partial of ["Table t {\n  name varchar [note: 'unclosed", '/* open', "'''", '[[[', '}}}']) highlightDbml(partial);
});

import { indentEdit } from '../text/indent.js';

const applyEdit = (value, e) => value.slice(0, e.start) + e.insert + value.slice(e.end);

test('indentEdit: caret, one line, many lines, outdent', () => {
  const v = 'Table t {\nid int\nname text\n}';
  let e = indentEdit(v, 10, 10);
  assert.equal(applyEdit(v, e), 'Table t {\n  id int\nname text\n}');
  assert.deepEqual(e.selection, [12, 12]);

  // Two lines selected (from inside "id" to inside "name").
  e = indentEdit(v, 11, 20);
  const two = applyEdit(v, e);
  assert.equal(two, 'Table t {\n  id int\n  name text\n}');
  assert.equal(two.slice(e.selection[0], e.selection[1]), v.slice(11, 20).replace('\n', '\n  '));

  // Shift+Tab outdents the caret's line, even without a selection.
  e = indentEdit(two, 14, 14, true);
  assert.equal(applyEdit(two, e), 'Table t {\nid int\n  name text\n}');
  // Selection ending right after a newline leaves the next line alone.
  e = indentEdit(v, 10, 17);
  assert.equal(applyEdit(v, e), 'Table t {\n  id int\nname text\n}');
  // Outdent never eats text.
  e = indentEdit('x\n y', 0, 4, true);
  assert.equal(applyEdit('x\n y', e), 'x\ny');
});

test('freeSpot keeps the start when it is clear and otherwise finds the nearest clear place', () => {
  const size = { w: 180, h: 64 };
  assert.deepEqual(freeSpot([], size, { x: 10, y: 20 }), { x: 10, y: 20 });
  const taken = [{ x: 0, y: 0, w: 240, h: 120 }];
  const spot = freeSpot(taken, size, { x: 0, y: 0 });
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + size.w && a.y < b.y + b.h && b.y < a.y + size.h;
  assert.ok(!overlaps(spot, taken[0]), JSON.stringify(spot));
  assert.ok(Math.hypot(spot.x, spot.y) <= 260, 'next to it, not far away');
  // Crowded: still never on top of anything.
  const crowd = [];
  for (let i = -3; i <= 3; i += 1) for (let j = -3; j <= 3; j += 1) crowd.push({ x: i * 220, y: j * 104, w: 180, h: 64 });
  const far = freeSpot(crowd, size, { x: 0, y: 0 });
  assert.ok(crowd.every((b) => !overlaps(far, b)));
});
