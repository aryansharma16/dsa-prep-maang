import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchLibrary } from '../library/search.js';
import { searchTech } from '../library/tech.js';

const ids = (section) => section.items.map((item) => item.id);

test('an empty query searches nothing', () => {
  assert.deepEqual(searchLibrary(''), []);
  assert.deepEqual(searchLibrary('   ', 'database'), []);
});

test('finds data structures and tables while the Tech tab is open', () => {
  const stack = searchLibrary('stack', 'tech');
  assert.equal(stack[0].id, 'structures', 'the block named Stack outranks tech that only mentions stacks');
  assert.deepEqual(ids(stack[0]).slice(0, 2), ['stack', 'callstack']);

  const join = searchLibrary('many to many', 'tech');
  assert.deepEqual(
    join.map((s) => s.id),
    ['database'],
  );
  assert.deepEqual(ids(join[0]), ['join']);

  assert.deepEqual(ids(searchLibrary('lifo').find((s) => s.id === 'structures')), ['stack']);
  assert.deepEqual(ids(searchLibrary('consistent hashing').find((s) => s.id === 'structures')), ['hashring']);
});

test('sections are ordered by their best match, ties going to the open tab', () => {
  // "user": the User client and the users table both start with it.
  assert.deepEqual(
    searchLibrary('user', 'tech').map((s) => s.id),
    ['tech', 'database'],
  );
  assert.deepEqual(
    searchLibrary('user', 'database').map((s) => s.id),
    ['database', 'tech'],
  );
  // "queue": the Queue block (name starts) beats Message queue (name contains), whichever tab is open.
  assert.equal(searchLibrary('queue', 'database')[0].id, 'structures');
});

test('only sections with matches, and tech ranks exactly as searchTech does', () => {
  const redis = searchLibrary('redis', 'structures');
  assert.deepEqual(
    redis.map((s) => s.id),
    ['tech'],
  );
  assert.deepEqual(ids(redis[0]), searchTech('redis').map((entry) => entry.id));
  assert.deepEqual(searchLibrary('zzzz-nothing'), []);
});
