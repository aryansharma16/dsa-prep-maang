import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createEditor } from '../engine/editor.js';
import { opsFromCommit } from '../engine/diff.js';
import { createSchemaSync, sourceRecord, SOURCE_ID } from '../schema/schemaSync.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const tablesOf = (editor) =>
  [...editor.store.all()]
    .filter((r) => r.type === 'dbtable')
    .map((r) => r.data.name)
    .sort();

function board(text) {
  const editor = createEditor({ boardId: 'b', boardKind: 'schema' });
  editor.store.load([sourceRecord(text)]);
  const schema = createSchemaSync(editor);
  return { editor, schema };
}

test('loading text places every table; diagram actions edit text and positions in one undo step', async () => {
  const { editor, schema } = board('Table users {\n  id int [pk]\n}\nTable orders {\n  id int\n  user_id int [ref: > users.id]\n}');
  await flush();
  assert.deepEqual(tablesOf(editor), ['public.orders', 'public.users']);

  schema.renameTable('public.users', 'customers');
  assert.deepEqual(tablesOf(editor), ['public.customers', 'public.orders']);
  assert.ok(schema.getText().includes('ref: > customers.id'));
  editor.undo();
  await flush();
  assert.deepEqual(tablesOf(editor), ['public.orders', 'public.users']);
  assert.ok(schema.getText().includes('ref: > users.id'));

  const users = [...editor.store.all()].find((r) => r.data.name === 'public.users');
  editor.commit('Move', (tx) => tx.update(users.id, { data: { x: 777, y: 555 } }));
  schema.deleteTable('public.users');
  assert.deepEqual(tablesOf(editor), ['public.orders']);
  assert.ok(!schema.getText().includes('ref:'), 'the inline ref to the deleted table went too');
  editor.undo();
  await flush();
  const back = [...editor.store.all()].find((r) => r.data.name === 'public.users');
  assert.deepEqual([back.data.x, back.data.y], [777, 555], 'undo brings the table back where it was');
  schema.dispose();
});

test('typing a new table waits for the name to settle; typing over a name renames in place', async (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  t.after(() => mock.timers.reset());
  const { editor, schema } = board('Table users {\n  id int\n}');
  await flush();
  const usersId = [...editor.store.all()].find((r) => r.type === 'dbtable').id;

  schema.setText('Table users {\n  id int\n}\nTable p {\n  id int\n}');
  schema.setText('Table users {\n  id int\n}\nTable pa {\n  id int\n}');
  schema.setText('Table users {\n  id int\n}\nTable payments {\n  id int\n}');
  assert.deepEqual(tablesOf(editor), ['public.users'], 'nothing created while the name is typed');
  mock.timers.tick(1600);
  assert.deepEqual(tablesOf(editor), ['public.payments', 'public.users']);

  schema.setText('Table user_accounts {\n  id int\n}\nTable payments {\n  id int\n}');
  assert.equal([...editor.store.all()].find((r) => r.data.name === 'public.user_accounts')?.id, usersId, 'same element, renamed');

  // The rename came long after the previous typing, so undo takes back only the rename.
  editor.undo();
  assert.equal(schema.getText(), 'Table users {\n  id int\n}\nTable payments {\n  id int\n}');
  schema.dispose();
});

test('a broken edit keeps the last good tables instead of dropping them', async () => {
  const { editor, schema } = board('Table users {\n  id int\n  email varchar\n}');
  await flush();
  schema.setText('Table users {\n  id int\n  email varchar [not nul\n');
  const model = schema.getModel();
  assert.ok(model.diagnostics.some((d) => d.severity === 'error'));
  assert.ok(model.byKey.get('public.users'), 'still modelled');
  assert.deepEqual(tablesOf(editor), ['public.users']);
  schema.dispose();
});

test('the source record saves as a source op; import and add table work; read-only tabs never write positions', async () => {
  const { editor, schema } = board('');
  await flush();
  const commits = [];
  editor.store.onCommit((c) => commits.push(c));
  const { warnings, imported } = schema.importSql('CREATE TABLE a (id int PRIMARY KEY); CREATE TABLE b (id int, a_id int REFERENCES a(id));');
  assert.equal(imported, true);
  assert.deepEqual(warnings, []);
  await flush();
  assert.deepEqual(tablesOf(editor), ['public.a', 'public.b']);
  const ops = commits.flatMap((c) => opsFromCommit(c));
  const source = ops.find((op) => op.op === 'source');
  assert.ok(source && source.text.includes('Table a'), 'text changes travel as a source op');
  assert.ok(!ops.some((op) => op.eid === SOURCE_ID || op.el?.eid === SOURCE_ID), 'never as an element');

  const key = schema.addTable({ x: 0, y: 0 });
  assert.equal(key, 'public.table_3');
  assert.ok(tablesOf(editor).includes('public.table_3'), 'placed at once, not after settling');

  const viewer = createEditor({ boardId: 'b', boardKind: 'schema', readOnly: true });
  viewer.store.load([sourceRecord('Table x {\n  id int\n}')]);
  const viewerSchema = createSchemaSync(viewer);
  await flush();
  assert.deepEqual(tablesOf(viewer), [], 'read-only: the editing tab places tables, not this one');
  viewerSchema.dispose();
  schema.dispose();
});
