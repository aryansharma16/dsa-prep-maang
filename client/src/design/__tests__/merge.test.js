import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchLines, mergeText } from '../schema/merge.js';

const BASE = `Table users {
  id int [pk]
  email varchar
}

Table orders {
  id int [pk]
  user_id int
}
`;

test('matchLines finds the longest common subsequence of lines', () => {
  const a = ['a', 'b', 'c', 'd', 'e'];
  const b = ['a', 'x', 'c', 'd', 'y', 'e'];
  assert.deepEqual(matchLines(a, b), [[0, 0], [2, 2], [3, 3], [4, 5]]);
  assert.deepEqual(matchLines([], ['a']), []);
  assert.deepEqual(matchLines(['a'], ['a']), [[0, 0]]);
});

test('changes in different places merge; the same change on both sides merges', () => {
  const mine = BASE.replace('email varchar', 'email varchar(255) [unique]');
  const theirs = BASE.replace('user_id int', 'user_id int [ref: > users.id]\n  total int');
  const merged = mergeText(BASE, mine, theirs);
  assert.equal(merged.conflicts, 0);
  assert.ok(merged.text.includes('email varchar(255) [unique]'));
  assert.ok(merged.text.includes('user_id int [ref: > users.id]\n  total int'));

  const both = BASE.replace('id int [pk]', 'id bigint [pk]');
  assert.deepEqual(mergeText(BASE, both, both), { text: both, conflicts: 0 });
  assert.equal(mergeText(BASE, BASE, theirs).text, theirs);
  assert.equal(mergeText(BASE, mine, BASE).text, mine);

  // Appends at the end by both sides, different content: a conflict at the tail only.
  const addA = `${BASE}\nTable a {\n  id int\n}\n`;
  const addB = `${BASE}\nTable b {\n  id int\n}\n`;
  assert.equal(mergeText(BASE, addA, addB).conflicts, 1);
});

test('the same line changed differently is a conflict, not a guess', () => {
  const mine = BASE.replace('email varchar', 'email text');
  const theirs = BASE.replace('email varchar', 'email citext');
  assert.deepEqual(mergeText(BASE, mine, theirs), { text: null, conflicts: 1 });
});
