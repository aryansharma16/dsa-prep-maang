import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOrderKey, keyBetween, keysBetween } from '../fractionalIndex.js';

/*
  The same table lives in client/src/design/__tests__/fractional.test.js. The
  server orders tree nodes and the client orders elements, and a key minted on
  one side is compared on the other — so both copies have to agree exactly.
*/
export const VECTORS = [
  [null, null, 'a0'],
  [null, 'a0', 'Zz'],
  [null, 'Zz', 'Zy'],
  ['a0', null, 'a1'],
  ['a1', null, 'a2'],
  ['a0', 'a1', 'a0V'],
  ['a1', 'a2', 'a1V'],
  ['a0V', 'a1', 'a0l'],
  ['Zz', 'a0', 'ZzV'],
  ['Zz', 'a1', 'a0'],
  [null, 'Y00', 'Xzzz'],
  ['bzz', null, 'c000'],
  ['a0', 'a0V', 'a0G'],
  ['a0', 'a0G', 'a08'],
  ['b125', 'b129', 'b127'],
  ['a0', 'a1V', 'a1'],
  ['Zz', 'a01', 'a0'],
  [null, 'a0V', 'a0'],
  [null, 'b999', 'b99'],
  ['zzzzzzzzzzzzzzzzzzzzzzzzzzy', null, 'zzzzzzzzzzzzzzzzzzzzzzzzzzz'],
  ['zzzzzzzzzzzzzzzzzzzzzzzzzzz', null, 'zzzzzzzzzzzzzzzzzzzzzzzzzzzV'],
];

test('keyBetween matches the reference vectors', () => {
  for (const [a, b, expected] of VECTORS) {
    assert.equal(keyBetween(a, b), expected, `keyBetween(${a}, ${b})`);
  }
});

test('keyBetween rejects malformed and out-of-order input', () => {
  assert.throws(() => keyBetween('a1', 'a0'));
  assert.throws(() => keyBetween('a0', 'a0'));
  assert.throws(() => keyBetween('a00', null)); // trailing zero
  assert.throws(() => keyBetween('A00000000000000000000000000', null));
  assert.throws(() => keyBetween('?', null));
});

test('keysBetween is ascending and strictly inside the bounds', () => {
  for (const [a, b] of [
    [null, null],
    ['a0', null],
    [null, 'a0'],
    ['a0', 'a1'],
  ]) {
    const keys = keysBetween(a, b, 25);
    assert.equal(keys.length, 25);
    for (let i = 0; i < keys.length; i += 1) {
      if (i > 0) assert.ok(keys[i - 1] < keys[i], `${keys[i - 1]} < ${keys[i]}`);
      if (a) assert.ok(a < keys[i]);
      if (b) assert.ok(keys[i] < b);
    }
  }
});

test('repeated inserts at one spot stay short and ordered', () => {
  let lo = 'a0';
  const hi = 'a1';
  for (let i = 0; i < 200; i += 1) {
    const mid = keyBetween(lo, hi);
    assert.ok(lo < mid && mid < hi);
    lo = mid;
  }
  assert.ok(lo.length < 64, `grew to ${lo.length}`);

  let last = null;
  for (let i = 0; i < 5000; i += 1) last = keyBetween(last, null);
  assert.ok(last.length <= 4, `append-only grew to ${last.length}`);
});

test('isOrderKey', () => {
  assert.equal(isOrderKey('a0'), true);
  assert.equal(isOrderKey('a0V'), true);
  assert.equal(isOrderKey('a00'), false);
  assert.equal(isOrderKey(''), false);
  assert.equal(isOrderKey('a0.'), false);
  assert.equal(isOrderKey(42), false);
  assert.equal(isOrderKey('a'.repeat(65)), false);
});
