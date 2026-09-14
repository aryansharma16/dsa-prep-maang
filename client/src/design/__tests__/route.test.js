import assert from 'node:assert/strict';
import { test } from 'node:test';
import { segmentIntersectsAabb } from '../core/geometry.js';
import { connectorGeometry } from '../engine/connectors/route.js';

const box = (x, y, w = 100, h = 60) => ({ x, y, w, h, rot: 0, outline: 'rect' });
const inner = (b) => ({ minX: b.x + 2, minY: b.y + 2, maxX: b.x + b.w - 2, maxY: b.y + b.h - 2 });

function assertAvoids(points, b) {
  for (let i = 1; i < points.length; i += 1) {
    assert.equal(
      segmentIntersectsAabb(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], inner(b)),
      false,
      `segment ${JSON.stringify(points[i - 1])}→${JSON.stringify(points[i])} cuts through ${JSON.stringify(b)}`,
    );
  }
}

const connector = (id, data) => ({ id, type: 'connector', parent: null, z: 'a0', data: { route: 'elbow', ...data } });

test('elbow routes are orthogonal and never cut through the shapes they join', () => {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 300; i += 1) {
    const a = box(rand() * 800, rand() * 600, 40 + rand() * 160, 30 + rand() * 120);
    const b = box(rand() * 800, rand() * 600, 40 + rand() * 160, 30 + rand() * 120);
    const overlapping = !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    if (overlapping) continue;
    const boxes = { A: a, B: b };
    const geo = connectorGeometry(connector(`c${i}`, { start: { eid: 'A' }, end: { eid: 'B' } }), (eid) => boxes[eid]);
    const { points } = geo;
    assert.ok(points.length >= 2);
    for (let j = 1; j < points.length; j += 1) {
      const horizontal = Math.abs(points[j][1] - points[j - 1][1]) < 0.01;
      const vertical = Math.abs(points[j][0] - points[j - 1][0]) < 0.01;
      assert.ok(horizontal || vertical || points.length === 2, 'segments are axis-aligned');
    }
    if (points.length > 2) {
      assertAvoids(points, a);
      assertAvoids(points, b);
    }
  }
});

test('side-by-side boxes join with a short direct route', () => {
  const boxes = { A: box(0, 0), B: box(300, 0) };
  const geo = connectorGeometry(connector('side', { start: { eid: 'A' }, end: { eid: 'B' } }), (eid) => boxes[eid]);
  assert.deepEqual(geo.points[0], [100, 30]);
  assert.deepEqual(geo.points.at(-1), [300, 30]);
  assert.equal(geo.points.length, 2);
  assert.ok(Math.abs(geo.end.angle) < 1e-9, 'arrow points right');
});

test('straight and curve routes; free ends', () => {
  const boxes = { A: box(0, 0), B: box(300, 200) };
  const straight = connectorGeometry(connector('s', { route: 'straight', start: { eid: 'A' }, end: { point: [500, 30] } }), (eid) => boxes[eid]);
  assert.equal(straight.points.length, 2);
  assert.deepEqual(straight.points.at(-1), [500, 30]);
  assert.equal(straight.points[0][0], 100, 'leaves A through its right edge');

  const curve = connectorGeometry(connector('c', { route: 'curve', start: { eid: 'A' }, end: { eid: 'B' } }), (eid) => boxes[eid]);
  assert.ok(curve.curve);
  assert.ok(curve.points.length > 10);

  const dangling = connectorGeometry(connector('d', { start: { eid: 'gone' }, end: { point: [10, 10] } }), () => null);
  assert.equal(dangling.points.length >= 2, true);
});
