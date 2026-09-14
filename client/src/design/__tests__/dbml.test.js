import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDbml, tokenize } from '../schema/dbml.js';

const slice = (source, s) => source.slice(s.start, s.end);

const HMS = `// Hospital management
Project hms {
  database_type: 'PostgreSQL'
  Note: '''
    # HMS
    Patients, doctors, appointments.
  '''
}

Table patients as P [headercolor: #3498DB, note: 'people we treat'] {
  id bigint [pk, increment]
  full_name varchar(120) [not null]
  "date of birth" date
  blood_group blood_group
  phone varchar(20) [unique, note: 'E.164']
  balance decimal(10,2) [default: -0.5]
  tags text[]
  created_at timestamp [default: \`now()\`]

  indexes {
    (full_name, phone) [unique, name: 'patients_name_phone']
    created_at
    \`lower(full_name)\` [type: btree]
  }
  Note: 'All registered patients'
}

Table doctors {
  id bigint [pk]
  name varchar(120) [not null]
  department_id int [ref: > departments.id]
}

Table departments {
  id int [primary key]
  name varchar [null, unique]
}

Table appointments {
  id bigint [pk]
  patient_id bigint
  doctor_id bigint
  starts_at timestamptz [not null]
  status appointment_status [default: 'booked']
}

Enum appointment_status {
  booked
  completed [note: 'seen by a doctor']
  "no show"
}

Enum blood_group { A B AB O }

Ref: appointments.patient_id > patients.id [delete: cascade, update: no action]
Ref fk_doctor {
  appointments.doctor_id > doctors.id
  doctors.department_id - departments.id
}
Ref: appointments.(patient_id, doctor_id) <> doctors.(id, department_id)

TableGroup clinical [color: #ff0000] {
  patients
  appointments
  Note: 'care'
}

Note board_note {
  'Reviewed by Aryan'
}
`;

test('parses a full schema: project, tables, columns, indexes, enums, refs, groups, notes', () => {
  const r = parseDbml(HMS);
  assert.deepEqual(r.diagnostics, []);
  assert.equal(r.project.name, 'hms');
  assert.equal(r.project.databaseType, 'PostgreSQL');
  assert.equal(r.project.note, '# HMS\nPatients, doctors, appointments.');

  assert.deepEqual(r.tables.map((t) => t.name), ['patients', 'doctors', 'departments', 'appointments']);
  const patients = r.tables[0];
  assert.equal(patients.alias, 'P');
  assert.equal(patients.headerColor, '#3498DB');
  assert.equal(patients.note, 'All registered patients');
  assert.deepEqual(patients.columns.map((c) => c.name), ['id', 'full_name', 'date of birth', 'blood_group', 'phone', 'balance', 'tags', 'created_at']);
  const [id, fullName, dob, , phone, balance, tags, createdAt] = patients.columns;
  assert.deepEqual([id.pk, id.increment, id.type.name], [true, true, 'bigint']);
  assert.deepEqual([fullName.notNull, fullName.type.args], [true, ['120']]);
  assert.equal(dob.type.name, 'date');
  assert.deepEqual([phone.unique, phone.note], [true, 'E.164']);
  assert.deepEqual(balance.default, { kind: 'number', value: '-0.5' });
  assert.deepEqual(balance.type.args, ['10', '2']);
  assert.equal(tags.type.array, true);
  assert.deepEqual(createdAt.default, { kind: 'expr', value: 'now()' });
  assert.equal(patients.indexes.length, 3);
  assert.deepEqual(patients.indexes[0], { ...patients.indexes[0], columns: [{ name: 'full_name' }, { name: 'phone' }], unique: true, name: 'patients_name_phone' });
  assert.deepEqual(patients.indexes[2].columns, [{ expr: 'lower(full_name)' }]);
  assert.equal(patients.indexes[2].type, 'btree');

  const doctors = r.tables[1];
  assert.deepEqual(doctors.columns[2].refs.map((ref) => [ref.op, ref.target.table, ref.target.columns]), [['>', 'departments', ['id']]]);
  assert.equal(r.tables[2].columns[0].pk, true);
  assert.equal(r.tables[2].columns[1].nullable, true);

  assert.deepEqual(r.enums.map((e) => [e.name, e.values.map((v) => v.name)]), [['appointment_status', ['booked', 'completed', 'no show']], ['blood_group', ['A', 'B', 'AB', 'O']]]);
  assert.equal(r.enums[0].values[1].note, 'seen by a doctor');

  assert.equal(r.refs.length, 4);
  assert.deepEqual([r.refs[0].from.table, r.refs[0].op, r.refs[0].to.table, r.refs[0].delete, r.refs[0].update], ['appointments', '>', 'patients', 'cascade', 'no action']);
  assert.deepEqual([r.refs[1].name, r.refs[2].name, r.refs[2].op], ['fk_doctor', 'fk_doctor', '-']);
  assert.deepEqual([r.refs[3].from.columns, r.refs[3].op, r.refs[3].to.columns], [['patient_id', 'doctor_id'], '<>', ['id', 'department_id']]);

  assert.deepEqual(r.groups.map((g) => [g.name, g.color, g.tables.map((t) => t.name), g.note]), [['clinical', '#ff0000', ['patients', 'appointments'], 'care']]);
  assert.deepEqual(r.notes.map((n) => [n.name, n.text]), [['board_note', 'Reviewed by Aryan']]);
});

