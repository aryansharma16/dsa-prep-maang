import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeDbml } from '../schema/analyze.js';
import { autoArrange, relationEnds, relationPath, SCHEMA_METRICS, tableSize } from '../schema/layout.js';

function randomSchema(seed, tables = 40) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const lines = [];
  for (let i = 0; i < tables; i += 1) {
    const cols = [`  id int [pk]`];
    const n = 1 + Math.floor(rand() * 8);
    for (let c = 0; c < n; c += 1) cols.push(`  col_${c}_${'x'.repeat(Math.floor(rand() * 20))} varchar(${10 + c})`);
    if (i > 0 && rand() < 0.8) cols.push(`  parent_id int [ref: > t${Math.floor(rand() * i)}.id]`);
    if (i > 2 && rand() < 0.2) cols.push(`  other_id int [ref: > t${Math.floor(rand() * i)}.id]`);
    lines.push(`Table t${i} {\n${cols.join('\n')}\n}`);
  }
  // A cycle, and a self reference.
  lines.push('Ref: t0.id > t3.id', 'Ref: t5.id > t5.id');
  return lines.join('\n');
}

test('auto-arrange never overlaps tables, is deterministic, and puts parents before children', () => {
  for (const seed of [3, 17, 99]) {
    const model = analyzeDbml(randomSchema(seed));
    assert.deepEqual(model.diagnostics.filter((d) => d.severity === 'error'), []);
    const sizes = new Map(model.tables.map((t) => [t.key, tableSize(t)]));
    const positions = autoArrange(model, sizes);
    assert.equal(positions.size, model.tables.length);
    const boxes = model.tables.map((t) => ({ key: t.key, ...positions.get(t.key), ...sizes.get(t.key) }));
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.ok(!overlap, `seed ${seed}: ${a.key} overlaps ${b.key}`);
      }
    }
    assert.deepEqual([...autoArrange(model, sizes)], [...positions], 'same input, same layout');
    // Outside the injected cycle, a referenced table sits in an earlier (or the same) column.
    let respected = 0;
    let total = 0;
    for (const r of model.relations) {
      if (r.from.table === r.to.table) continue;
      total += 1;
      if (positions.get(r.to.table).x < positions.get(r.from.table).x) respected += 1;
    }
    assert.ok(respected / total > 0.9, `seed ${seed}: only ${respected}/${total} edges point left`);
  }
});

test('table sizes follow the header/row metrics and grow with long names', () => {
  const model = analyzeDbml('Table a {\n  id int\n}\nTable b {\n  a_really_quite_long_column_name "timestamp with time zone"\n  x int\n}');
  const [a, b] = model.tables.map((t) => tableSize(t));
  assert.equal(a.h, SCHEMA_METRICS.headerH + SCHEMA_METRICS.rowH);
  assert.equal(b.h, SCHEMA_METRICS.headerH + 2 * SCHEMA_METRICS.rowH);
  assert.equal(a.w, SCHEMA_METRICS.minW);
  assert.ok(b.w > a.w && b.w <= SCHEMA_METRICS.maxW);
});

test('relation ends attach at column rows on facing sides, and paths are orthogonal', () => {
  const model = analyzeDbml('Table users {\n  id int [pk]\n  name text\n}\nTable orders {\n  id int [pk]\n  note text\n  user_id int [ref: > users.id]\n}');
  const [users, orders] = model.tables;
  const usersBox = { x: 0, y: 0, ...tableSize(users) };
  const ordersBox = { x: 400, y: 100, ...tableSize(orders) };
  const ends = relationEnds(model.relations[0], orders, ordersBox, users, usersBox);
  assert.deepEqual(ends.from, { x: 400, y: 100 + 36 + 2 * 28 + 14, side: 'left' });
  assert.deepEqual(ends.to, { x: usersBox.w, y: 36 + 14, side: 'right' });
  for (const path of [relationPath(ends.from, ends.to), relationPath(ends.to, ends.from), relationPath({ x: 0, y: 0, side: 'right' }, { x: 10, y: 50, side: 'right' }), relationPath({ x: 0, y: 0, side: 'left' }, { x: 300, y: 80, side: 'right' })]) {
    for (let i = 1; i < path.length; i += 1) {
      assert.ok(path[i][0] === path[i - 1][0] || path[i][1] === path[i - 1][1], `diagonal segment in ${JSON.stringify(path)}`);
    }
  }
});
