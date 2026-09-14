import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeDbml } from '../schema/analyze.js';
import { addColumn, columnLine } from '../schema/edits.js';
import {
  buildColumnLine,
  columnPresets,
  defaultSuggestions,
  defaultText,
  describeToken,
  describeType,
  dialectOf,
  EXAMPLE_SCHEMA,
  filterTypeGroups,
  foreignKeyColumn,
  guessColumn,
  lineColumnName,
  parseDefault,
  parseTypeText,
  typeGroups,
  typeText,
  validTypeText,
} from '../schema/assist.js';
import { toDdl } from '../schema/ddl.js';

const SHOP = `Enum order_status {
  pending
  paid
}

Table users {
  id bigint [pk, increment]
}

Table categories {
  id uuid [pk]
}

Table orders {
  id bigint [pk]
}
`;

test('parseTypeText and typeText round-trip what people type', () => {
  assert.deepEqual(parseTypeText('decimal(12, 2)'), { name: 'decimal', args: ['12', '2'], array: false });
  assert.deepEqual(parseTypeText(' text[] '), { name: 'text', args: null, array: true });
  assert.deepEqual(parseTypeText('varchar()'), { name: 'varchar', args: null, array: false });
  assert.equal(parseTypeText('   '), null);
  for (const text of ['bigint', 'varchar(255)', 'decimal(12,2)', 'text[]', 'public.order_status']) assert.equal(typeText(parseTypeText(text)), text);
});

test('every suggested type is valid DBML and gets described', () => {
  const model = analyzeDbml(SHOP);
  for (const m of [model, analyzeDbml(`Project p { database_type: 'MySQL' }\n${SHOP}`)]) {
    for (const group of typeGroups(m)) {
      for (const type of group.types) {
        const src = addColumn(SHOP, 'public.orders', `c ${type.name}`);
        const out = analyzeDbml(src);
        assert.deepEqual(out.diagnostics, [], type.name);
        assert.equal(typeText(out.byKey.get('public.orders').columns[1].type), type.name);
        assert.ok(describeType(type.name, m), `no description for ${type.name}`);
        assert.ok(validTypeText(type.name), type.name);
      }
    }
  }
  assert.equal(typeGroups(model)[0].id, 'enums', "the schema's own enums come first");
  assert.match(describeType('order_status', model), /pending, paid/);
  assert.match(describeType('integer'), /32-bit/);
  assert.equal(describeType('made_up_type'), null);
  assert.ok(filterTypeGroups(typeGroups(model), 'money').flatMap((g) => g.types.map((t) => t.name)).includes('decimal(12,2)'), 'search reads descriptions');
  assert.equal(filterTypeGroups(typeGroups(model), '').length, typeGroups(model).length);
});

test('dialect follows the Project database_type', () => {
  assert.equal(dialectOf(analyzeDbml(SHOP)), 'postgres');
  const mysql = analyzeDbml(`Project p { database_type: 'MySQL' }\n${SHOP}`);
  assert.equal(dialectOf(mysql), 'mysql');
  assert.equal(guessColumn(mysql, 'public.orders', 'created_at').type, 'datetime');
  assert.ok(!typeGroups(mysql).flatMap((g) => g.types).some((t) => t.name === 'timestamptz'));
});

test('guessColumn: keys, references, enums and names', () => {
  const model = analyzeDbml(SHOP);
  assert.deepEqual(guessColumn(model, 'public.orders', 'user_id'), { type: 'bigint', settings: [], ref: { table: 'public.users', column: 'id' } });
  assert.deepEqual(guessColumn(model, 'public.orders', 'category_id').ref, { table: 'public.categories', column: 'id' });
  assert.equal(guessColumn(model, 'public.orders', 'category_id').type, 'uuid', 'the key type of the target');
  assert.deepEqual(guessColumn(model, 'public.orders', 'coupon_id'), { type: 'bigint', settings: [], ref: null });
  assert.equal(guessColumn(model, 'public.orders', 'status').type, 'order_status');
  assert.equal(guessColumn(model, 'public.orders', 'paid').ref, null, '"paid" is not a foreign key');
  assert.equal(guessColumn(model, 'public.orders', 'created_at').type, 'timestamptz');
  assert.equal(guessColumn(model, 'public.orders', 'is_gift').type, 'boolean');
  assert.equal(guessColumn(model, 'public.orders', 'total').type, 'decimal(12,2)');
  assert.equal(guessColumn(model, 'public.orders', 'nickname').type, 'varchar(255)');
  assert.deepEqual(guessColumn(model, 'public.orders', 'id').settings, [], 'orders already has a key');
  assert.deepEqual(guessColumn(analyzeDbml('Table t {\n  name text\n}'), 'public.t', 'id').settings, ['pk', 'increment']);
});

