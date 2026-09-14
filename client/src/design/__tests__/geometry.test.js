import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aabbUnion,
  boxCorners,
  distToPolyline,
  distToSegment,
  inDiamond,
  inEllipse,
  outlineExit,
  pointAlongPolyline,
  rotatedBounds,
  segmentIntersectsAabb,
  toBoxLocal,
} from '../core/geometry.js';
import { clampZoom, fitBounds, screenToWorld, stepZoom, viewportBounds, worldToScreen, zoomAt } from '../engine/camera.js';
import { newId, newObjectId } from '../core/ids.js';
import { daysLeft, timeAgo } from '../core/time.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('rotated bounds and local frames round-trip', () => {
  const b = rotatedBounds(0, 0, 100, 50, Math.PI / 2);
  near(b.minX, 25);
  near(b.maxX, 75);
  near(b.minY, -25);
  near(b.maxY, 75);

  const corners = boxCorners(10, 20, 100, 50, 0.7);
  const local = toBoxLocal(corners[2].x, corners[2].y, 10, 20, 100, 50, 0.7);
  near(local.x, 100);
  near(local.y, 50);
});

test('shape hit tests', () => {
  assert.equal(inEllipse(50, 25, 100, 50), true);
  assert.equal(inEllipse(2, 2, 100, 50), false);
  assert.equal(inDiamond(50, 2, 100, 50), true);
  assert.equal(inDiamond(10, 5, 100, 50), false);
});

test('distances and intersections', () => {
  near(distToSegment(5, 5, 0, 0, 10, 0), 5);
  near(distToSegment(-3, 4, 0, 0, 10, 0), 5);
  near(distToPolyline(10, 5, [[0, 0], [10, 0], [10, 10]]), 0);
  const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  assert.equal(segmentIntersectsAabb(-5, 5, 15, 5, box), true);
  assert.equal(segmentIntersectsAabb(-5, -5, -1, 20, box), false);
  assert.deepEqual(aabbUnion([box, { minX: 5, minY: -2, maxX: 20, maxY: 3 }]), { minX: 0, minY: -2, maxX: 20, maxY: 10 });
});

test('pointAlongPolyline', () => {
  const p = pointAlongPolyline([[0, 0], [10, 0], [10, 10]], 0.75);
  near(p.x, 10);
  near(p.y, 5);
  near(p.angle, Math.PI / 2);
});

test('outline exits land on the outline', () => {
  const r = outlineExit('rect', 100, 50, 200, 25);
  near(r.x, 100);
  near(r.y, 25);
  const e = outlineExit('ellipse', 100, 50, 50, -100);
  near(e.x, 50);
  near(e.y, 0);
  const d = outlineExit('diamond', 100, 100, 100, 100);
  near(d.x, 75);
  near(d.y, 75);
});

test('camera: world/screen round-trip and zoom about a point', () => {
  const cam = { x: 120, y: -40, z: 1.7 };
  const s = worldToScreen(cam, 33, 44);
  const w = screenToWorld(cam, s.x, s.y);
  near(w.x, 33);
  near(w.y, 44);

  const zoomed = zoomAt(cam, 400, 300, 3);
  const before = screenToWorld(cam, 400, 300);
  const after = screenToWorld(zoomed, 400, 300);
  near(before.x, after.x);
  near(before.y, after.y);
  assert.equal(clampZoom(100), 8);
});

test('camera: fit, steps, viewport', () => {
  const cam = fitBounds({ minX: 0, minY: 0, maxX: 1000, maxY: 500 }, 1200, 800, { padding: 100, maxZoom: 2 });
  near(cam.z, 1);
  const v = viewportBounds(cam, 1200, 800);
  near((v.minX + v.maxX) / 2, 500);
  near((v.minY + v.maxY) / 2, 250);
  assert.equal(stepZoom(1, 1), 1.5);
  assert.equal(stepZoom(1, -1), 0.75);
  assert.equal(stepZoom(1.2, -1), 1);
});

test('ids', () => {
  const ids = new Set(Array.from({ length: 2000 }, () => newId()));
  assert.equal(ids.size, 2000);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9]{21}$/);
  assert.match(newObjectId(), /^[0-9a-f]{24}$/);
});

test('time', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  assert.equal(timeAgo('2026-09-14T11:59:50Z', now), 'just now');
  assert.equal(timeAgo('2026-09-14T09:00:00Z', now), '3 hours ago');
  assert.equal(timeAgo('2026-09-13T12:00:00Z', now), '1 day ago');
  assert.equal(daysLeft('2026-09-20T12:00:00Z', now), 6);
});
