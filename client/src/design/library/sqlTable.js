import { parseDbml } from '../schema/dbml.js';
import { SCHEMA_METRICS, tableSize } from '../schema/layout.js';

/**
 * The SQL table component for canvas boards.
 *
 * Its content is one DBML `Table` block — the same text a schema board holds —
 * so a table sketched on an HLD board can be pasted into a schema board (or
 * dbdiagram.io) as it is, and the column syntax is the one worth learning
 * anyway: `email varchar(255) [not null, unique]`, `user_id int [ref: > users.id]`.
 *
 * Pure: the view and the engine both read the parse and the size from here.
 */

export const DEFAULT_SQL_TABLE_TEXT = `Table users {
  id bigint [pk, increment]
  email varchar(255) [not null, unique]
  name varchar(120)
  created_at timestamp [default: \`now()\`]
}`;

/** Starting points in the library's Database tab. */
export const SQL_TABLE_TEMPLATES = [
  { id: 'blank', label: 'Table', text: 'Table table_name {\n  id bigint [pk, increment]\n}' },
  { id: 'users', label: 'users', text: DEFAULT_SQL_TABLE_TEXT },
  {
    id: 'orders',
    label: 'orders',
    text: `Table orders {
  id bigint [pk, increment]
  user_id bigint [not null, ref: > users.id]
  status varchar(20) [not null, default: 'pending']
  total_paise bigint [not null]
  created_at timestamp [default: \`now()\`]
}`,
  },
  {
    id: 'join',
    label: 'Join table',
    text: `Table user_roles {
  user_id bigint [ref: > users.id]
  role_id int [ref: > roles.id]
  granted_at timestamp

  indexes {
    (user_id, role_id) [pk]
  }
}`,
  },
  {
    id: 'events',
    label: 'Event log',
    text: `Table events {
  id bigint [pk, increment]
  aggregate_id uuid [not null]
  type varchar(50) [not null]
  payload jsonb
  occurred_at timestamp [not null, default: \`now()\`]

  indexes {
    (aggregate_id, occurred_at)
  }
}`,
  },
];

/**
 * `{ table, diagnostics }` — the first table in the text (or null), and what
 * went wrong. A block without the `Table name {` wrapper is read as columns of
 * an unnamed table, so pasting just column lines works too.
 */
export function parseSqlTable(text) {
  const source = String(text ?? '');
  let parsed = parseDbml(source);
  if (!parsed.tables.length && source.trim() && !/^\s*table\b/i.test(source)) {
    const wrapped = `Table table {\n${source}\n}`;
    const retry = parseDbml(wrapped);
    if (retry.tables.length) parsed = { ...retry, diagnostics: retry.diagnostics.map((d) => ({ ...d, span: { start: Math.max(0, d.span.start - 14), end: Math.max(0, d.span.end - 14) } })) };
  }
  return { table: parsed.tables[0] || null, diagnostics: parsed.diagnostics };
}

/** Box size for a table: height from its columns, width at least what they need. */
export function sqlTableSize(table, width) {
  const natural = table ? tableSize(table) : { w: SCHEMA_METRICS.minW, h: SCHEMA_METRICS.headerH + SCHEMA_METRICS.rowH };
  // Never narrower than the columns need: a width the user dragged is kept only while it still fits.
  return { w: Math.round(Math.max(SCHEMA_METRICS.minW, natural.w, width || 0)), h: natural.h };
}
