import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutStructure, parseLevelOrder, STRUCTURE_KINDS } from '../library/structures.js';

function assertInside({ w, h, parts }, label) {
  assert.ok(Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0, `${label}: size ${w}×${h}`);
  const inside = (x, y) => x >= -0.5 && y >= -0.5 && x <= w + 0.5 && y <= h + 0.5;
  for (const p of parts) {
    if (p.t === 'rect' || p.t === 'cylinder') assert.ok(inside(p.x, p.y) && inside(p.x + p.w, p.y + p.h), `${label}: ${JSON.stringify(p)} outside ${w}×${h}`);
    if (p.t === 'circle') assert.ok(inside(p.cx - p.r, p.cy - p.r) && inside(p.cx + p.r, p.cy + p.r), `${label}: circle outside`);
    if (p.t === 'line' || p.t === 'arrow') for (const [x, y] of p.points) assert.ok(inside(x, y), `${label}: ${p.t} point ${x},${y} outside ${w}×${h}`);
    if (p.t === 'text') assert.ok(inside(p.x, p.y), `${label}: text "${p.text}" anchor outside`);
  }
}

test('every kind lays out its example inside its own box, in both orientations and all sizes', () => {
  for (const kind of STRUCTURE_KINDS) {
    for (const orientation of ['h', 'v']) {
      for (const size of ['s', 'm', 'l']) {
        const layout = layoutStructure({ kind: kind.id, text: kind.example, orientation, size, title: 'A title' });
        assertInside(layout, `${kind.id}/${orientation}/${size}`);
      }
    }
    // Empty content draws a placeholder rather than nothing.
    const empty = layoutStructure({ kind: kind.id, text: '' });
    assert.ok(empty.parts.length > 0, `${kind.id} empty`);
  }
});

test('highlight marker, stack order, and sizes that grow with content', () => {
  const array = layoutStructure({ kind: 'array', text: '1\n*22\n3', orientation: 'h' });
  const texts = array.parts.filter((p) => p.t === 'text' && !p.muted);
  assert.deepEqual(texts.map((t) => [t.text, Boolean(t.hot)]), [['1', false], ['22', true], ['3', false]]);

  // A horizontal stack puts the first line (the top) at the right end.
  const stack = layoutStructure({ kind: 'stack', text: 'top\nmid\nbottom', orientation: 'h' });
  const values = stack.parts.filter((p) => p.t === 'text' && !p.muted).sort((a, b) => a.x - b.x).map((p) => p.text);
  assert.deepEqual(values, ['bottom', 'mid', 'top']);

  const short = layoutStructure({ kind: 'queue', text: 'a\nb' });
  const long = layoutStructure({ kind: 'queue', text: 'a\nb\nc\nd\ne\nf' });
  assert.ok(long.w > short.w);
  const wide = layoutStructure({ kind: 'array', text: 'a much longer value' });
  assert.ok(wide.w > layoutStructure({ kind: 'array', text: 'a' }).w);
});

test('parseLevelOrder follows LeetCode: children of null are skipped, not reserved', () => {
  const root = parseLevelOrder('[1,null,2,3]');
  assert.equal(root.text, '1');
  assert.equal(root.left, null);
  assert.equal(root.right.text, '2');
  assert.equal(root.right.left.text, '3');
  assert.equal(root.right.right, null);

  const full = parseLevelOrder('5 3 8 *1 4');
  assert.equal(full.left.left.text, '1');
  assert.equal(full.left.left.hot, true);
  assert.equal(full.left.right.text, '4');
  assert.equal(parseLevelOrder('[]'), null);
  assert.equal(parseLevelOrder('null'), null);

  // In-order x positions never overlap.
  const tree = layoutStructure({ kind: 'tree', text: '[8,3,10,1,6,null,14,null,null,4,7,13]' });
  const circles = tree.parts.filter((p) => p.t === 'circle');
  assert.equal(circles.length, 9); // 8, 3, 10, 1, 6, 14, 4, 7, 13
  for (let i = 0; i < circles.length; i += 1) {
    for (let j = i + 1; j < circles.length; j += 1) {
      const d = Math.hypot(circles[i].cx - circles[j].cx, circles[i].cy - circles[j].cy);
      assert.ok(d >= circles[i].r + circles[j].r, 'nodes do not overlap');
    }
  }
});
