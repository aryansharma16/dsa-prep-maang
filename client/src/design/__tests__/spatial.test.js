import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSpatialIndex } from '../core/spatial.js';

function random(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const intersects = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
const sorted = (set) => [...set].sort();

test('spatial index answers exactly like a brute-force scan through inserts, moves and removals', () => {
  const rand = random(11);
  const index = createSpatialIndex(256);
  const boxes = new Map();
  const randomBox = () => {
    const x = (rand() - 0.5) * 20000;
    const y = (rand() - 0.5) * 20000;
    // Mostly ordinary sizes, a few enormous ones that go on the oversized list.
    const big = rand() < 0.03;
    const w = big ? 5000 + rand() * 40000 : 10 + rand() * 600;
    const h = big ? 5000 + rand() * 40000 : 10 + rand() * 400;
    return { minX: x, minY: y, maxX: x + w, maxY: y + h };
  };

  for (let step = 0; step < 4000; step += 1) {
    const roll = rand();
    const id = `e${Math.floor(rand() * 600)}`;
    if (roll < 0.6) {
      const box = randomBox();
      boxes.set(id, box);
      index.set(id, box);
    } else if (roll < 0.75) {
      boxes.delete(id);
      index.remove(id);
    } else {
      const q = randomBox();
      const expected = [...boxes].filter(([, b]) => intersects(b, q)).map(([key]) => key).sort();
      assert.deepEqual(sorted(index.query(q)), expected, `query ${JSON.stringify(q)} at step ${step}`);
    }
  }
  assert.equal(index.size, boxes.size);

  // A query covering everything, and a point query.
  const all = { minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 };
  assert.deepEqual(sorted(index.query(all)), [...boxes.keys()].sort());
  const [someId, someBox] = [...boxes][0];
  assert.ok(index.queryPoint((someBox.minX + someBox.maxX) / 2, (someBox.minY + someBox.maxY) / 2).has(someId));
});

test('invalid boxes remove, identical boxes are a no-op, clear empties', () => {
  const index = createSpatialIndex();
  index.set('a', { minX: 0, minY: 0, maxX: 10, maxY: 10 });
  index.set('a', { minX: 0, minY: 0, maxX: 10, maxY: 10 });
  assert.equal(index.size, 1);
  index.set('a', { minX: NaN, minY: 0, maxX: 10, maxY: 10 });
  assert.equal(index.has('a'), false);
  index.set('b', { minX: -600, minY: -600, maxX: -590, maxY: -590 });
  assert.deepEqual(sorted(index.queryPoint(-595, -595)), ['b']);
  assert.deepEqual(sorted(index.queryPoint(5, 5)), []);
  index.clear();
  assert.equal(index.size, 0);
});
