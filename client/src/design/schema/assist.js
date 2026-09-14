import { tableKey } from './analyze.js';
import { quoteName } from './edits.js';

/**
 * What a person building a schema needs to know without leaving the board:
 * which column types there are and what each is for, a sensible type for a
 * column from its name alone, one-click common columns, and a sentence for
 * every DBML word the text editor highlights.
 *
 * PostgreSQL by default, as dbdiagram assumes; a `Project { database_type:
 * 'MySQL' }` switches the suggestions to MySQL's types, since the exports pass
 * types through as written and `timestamptz` is not a MySQL type.
 *
 * Pure.
 */

/** 'mysql' when the schema's Project says so, otherwise 'postgres'. */
export const dialectOf = (model) => (/mysql|mariadb/i.test(model?.project?.databaseType || '') ? 'mysql' : 'postgres');

/** A parsed column type as it is written: `varchar(255)`, `text[]`. */
export const typeText = (type) => (type ? type.name + (type.args?.length ? `(${type.args.join(',')})` : '') + (type.array ? '[]' : '') : '');

/** `decimal(12, 2)[]` → `{ name: 'decimal', args: ['12', '2'], array: true }`; null for blank text. */
export function parseTypeText(text) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  const match = value.match(/^(.+?)\s*(?:\((.*)\))?\s*(\[\])?$/);
  if (!match) return null;
  const args = match[2] != null ? match[2].split(',').map((a) => a.trim()).filter(Boolean) : null;
  return { name: match[1].trim(), args: args?.length ? args : null, array: Boolean(match[3]) };
}

/**
 * Whether text can be a column type in DBML: a name (dotted for an enum in a
 * schema, words for `double precision`), optional `(args)`, optional `[]`.
 * Half-typed text like `varchar(` is not.
 */
