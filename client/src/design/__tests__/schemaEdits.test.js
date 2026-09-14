import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeDbml } from '../schema/analyze.js';
import { addColumn, addRelation, addTable, removeColumn, removeRelation, removeTable, renameColumn, renameTable, replaceColumn, setRelationOp } from '../schema/edits.js';

const SRC = `// shop
Table users {
    id int [pk]   // four-space indent on purpose
    email varchar
}

Table orders {
  id int [pk]
  user_id int [not null, ref: > users.id]
}

Ref: orders.id - users.id

TableGroup core {
  users
  orders
}
`;

const clean = (src) => {
  const model = analyzeDbml(src);
  assert.deepEqual(model.diagnostics, [], src);
  return model;
};

test('renameTable updates the table, Ref endpoints, inline refs and groups — nothing else', () => {
  const out = renameTable(SRC, 'public.users', 'customers');
  const model = clean(out);
  assert.deepEqual(model.tables.map((t) => t.name), ['customers', 'orders']);
  assert.ok(out.includes('ref: > customers.id'));
  assert.ok(out.includes('Ref: orders.id - customers.id'));
  assert.ok(out.includes('  customers\n'));
  assert.ok(out.includes('// four-space indent on purpose'), 'comments survive');
  assert.equal(out.replace(/customers/g, 'users'), SRC, 'exactly the name tokens changed');
  // Names that need quoting get quoted.
  assert.ok(renameTable(SRC, 'public.users', 'user accounts').startsWith('// shop\nTable "user accounts" {'));
});

test('renameColumn follows references; add/replace/remove column keep indentation', () => {
  const renamed = renameColumn(SRC, 'public.users', 'id', 'user_id');
  clean(renamed);
  assert.ok(renamed.includes('ref: > users.user_id') && renamed.includes('- users.user_id'));

  const added = addColumn(SRC, 'public.users', 'created_at timestamp');
  assert.ok(added.includes('    email varchar\n    created_at timestamp\n}'), added);
  clean(added);

  const replaced = replaceColumn(SRC, 'public.users', 'email', 'email varchar(255) [unique]');
  assert.equal(clean(replaced).byKey.get('public.users').columns[1].unique, true);

  const removed = removeColumn(SRC, 'public.orders', 'user_id');
  assert.ok(!removed.includes('user_id'));
  assert.ok(removed.includes('  id int [pk]\n}'), removed);
  clean(removed);

  const empty = addColumn('Table t {\n}', 'public.t', 'id int');
  assert.equal(empty, 'Table t {\n  id int\n}');
});

test('removeTable takes its refs, inline refs and group entries with it', () => {
  const out = removeTable(SRC, 'public.users');
  const model = clean(out);
  assert.deepEqual(model.tables.map((t) => t.name), ['orders']);
  assert.ok(!out.includes('Ref:'));
  assert.ok(out.includes('user_id int [not null]'), out);
  assert.deepEqual(model.groups[0].tables, ['public.orders']);
});

test('relations: add, change operator, remove inline and block refs', () => {
  const model = clean(SRC);
  const inline = model.relations.find((r) => r.inline);
  const block = model.relations.find((r) => !r.inline);

  const withoutInline = removeRelation(SRC, inline);
  assert.ok(withoutInline.includes('user_id int [not null]\n'), withoutInline);
  assert.equal(clean(withoutInline).relations.length, 1);

  const withoutBlock = removeRelation(SRC, block);
  assert.ok(!withoutBlock.includes('Ref: orders.id'));
  assert.equal(clean(withoutBlock).relations.length, 1);

  const bare = removeRelation('Table a {\n  b_id int [ref: > b.id]\n}\nTable b {\n  id int\n}', analyzeDbml('Table a {\n  b_id int [ref: > b.id]\n}\nTable b {\n  id int\n}').relations[0]);
  assert.ok(bare.includes('  b_id int\n'), bare);

  const flipped = setRelationOp(SRC, block, '<');
  assert.equal(clean(flipped).relations.find((r) => !r.inline).op, '<');

  const added = addRelation(addTable(SRC, 'payments', ['id int [pk]', 'order_id int']), { table: 'public.payments', columns: ['order_id'] }, { table: 'public.orders', columns: ['id'] });
  const m = clean(added);
  assert.ok(m.relations.some((r) => r.from.table === 'public.payments' && r.to.table === 'public.orders'));
  assert.ok(added.endsWith('Ref: payments.order_id > orders.id\n'));
});

import { parseDbml } from '../schema/dbml.js';
import { columnLine } from '../schema/edits.js';

test('columnLine writes a parsed column back without losing anything', () => {
  const src = `Table t {\n  "full name" "character varying"(120)[] [pk, increment, default: \`now()\`, note: 'it\\'s', ref: > users.(a, b)]\n  n int [not null, unique, default: 0]\n  s text [null, default: 'x']\n}`;
  const table = parseDbml(src).tables[0];
  for (const column of table.columns) {
    const line = columnLine(column);
    const reparsed = parseDbml(`Table t {\n  ${line}\n}`).tables[0].columns[0];
    const strip = ({ span, nameSpan, settingsSpan, type, refs, ...rest }) => ({ ...rest, type: { ...type, span: null }, refs: refs.map((r) => ({ op: r.op, target: { schema: r.target.schema, table: r.target.table, columns: r.target.columns } })) });
    assert.deepEqual(strip(reparsed), strip(column), line);
  }
  assert.equal(columnLine({ ...table.columns[1], unique: false, notNull: false }), 'n int [default: 0]');
});
