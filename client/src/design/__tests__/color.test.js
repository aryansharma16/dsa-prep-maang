import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hexToHsv, hsvToHex, normalizeHex } from '../core/color.js';

test('normalizeHex accepts short and long hex, with or without #', () => {
  assert.equal(normalizeHex('#ABC'), '#aabbcc');
  assert.equal(normalizeHex('3b82f6'), '#3b82f6');
  assert.equal(normalizeHex('#12345'), null);
  assert.equal(normalizeHex('blue'), null);
});

test('hex → hsv → hex round-trips', () => {
  for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#3b82f6', '#a855f7', '#64748b', '#eab308']) {
    assert.equal(hsvToHex(hexToHsv(hex)), hex);
  }
  assert.deepEqual(hexToHsv('#ff0000'), { h: 0, s: 1, v: 1 });
  assert.equal(hsvToHex({ h: 120, s: 1, v: 1 }), '#00ff00');
});
