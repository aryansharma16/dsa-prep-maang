import assert from 'node:assert/strict';
import { test } from 'node:test';
import { childrenOf, depthOf, heightOf, indexNodes, isWithin, orderAmong, subtreeIds } from '../tree.js';

//  root
//  ├── hld (folder)          a0
//  │   ├── arch (board)      a0
//  │   └── deep (folder)     a1
//  │       └── deeper        a0
//  └── db (folder)           a1
const nodes = [
  { _id: 'hld', parent: null, kind: 'folder', order: 'a0' },
  { _id: 'arch', parent: 'hld', kind: 'board', order: 'a0' },
  { _id: 'deep', parent: 'hld', kind: 'folder', order: 'a1' },
  { _id: 'deeper', parent: 'deep', kind: 'board', order: 'a0' },
  { _id: 'db', parent: null, kind: 'folder', order: 'a1' },
];
const byId = indexNodes(nodes);
const children = childrenOf(nodes);

test('depth and height', () => {
  assert.equal(depthOf(byId, null), 0);
  assert.equal(depthOf(byId, 'hld'), 1);
  assert.equal(depthOf(byId, 'deeper'), 3);
  assert.equal(heightOf(children, 'hld'), 2);
  assert.equal(heightOf(children, 'arch'), 0);
});

test('isWithin catches moving a folder into its own subtree', () => {
  assert.equal(isWithin(byId, 'deeper', 'hld'), true);
  assert.equal(isWithin(byId, 'hld', 'hld'), true);
  assert.equal(isWithin(byId, 'db', 'hld'), false);
});

test('subtreeIds', () => {
  assert.deepEqual(subtreeIds(children, 'hld').sort(), ['arch', 'deep', 'deeper', 'hld']);
  assert.deepEqual(subtreeIds(children, 'db'), ['db']);
});

test('orderAmong: append, prepend, after, stale after', () => {
  const roots = nodes.filter((n) => n.parent === null);
  assert.equal(orderAmong(roots, undefined), 'a2');
  assert.ok(orderAmong(roots, null) < 'a0');
  const between = orderAmong(roots, 'hld');
  assert.ok('a0' < between && between < 'a1');
  assert.equal(orderAmong(roots, 'vanished'), 'a2');
  // Moving `db` to after `hld` must ignore db's own current slot.
  const moved = orderAmong(roots, 'hld', 'db');
  assert.ok('a0' < moved);
});

test('cycles in bad data do not hang', () => {
  const loop = indexNodes([
    { _id: 'x', parent: 'y' },
    { _id: 'y', parent: 'x' },
  ]);
  assert.ok(depthOf(loop, 'x') <= 2);
  assert.equal(isWithin(loop, 'x', 'z'), false);
});