test('spans point at the text they describe', () => {
  const r = parseDbml(HMS);
  const patients = r.tables[0];
  assert.equal(slice(HMS, patients.nameSpan), 'patients');
  assert.ok(slice(HMS, patients.span).startsWith('Table patients'));
  assert.ok(slice(HMS, patients.span).endsWith('}'));
  assert.equal(slice(HMS, patients.columns[2].nameSpan), '"date of birth"');
  assert.equal(slice(HMS, patients.columns[1].span), 'full_name varchar(120) [not null]');
  assert.equal(slice(HMS, patients.columns[1].type.span), 'varchar(120)');
  assert.equal(slice(HMS, patients.columns[1].settingsSpan), '[not null]');
  assert.equal(slice(HMS, r.refs[0].from.span), 'appointments.patient_id');
  assert.equal(slice(HMS, r.refs[0].from.tableSpan), 'appointments');
  assert.equal(slice(HMS, r.refs[3].to.span), 'doctors.(id, department_id)');
});

test('schema-qualified names, comments, and identifiers that start with digits', () => {
  const src = `/* block
comment */ Table core.users { // trailing
  id int [pk] // why
  1st_login timestamp
}
Ref: core.orders.user_id > core.users.id`;
  const r = parseDbml(src);
  assert.deepEqual(r.diagnostics, []);
  assert.deepEqual([r.tables[0].schema, r.tables[0].name], ['core', 'users']);
  assert.equal(r.tables[0].columns[1].name, '1st_login');
  assert.deepEqual([r.refs[0].from.schema, r.refs[0].from.table, r.refs[0].to.schema], ['core', 'orders', 'core']);
});

test('recovers from mistakes: one broken line does not lose the rest', () => {
  const src = `Table users {
  id int [pk]
  email
  name varchar [not nul, unique
  age int
}

Tabel oops {
  x int
}

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
}
Ref: orders.user_id >
`;
  const r = parseDbml(src);
  const users = r.tables.find((t) => t.name === 'users');
  assert.ok(users, 'users still parsed');
  assert.deepEqual(users.columns.map((c) => c.name).filter((n) => n !== 'name'), ['id', 'age']);
  assert.ok(r.tables.find((t) => t.name === 'orders'), 'a table after a broken block still parses');
  assert.equal(r.tables.find((t) => t.name === 'orders').columns[1].refs.length, 1);
  const messages = r.diagnostics.map((d) => d.message);
  assert.ok(messages.some((m) => m.includes('needs a type')), messages.join(' | '));
  assert.ok(messages.some((m) => m.includes('found "Tabel"')), messages.join(' | '));
  assert.ok(r.diagnostics.every((d) => d.span.start >= 0 && d.span.end <= src.length && d.span.end >= d.span.start));
});