export const validTypeText = (text) => /^[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)*(?: [A-Za-z_][\w$]*)*\s*(?:\(\s*[\w'".\s,-]*\))?\s*(?:\[\])?$/.test(String(text ?? '').trim());

const T = (name, about, extra) => ({ name, about, ...extra });

const POSTGRES = [
  {
    id: 'keys',
    label: 'Keys & ids',
    types: [
      T('bigint', '64-bit whole number. The usual id and foreign key — it will not run out'),
      T('uuid', 'Random 128-bit id. Can be made anywhere (no round trip) and does not reveal row counts'),
    ],
  },
  {
    id: 'numbers',
    label: 'Numbers',
    types: [
      T('int', '32-bit whole number, up to about 2.1 billion. Counts, quantities, ages'),
      T('smallint', '16-bit whole number, up to 32,767. Small codes, ratings, positions'),
      T('decimal(12,2)', 'Exact decimal (12 digits, 2 after the point). Money and anything that must add up'),
      T('real', 'Approximate decimal (4 bytes). Scores, sensor readings — never money'),
      T('float8', 'Approximate decimal (8 bytes), also called double precision. Coordinates, ML features'),
    ],
  },
  {
    id: 'text',
    label: 'Text',
    types: [
      T('varchar(255)', 'Text up to a length. Names, emails, slugs, titles'),
      T('text', 'Text of any length. Descriptions, bodies, comments, URLs'),
      T('char(2)', 'Exactly this many characters. Country codes (2), currency codes (3)'),
    ],
  },
  {
    id: 'time',
    label: 'Date & time',
    types: [
      T('timestamptz', 'An instant in time, stored in UTC. created_at, paid_at — the right default for events'),
      T('timestamp', 'Date and time with no time zone. Wall-clock times like "opens 09:00 local"'),
      T('date', 'A calendar day. Birthdays, due dates, reporting days'),
      T('time', 'A time of day. Opening hours, schedules'),
      T('interval', 'A length of time. Durations, subscription periods'),
    ],
  },
  {
    id: 'other',
    label: 'Other',
    types: [
      T('boolean', 'true or false. is_active, is_verified'),
      T('jsonb', 'JSON stored parsed and indexable. Settings, metadata, flexible attributes'),
      T('json', 'JSON kept exactly as written (key order, spaces). Prefer jsonb unless you need that'),
      T('text[]', 'A list of text in one column. Tags, labels'),
      T('bytea', 'Raw bytes. Hashes, small binary blobs (files belong in object storage)'),
      T('inet', 'An IP address, v4 or v6. Audit logs, rate limiting'),
    ],
  },
];

const MYSQL = [
  {
    id: 'keys',
    label: 'Keys & ids',
    types: [
      T('bigint', '64-bit whole number. The usual id and foreign key — it will not run out'),
      T('char(36)', 'A UUID as text. Can be made anywhere and does not reveal row counts (binary(16) is smaller)'),
    ],
  },
  {
    id: 'numbers',
    label: 'Numbers',
    types: [
      T('int', '32-bit whole number, up to about 2.1 billion. Counts, quantities, ages'),
      T('smallint', '16-bit whole number, up to 32,767. Small codes, ratings, positions'),
      T('tinyint', '8-bit whole number, up to 127. Tiny codes and flags'),
      T('decimal(12,2)', 'Exact decimal (12 digits, 2 after the point). Money and anything that must add up'),
      T('double', 'Approximate decimal (8 bytes). Coordinates, scores — never money'),
    ],
  },
  {
    id: 'text',
    label: 'Text',
    types: [
      T('varchar(255)', 'Text up to a length. Names, emails, slugs, titles'),
      T('text', 'Text up to 65,535 bytes. Descriptions, bodies, comments'),
      T('char(2)', 'Exactly this many characters. Country codes (2), currency codes (3)'),
    ],
  },
  {
    id: 'time',
    label: 'Date & time',
    types: [
      T('datetime', 'Date and time as written, no time zone conversion. created_at, paid_at'),
      T('timestamp', 'Date and time converted to UTC for storage; only reaches 2038'),
      T('date', 'A calendar day. Birthdays, due dates, reporting days'),
      T('time', 'A time of day. Opening hours, schedules'),
    ],
  },
  {
    id: 'other',
    label: 'Other',
    types: [
      T('boolean', 'true or false (MySQL stores tinyint(1)). is_active, is_verified'),
      T('json', 'JSON, validated on write. Settings, metadata, flexible attributes'),
      T('blob', 'Raw bytes. Hashes, small binary blobs (files belong in object storage)'),
    ],
  },
];

// Names people type that mean a type above, so the tooltip still explains them.
const ALIASES = {
  integer: 'int',
  int4: 'int',
  int8: 'bigint',
  int2: 'smallint',
  serial: 'int',
  bigserial: 'bigint',
  numeric: 'decimal',
  float4: 'real',
  double: 'float8',
  float: 'float8',
  bool: 'boolean',
  varchar: 'varchar',
  'character varying': 'varchar',
  character: 'char',
  timestamptz: 'timestamptz',
  datetime: 'datetime',
  string: 'varchar',
};

const EXTRA_ABOUT = {
  serial: 'Auto-numbered 32-bit id (PostgreSQL shorthand). In DBML prefer int [increment]',
  bigserial: 'Auto-numbered 64-bit id (PostgreSQL shorthand). In DBML prefer bigint [increment]',
  mediumtext: 'Text up to 16 MB (MySQL)',
  longtext: 'Text up to 4 GB (MySQL)',
  binary: 'Fixed-length raw bytes. binary(16) holds a UUID compactly',
  varbinary: 'Raw bytes up to a length',
  money: 'Currency with the locale\'s precision (PostgreSQL). decimal is usually the safer choice',
  citext: 'Case-insensitive text (PostgreSQL extension). Emails, usernames',
  tsvector: 'A searchable document for PostgreSQL full-text search',
  point: 'An x,y point (PostgreSQL geometry). PostGIS geography is better for the Earth',
  enum: 'One of a fixed list of values',
};

/** The suggested types, grouped, for the schema's dialect — plus its own enums first. */
export function typeGroups(model) {
  const groups = dialectOf(model) === 'mysql' ? MYSQL : POSTGRES;
  const enums = [...(model?.enums?.values?.() || [])];
  if (!enums.length) return groups;
  return [
    {
      id: 'enums',
      label: 'Enums in this schema',
      types: enums.map((e) => T(e.schema && e.schema !== 'public' ? `${e.schema}.${e.name}` : e.name, `Enum: ${e.values.map((v) => v.name).slice(0, 6).join(', ')}${e.values.length > 6 ? ', …' : ''}`, { enum: true })),
    },
    ...groups,
  ];
}

/** Groups narrowed to types whose name or description contains `query` (all of them for a blank query). */
export function filterTypeGroups(groups, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({ ...g, types: g.types.filter((t) => t.name.toLowerCase().includes(q) || t.about.toLowerCase().includes(q)) }))
    .filter((g) => g.types.length);
}

/** One sentence about a type name (`varchar`, `timestamptz`, an enum of the schema), or null. */
export function describeType(name, model) {
  const raw = String(name ?? '').trim().replace(/\[\]$/, '');
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/\(.*$/, '').trim();
  const enumEntry = model?.enums && (model.enums.get(raw.includes('.') ? raw : tableKey(null, raw)) || null);
  if (enumEntry) return `Enum: ${enumEntry.values.map((v) => v.name).join(', ')}`;
  if (EXTRA_ABOUT[lower]) return EXTRA_ABOUT[lower];
  const target = ALIASES[lower] || lower;
  for (const group of [...POSTGRES, ...MYSQL]) {
    for (const type of group.types) {
      if (type.name.replace(/\(.*$/, '').replace(/\[\]$/, '').toLowerCase() === target) return type.about;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* columns                                                                     */
/* -------------------------------------------------------------------------- */

const singular = (word) => (/ies$/.test(word) ? `${word.slice(0, -3)}y` : /(ses|xes|zes|ches|shes)$/.test(word) ? word.slice(0, -2) : /s$/.test(word) && !/ss$/.test(word) ? word.slice(0, -1) : word);
const plurals = (word) => [word, `${word}s`, `${word}es`, word.replace(/y$/, 'ies')];

/** A table's single primary-key column, or null (no key, or a composite one). */
export function primaryKeyOf(table) {
  const pks = table?.columns.filter((c) => c.pk) || [];
  if (pks.length === 1) return pks[0];
  if (!pks.length && table?.indexes) {
    const name = table.indexes.find((i) => i.pk && i.columns?.length === 1)?.columns[0].name;
    if (name) return table.columns.find((c) => c.name === name) || null;
  }
  return null;
}

/** Rules from a column's name to its likely type, first match wins. */
const NAME_RULES = [
  [/^(uuid|guid)$|_(uuid|guid)$/, { postgres: 'uuid', mysql: 'char(36)' }],
  [/^(created|updated|deleted|published|paid|sent|expires|started|ended|completed|last_login|last_seen)_at$|_at$/, { postgres: 'timestamptz', mysql: 'datetime' }],
  [/_(on|date)$|^(date|dob|birthday|birth_date)$/, 'date'],
  [/^(is|has|can|should|allow)_|_(enabled|flag)$|^(active|verified|enabled|archived|deleted|published)$/, 'boolean'],
  [/^(price|amount|total|subtotal|balance|cost|fee|salary|tax|discount)$|_(price|amount|total|balance|cost|fee)$/, 'decimal(12,2)'],
  [/^(lat|latitude|lng|lon|long|longitude)$/, 'decimal(9,6)'],
  [/^(count|quantity|qty|age|position|sort_order|rank|stock|attempts|retries|priority|year|duration_seconds)$|_(count|quantity|qty|seconds|minutes|days)$/, 'int'],
  [/^(rating|score|weight|height)$/, { postgres: 'real', mysql: 'double' }],
  [/^(description|body|content|bio|about|notes?|comment|message|summary|text|details|address)$|_(description|body|text|notes?)$/, 'text'],
  [/^(url|link|website|avatar|image|photo|thumbnail)$|_(url|link)$/, 'text'],
  [/^(metadata|meta|settings|preferences|payload|data|attributes|config|properties|extra)$|_(json|metadata|settings)$/, { postgres: 'jsonb', mysql: 'json' }],
  [/^(tags|labels|aliases|roles)$/, { postgres: 'text[]', mysql: 'json' }],
  [/^(ip|ip_address|remote_addr)$/, { postgres: 'inet', mysql: 'varchar(45)' }],
  [/^(country|country_code)$/, 'char(2)'],
  [/^(currency|currency_code)$/, 'char(3)'],
  [/^(phone|mobile)|_phone$/, 'varchar(20)'],
  [/^(status|state|type|kind|role|gender|level|tier|plan)$|_(status|type|kind)$/, 'varchar(32)'],
];

/**
 * A type (and settings) for a new column from its name, in a table of `model`:
 * `user_id` → the key type of `users` with `ref: > users.id`; `created_at` →
 * `timestamptz`; `status` → the schema's `order_status` enum if there is one.
 *
 * `{ type, settings: string[], ref: { table, column } | null }`. Unknown names
 * get `varchar(255)`.
 */
export function guessColumn(model, tableKeyName, columnName) {
  const dialect = dialectOf(model);
  const name = String(columnName ?? '').trim();
  const lower = name.toLowerCase();
  const table = model?.byKey?.get(tableKeyName) || null;
  const out = { type: 'varchar(255)', settings: [], ref: null };
  if (!lower) return out;

  if (lower === 'id') {
    const hasKey = table?.columns.some((c) => c.pk);
    return { type: 'bigint', settings: hasKey ? [] : ['pk', 'increment'], ref: null };
  }

  const fk = lower.match(/^(.+?)_?id$/);
  if (fk && lower !== 'id' && (lower.endsWith('_id') || /[a-z]Id$/.test(name))) {
    const base = fk[1].replace(/_$/, '');
    // `parent_id` / `manager_id` in a table point at that table itself only when nothing else matches.
    const candidates = new Set(plurals(base));
    const target = model?.tables?.find((t) => candidates.has(t.name.toLowerCase()) && t.key !== tableKeyName) || model?.tables?.find((t) => candidates.has(t.name.toLowerCase())) || null;
    const pk = target && primaryKeyOf(target);
    if (pk) return { type: typeText(pk.type), settings: [], ref: { table: target.key, column: pk.name } };
    return { type: 'bigint', settings: [], ref: null };
  }

  // A column named like one of the schema's enums (`status` → `order_status`) is that enum.
  for (const e of model?.enums?.values?.() || []) {
    const enumName = e.name.toLowerCase();
    if (enumName === lower || enumName.endsWith(`_${lower}`) || enumName.startsWith(`${lower}_`)) {
      out.type = e.schema && e.schema !== 'public' ? `${e.schema}.${e.name}` : e.name;
      return out;
    }
  }

  for (const [pattern, type] of NAME_RULES) {
    if (pattern.test(lower)) {
      out.type = typeof type === 'string' ? type : type[dialect];
      break;
    }
  }
  if (lower === 'email' || lower === 'username') out.settings = ['unique'];
  if (lower === 'created_at' || lower === 'updated_at') out.settings = ['not null', `default: \`${dialect === 'mysql' ? 'CURRENT_TIMESTAMP' : 'now()'}\``];
  return out;
}

/** A column line from a name, a type text and optional settings/ref: `user_id bigint [not null, ref: > users.id]`. */
export function buildColumnLine(name, type, { settings = [], ref = null } = {}) {
  const all = [...settings];
  if (ref) {
    const [schema, ...rest] = ref.table.split('.');
    const tableName = rest.join('.');
    all.push(`ref: > ${schema && schema !== 'public' ? `${quoteName(schema)}.` : ''}${quoteName(tableName)}.${quoteName(ref.column)}`);
  }
  return `${quoteName(name)} ${type}${all.length ? ` [${all.join(', ')}]` : ''}`;
}

/**
 * The column that points a table at `target` — `user_id bigint [not null, ref: > users.id]` — or null
 * when the target has no single-column primary key. The name is made unique within `table`.
 */
export function foreignKeyColumn(table, target) {
  const pk = primaryKeyOf(target);
  if (!pk) return null;
  const base = `${singular(target.name.toLowerCase()).replace(/[^a-z0-9_]+/g, '_')}_${pk.name}`;
  const taken = new Set((table?.columns || []).map((c) => c.name));
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base}_${n}`;
  return { name, line: buildColumnLine(name, typeText(pk.type), { settings: ['not null'], ref: { table: target.key, column: pk.name } }) };
}

/** One-click columns for the inspector. Each adds its lines, skipping names the table already has. */
export function columnPresets(model) {
  const mysql = dialectOf(model) === 'mysql';
  const ts = mysql ? 'datetime' : 'timestamptz';
  const now = mysql ? '`CURRENT_TIMESTAMP`' : '`now()`';
  return [
    { id: 'id', label: 'id', about: 'Auto-numbered primary key', lines: ['id bigint [pk, increment]'] },
    {
      id: 'uuid',
      label: 'uuid id',
      about: 'Random primary key, generated by the database',
      lines: [mysql ? 'id char(36) [pk, default: `uuid()`]' : 'id uuid [pk, default: `gen_random_uuid()`]'],
    },
    { id: 'timestamps', label: 'timestamps', about: 'created_at and updated_at, filled in on insert', lines: [`created_at ${ts} [not null, default: ${now}]`, `updated_at ${ts} [not null, default: ${now}]`] },
    { id: 'deleted_at', label: 'deleted_at', about: 'Soft delete: set it instead of deleting the row; null while the row is live', lines: [`deleted_at ${ts}`] },
    { id: 'email', label: 'email', about: 'Unique, required email address', lines: ['email varchar(255) [not null, unique]'] },
    { id: 'name', label: 'name', about: 'Required display name', lines: ['name varchar(255) [not null]'] },
    { id: 'status', label: 'status', about: "Short state label with a default ('active')", lines: ["status varchar(32) [not null, default: 'active']"] },
    { id: 'is_active', label: 'is_active', about: 'Flag, true by default', lines: ['is_active boolean [not null, default: true]'] },
  ];
}

/** The column names a line introduces (`created_at timestamptz …` → `created_at`). */
export const lineColumnName = (line) => {
  const match = String(line).match(/^\s*("(?:[^"\\]|\\.)*"|[^\s]+)/);
  return match ? match[1].replace(/^"|"$/g, '') : '';
};

/* -------------------------------------------------------------------------- */
/* defaults                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * What a person types as a default, as the parser's `{ kind, value }`:
 * `now()` → expression, `42` → number, `true` → word, `'x'` or `x` → string.
 * Blank → null.
 */
export function parseDefault(text) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  if (/^`.*`$/.test(value)) return { kind: 'expr', value: value.slice(1, -1) };
  if (/^-?\d+(\.\d+)?$/.test(value)) return { kind: 'number', value };
  if (/^(true|false|null)$/i.test(value)) return { kind: 'word', value: value.toLowerCase() };
  if (/^'.*'$|^".*"$/.test(value)) return { kind: 'string', value: value.slice(1, -1).replace(/\\(['"\\])/g, '$1') };
  if (/\(.*\)$|^current_(timestamp|date|time)$/i.test(value)) return { kind: 'expr', value };
  return { kind: 'string', value };
}

/** The inspector's text for a parsed default — what `parseDefault` reads back to the same value. */
export function defaultText(d) {
  if (!d) return '';
  if (d.kind === 'expr') return /\(.*\)$|^current_(timestamp|date|time)$/i.test(d.value) ? d.value : `\`${d.value}\``;
  if (d.kind === 'string') return /^-?\d+(\.\d+)?$|^(true|false|null)$/i.test(d.value) || /\(.*\)$/.test(d.value) ? `'${d.value}'` : d.value;
  return String(d.value);
}

/** Defaults worth offering for a type. */
export function defaultSuggestions(typeName, model) {
  const t = String(typeName ?? '').toLowerCase();
  const mysql = dialectOf(model) === 'mysql';
  if (/^(timestamp|timestamptz|datetime)/.test(t)) return mysql ? ['CURRENT_TIMESTAMP'] : ['now()'];
  if (/^date$/.test(t)) return mysql ? ['(CURRENT_DATE)'] : ['CURRENT_DATE'];
  if (/^uuid$/.test(t)) return ['gen_random_uuid()'];
  if (/^char\(36\)/.test(t)) return ['uuid()'];
  if (/^(bool|boolean)$/.test(t)) return ['true', 'false'];
  if (/^(int|integer|bigint|smallint|tinyint|decimal|numeric|real|float|float8|double)/.test(t)) return ['0'];
  if (/^jsonb?$/.test(t)) return mysql ? ['(JSON_OBJECT())'] : ["'{}'"];
  const e = model?.enums?.get?.(t.includes('.') ? t : tableKey(null, typeName));
  if (e) return e.values.map((v) => v.name);
  return [];
}

/* -------------------------------------------------------------------------- */
/* DBML words                                                                  */
/* -------------------------------------------------------------------------- */

const KEYWORD_DOCS = {
  table: ['Table', 'A table: its name, then one column per line inside { }'],
  ref: ['Ref', 'A relation between columns. Ref: orders.user_id > users.id — many orders to one user'],
  enum: ['Enum', 'A fixed list of values a column can take; use its name as the column type'],
  tablegroup: ['TableGroup', 'Groups tables that belong together (a domain, a service)'],
  project: ['Project', "Settings for the whole schema. database_type: 'MySQL' switches suggested types"],
  note: ['Note', 'A note shown with the table or column — requirements, why a column exists'],
  indexes: ['indexes', 'Indexes on the table: (a, b) [unique], or a single column. Speed up lookups by those columns'],
  as: ['as', 'A short alias for the table, usable in Refs'],
  tablepartial: ['TablePartial', 'Columns shared by several tables, included with ~name'],
};

const SETTING_DOCS = {
  pk: ['pk', 'Primary key — the column that identifies a row. Unique and never null'],
  primary: ['primary key', 'Primary key — the column that identifies a row. Unique and never null'],
  key: ['primary key', 'Primary key — the column that identifies a row. Unique and never null'],
  not: ['not null', 'A value is required: inserting a row without it fails'],
  null: ['null', 'The column may be empty (the default unless it is a key)'],
  unique: ['unique', 'No two rows may have the same value. Adds an index'],
  increment: ['increment', 'The database numbers new rows 1, 2, 3… (identity / AUTO_INCREMENT)'],
  default: ['default', 'The value used when an insert leaves the column out. Backticks for expressions: `now()`'],
  note: ['note', 'A note about this column'],
  ref: ['ref', 'An inline relation: ref: > users.id means many of these rows point to one user'],
  delete: ['delete', 'What happens to these rows when the referenced row is deleted: cascade, restrict, set null, no action'],
  update: ['update', 'What happens when the referenced key changes: cascade, restrict, set null, no action'],
  cascade: ['cascade', 'Follow the referenced row: delete or update these rows too'],
  restrict: ['restrict', 'Refuse to delete or change the referenced row while rows point at it'],
  set: ['set null', 'Empty this column when the referenced row goes away'],
  no: ['no action', 'Like restrict, but checked at the end of the statement'],
  action: ['no action', 'Like restrict, but checked at the end of the statement'],
  headercolor: ['headercolor', 'The colour of the table header on the diagram'],
  name: ['name', 'A name for this index or relation, used in the generated SQL'],
  type: ['type', 'The index method: btree (the default) or hash'],
  color: ['color', 'The colour of this relation or group on the diagram'],
};

/** The four relation kinds, as the inspector offers them. */
export const RELATION_KINDS = [
  { value: '>', label: 'many → one', about: 'Many rows here point to one row there — orders.user_id → users.id' },
  { value: '<', label: 'one → many', about: 'One row here, many rows there' },
  { value: '-', label: 'one ↔ one', about: 'Each row matches at most one row on the other side — users.id ↔ profiles.user_id' },
  { value: '<>', label: 'many ↔ many', about: 'Many to many — exported as a junction table holding both keys' },
];

const OP_DOCS = {
  '>': ['> many-to-one', 'Many rows on the left point to one row on the right (orders.user_id > users.id)'],
  '<': ['< one-to-many', 'One row on the left, many on the right'],
  '-': ['- one-to-one', 'Each row on one side matches at most one on the other (users.id - profiles.user_id)'],
  '<>': ['<> many-to-many', 'Many to many — exported as a junction table with both keys'],
};

/**
 * `{ title, body }` explaining a highlighted token of the DBML editor
 * (highlight.js kinds), or null when there is nothing to say about it.
 */
export function describeToken(kind, word, model) {
  const lower = String(word ?? '').toLowerCase();
  const pair = (entry) => (entry ? { title: entry[0], body: entry[1] } : null);
  switch (kind) {
    case 'keyword':
      return pair(KEYWORD_DOCS[lower]);
    case 'setting':
      return pair(SETTING_DOCS[lower]);
    case 'op':
      return pair(OP_DOCS[word]);
    case 'type': {
      const about = describeType(word.replace(/^"|"$/g, ''), model);
      return about ? { title: word, body: about } : null;
    }
    case 'expr':
      return { title: 'Expression', body: 'Written in backticks, evaluated by the database — `now()`, `gen_random_uuid()`' };
    case 'color':
      return { title: 'Colour', body: 'A hex colour for the diagram' };
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* deleting                                                                    */
/* -------------------------------------------------------------------------- */

const short = (key) => key.replace(/^public\./, '');
const endText = (end) => `${short(end.table)}.${end.columns.join(', ')}`;

/** Title and message for the dialog before tables are deleted: what else goes with them. */
export function tableDeletionSummary(model, keys) {
  const set = new Set(keys);
  const relations = model.relations.filter((r) => set.has(r.from.table) || set.has(r.to.table));
  const names = keys.map(short);
  const outside = relations.filter((r) => !set.has(r.from.table)).map((r) => endText(r.from));
  const title = names.length === 1 ? `Delete table ${names[0]}?` : `Delete ${names.length} tables?`;
  const columns = keys.reduce((n, key) => n + (model.byKey.get(key)?.columns.length || 0), 0);
  let message = `${names.length === 1 ? `${names[0]} and its ${columns} column${columns === 1 ? '' : 's'}` : `${names.join(', ')} (${columns} columns)`} will be removed from the schema`;
  message += relations.length ? `, with ${relations.length} relation${relations.length === 1 ? '' : 's'}.` : '.';
  if (outside.length) message += ` ${outside.join(', ')} will no longer reference ${names.length === 1 ? 'it' : 'them'} (the column${outside.length === 1 ? ' stays' : 's stay'}).`;
  return { title, message };
}

/** Title and message before a column is deleted. */
export function columnDeletionSummary(model, tableKeyName, columnName) {
  const through = model.relations.filter((r) => (r.from.table === tableKeyName && r.from.columns.includes(columnName)) || (r.to.table === tableKeyName && r.to.columns.includes(columnName)));
  let message = `${columnName} will be removed from ${short(tableKeyName)}.`;
  if (through.length) message += ` Relations through it go too: ${through.map((r) => `${endText(r.from)} → ${endText(r.to)}`).join('; ')}.`;
  return { title: `Delete column ${columnName}?`, message };
}

/** Title and message before a relation is deleted. */
export function relationDeletionSummary(relation) {
  return { title: 'Delete relation?', message: `${endText(relation.from)} will no longer reference ${endText(relation.to)}. Both columns stay.` };
}

/* -------------------------------------------------------------------------- */
/* a start                                                                     */
/* -------------------------------------------------------------------------- */

/** A small, complete schema to learn from or edit into your own: keys, an enum, references, a composite key. */
export const EXAMPLE_SCHEMA = `// An example to start from: change it, or select all and type your own.
// Hover any word to see what it means.

Table users {
  id bigint [pk, increment]
  email varchar(255) [not null, unique]
  name varchar(255) [not null]
  created_at timestamptz [not null, default: \`now()\`]
}

Table products {
  id bigint [pk, increment]
  name varchar(255) [not null]
  price decimal(12,2) [not null]
  stock int [not null, default: 0]
}

Enum order_status {
  pending
  paid
  shipped
  cancelled
}

Table orders {
  id bigint [pk, increment]
  user_id bigint [not null, ref: > users.id]
  status order_status [not null, default: 'pending']
  total decimal(12,2) [not null]
  created_at timestamptz [not null, default: \`now()\`]
}

Table order_items {
  order_id bigint [not null, ref: > orders.id]
  product_id bigint [not null, ref: > products.id]
  quantity int [not null, default: 1]
  unit_price decimal(12,2) [not null, note: 'The price when it was ordered']

  indexes {
    (order_id, product_id) [pk]
  }
}
`;
