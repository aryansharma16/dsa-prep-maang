import assert from 'node:assert/strict';
import { test } from 'node:test';
import { childrenMap, descendants, firstBoard, isWithin, pathTo, resolveDrop, visibleRows } from '../tree/tree.js';

const nodes = [
  { id: 'hld', parentId: null, kind: 'folder', name: 'HLD', order: 'a0' },
  { id: 'arch', parentId: 'hld', kind: 'board', boardKind: 'canvas', name: 'Architecture', order: 'a0' },
  { id: 'flows', parentId: 'hld', kind: 'board', boardKind: 'canvas', name: 'Flows', order: 'a1' },
  { id: 'db', parentId: null, kind: 'folder', name: 'DB', order: 'a1' },
  { id: 'schema', parentId: 'db', kind: 'board', boardKind: 'schema', name: 'Schema', order: 'a0' },
  { id: 'notes', parentId: null, kind: 'board', boardKind: 'canvas', name: 'Notes', order: 'a2' },
];
const map = childrenMap(nodes);
const byId = new Map(nodes.map((n) => [n.id, n]));

test('visible rows respect collapsed folders', () => {
  assert.deepEqual(
    visibleRows(map, new Set(['hld'])).map((r) => `${r.depth}:${r.node.id}`),
    ['0:hld', '1:arch', '1:flows', '0:db', '0:notes'],
  );
  assert.deepEqual(visibleRows(map, new Set()).map((r) => r.node.id), ['hld', 'db', 'notes']);
});

test('paths, first board, descendants, containment', () => {
  assert.deepEqual(pathTo(byId, 'schema').map((n) => n.id), ['db', 'schema']);
  assert.equal(firstBoard(map).id, 'arch');
  assert.deepEqual(descendants(map, 'hld').map((n) => n.id).sort(), ['arch', 'flows']);
  assert.equal(isWithin(byId, 'arch', 'hld'), true);
  assert.equal(isWithin(byId, 'schema', 'hld'), false);
});

test('resolveDrop: inside, before, after, and no-ops', () => {
  const inside = resolveDrop(map, byId, 'notes', byId.get('db'), 'inside');
  assert.equal(inside.parentId, 'db');
  assert.equal(inside.after, 'schema');
  assert.ok(inside.order > 'a0');

  const before = resolveDrop(map, byId, 'notes', byId.get('hld'), 'before');
  assert.equal(before.parentId, null);
  assert.equal(before.after, null);
  assert.ok(before.order < 'a0');

  const after = resolveDrop(map, byId, 'flows', byId.get('schema'), 'after');
  assert.equal(after.parentId, 'db');
  assert.equal(after.after, 'schema');

  // Dropping arch right after nothing in hld (where it already is) changes nothing.
  assert.equal(resolveDrop(map, byId, 'arch', byId.get('flows'), 'before'), null);
  // A folder cannot go into itself.
  assert.equal(resolveDrop(map, byId, 'hld', byId.get('hld'), 'inside'), null);
  // A board is not a drop target for "inside".
  assert.equal(resolveDrop(map, byId, 'notes', byId.get('arch'), 'inside'), null);
});