test('unclosed things report instead of throwing', () => {
  for (const src of ['Table t {\n  id int', "Table t {\n  name varchar [note: 'x", 'Table t { id int }\n/* never closed', 'Ref: a.b > ', '[', '}']) {
    const r = parseDbml(src);
    assert.ok(r.diagnostics.some((d) => d.severity === 'error'), `no error for ${JSON.stringify(src)}`);
  }
  assert.equal(parseDbml('Table t {\n  id int').tables[0].columns[0].name, 'id');
});

test('tokenizer: strings, colors, relationship operators', () => {
  const types = tokenize(`'a' "b" \`c\` #fff <> > < - 12 -3`).map((t) => `${t.type}:${t.value}`);
  assert.deepEqual(types, ['string:a', 'qident:b', 'expr:c', 'color:#fff', 'punct:<>', 'punct:>', 'punct:<', 'punct:-', 'number:12', 'punct:-', 'number:3', 'eof:']);
});

import { analyzeDbml } from '../schema/analyze.js';

test('analyze: resolves tables, aliases, inline and block refs with cardinality', () => {
  const src = `Table users as U {
  id int [pk]
}
Table orders {
  id int [pk]
  user_id int [not null, ref: > U.id]
  coupon_id int
}
Table coupons {
  id int [pk]
}
Table profiles {
  user_id int [pk]
}
Ref: orders.coupon_id > coupons.id
Ref: users.id - profiles.user_id
Ref: orders.id <> coupons.id`;
  const model = analyzeDbml(src);
  assert.deepEqual(model.diagnostics, []);
  assert.deepEqual(model.tables.map((t) => t.key), ['public.users', 'public.orders', 'public.coupons', 'public.profiles']);
  const byId = Object.fromEntries(model.relations.map((r) => [`${r.from.table}.${r.from.columns}${r.op}${r.to.table}.${r.to.columns}`, r]));
  const inline = byId['public.orders.user_id>public.users.id'];
  assert.ok(inline.inline);
  assert.deepEqual([inline.from.card, inline.to.card, inline.to.optional], ['many', 'one', false], 'NOT NULL FK: exactly one user');
  const coupon = byId['public.orders.coupon_id>public.coupons.id'];
  assert.deepEqual([coupon.from.card, coupon.to.card, coupon.to.optional], ['many', 'one', true], 'nullable FK: zero or one coupon');
  const oneToOne = byId['public.users.id-public.profiles.user_id'];
  assert.deepEqual([oneToOne.from.card, oneToOne.to.card], ['one', 'one']);
  const manyToMany = byId['public.orders.id<>public.coupons.id'];
  assert.deepEqual([manyToMany.from.card, manyToMany.to.card], ['many', 'many']);
});

test('analyze: reports unknown tables and columns, duplicates, composite mismatches, and enum columns', () => {
  const src = `Table a {
  id int [pk]
  id int
  status s
  b_id int [ref: > b.id]
}
Table a {
  x int
}
Enum s { on off }
Ref: a.nope > a.id
Ref: a.(id, status) > a.(id)
TableGroup g { a ghost }`;
  const model = analyzeDbml(src);
  const messages = model.diagnostics.map((d) => `${d.severity}: ${d.message} @${src.slice(d.span.start, d.span.end)}`);
  assert.ok(messages.includes('error: Column "id" appears twice in "a" @id'), messages.join('\n'));
  assert.ok(messages.includes('error: No table named "b" @b'), messages.join('\n'));
  assert.ok(messages.includes('error: Table "a" is defined twice @a'), messages.join('\n'));
  assert.ok(messages.includes('error: "a" has no column "nope" @nope'), messages.join('\n'));
  assert.ok(messages.some((m) => m.startsWith('error: A composite reference needs the same number')), messages.join('\n'));
  assert.ok(messages.includes('warning: TableGroup "g" lists unknown table "ghost" @ghost'), messages.join('\n'));
  assert.equal(model.byKey.get('public.a').columns.find((c) => c.name === 'status').enum, 'public.s');
  assert.equal(model.relations.length, 0);
});