test('buildColumnLine, foreignKeyColumn and presets produce clean DBML', () => {
  const model = analyzeDbml(SHOP);
  const orders = model.byKey.get('public.orders');
  const guess = guessColumn(model, 'public.orders', 'user_id');
  const line = buildColumnLine('user_id', guess.type, guess);
  assert.equal(line, 'user_id bigint [ref: > users.id]');
  const withFk = analyzeDbml(addColumn(SHOP, 'public.orders', line));
  assert.deepEqual(withFk.diagnostics, []);
  assert.equal(withFk.relations.length, 1);

  const fk = foreignKeyColumn(orders, model.byKey.get('public.categories'));
  assert.deepEqual(fk, { name: 'category_id', line: 'category_id uuid [not null, ref: > categories.id]' });
  const taken = analyzeDbml(addColumn(SHOP, 'public.orders', fk.line));
  assert.equal(foreignKeyColumn(taken.byKey.get('public.orders'), taken.byKey.get('public.categories')).name, 'category_id_2');
  assert.equal(foreignKeyColumn(orders, { name: 'x', key: 'public.x', columns: [] }), null);

  for (const preset of columnPresets(model)) {
    let src = 'Table t {\n  x text\n}\n';
    for (const l of preset.lines) src = addColumn(src, 'public.t', l);
    assert.deepEqual(analyzeDbml(src).diagnostics, [], preset.id);
    assert.ok(preset.lines.every((l) => lineColumnName(l)));
  }
  assert.equal(lineColumnName('"first name" text'), 'first name');
});

test('defaults: what is typed becomes the right DBML and reads back the same', () => {
  assert.deepEqual(parseDefault('now()'), { kind: 'expr', value: 'now()' });
  assert.deepEqual(parseDefault('42'), { kind: 'number', value: '42' });
  assert.deepEqual(parseDefault('TRUE'), { kind: 'word', value: 'true' });
  assert.deepEqual(parseDefault("'active'"), { kind: 'string', value: 'active' });
  assert.deepEqual(parseDefault('active'), { kind: 'string', value: 'active' });
  assert.equal(parseDefault(''), null);
  for (const typed of ['now()', '42', 'true', 'active', "'42'", '`a + b`', 'CURRENT_TIMESTAMP']) {
    const once = parseDefault(typed);
    assert.deepEqual(parseDefault(defaultText(once)), once, typed);
    // And through the DBML line and parser.
    const src = `Table t {\n  ${columnLine({ name: 'c', type: { name: 'text' }, default: once, refs: [] })}\n}`;
    const parsed = analyzeDbml(src);
    assert.deepEqual(parsed.diagnostics, [], src);
    assert.deepEqual(parsed.byKey.get('public.t').columns[0].default, once, src);
  }
  assert.deepEqual(defaultSuggestions('timestamptz'), ['now()']);
  assert.deepEqual(defaultSuggestions('order_status', analyzeDbml(SHOP)), ['pending', 'paid']);
});

test('describeToken explains the words the editor highlights', () => {
  assert.equal(describeToken('keyword', 'Table').title, 'Table');
  assert.match(describeToken('setting', 'pk').body, /Primary key/);
  assert.match(describeToken('op', '<>').body, /junction/);
  assert.match(describeToken('type', 'timestamptz').body, /UTC/);
  assert.equal(describeToken('type', 'whatever'), null);
  assert.equal(describeToken('name', 'users'), null);
});

test('validTypeText accepts types and refuses half-typed ones', () => {
  for (const ok of ['int', 'varchar(255)', 'decimal(12, 2)', 'text[]', 'public.order_status', 'double precision', "enum('a','b')"]) assert.ok(validTypeText(ok), ok);
  for (const bad of ['', 'varchar(', '1int', 'int [pk]', 'a b(']) assert.ok(!validTypeText(bad), bad);
});

test('the example schema is clean and exports', () => {
  const model = analyzeDbml(EXAMPLE_SCHEMA);
  assert.deepEqual(model.diagnostics, []);
  assert.equal(model.tables.length, 4);
  assert.equal(model.relations.length, 3);
  assert.equal(primaryKeyOfItems(model), null, 'order_items has a composite key');
  assert.match(toDdl(model, 'postgres'), /PRIMARY KEY \("order_id", "product_id"\)/);
});

function primaryKeyOfItems(model) {
  return model.byKey.get('public.order_items').columns.find((c) => c.pk) || null;
}
