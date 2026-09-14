import { parseDbml } from './dbml.js';

/**
 * Turns a parsed DBML document into the model the diagram draws: tables keyed
 * by qualified name, relations with cardinality at each end, and diagnostics
 * for names that do not resolve.
 *
 * Unqualified names live in the `public` schema, as dbdiagram treats them, so
 * `users` and `public.users` are the same table; a table alias resolves too.
 * Inline refs (`user_id int [ref: > users.id]`) and `Ref` blocks produce the
 * same relation shape. Cardinality per end is 'one' or 'many'; `optional` on a
 * 'one' end means the referencing column may be null (drawn with a circle).
 *
 * Pure.
 */

const DEFAULT_SCHEMA = 'public';
export const tableKey = (schema, name) => `${schema || DEFAULT_SCHEMA}.${name}`;

const CARDINALITY = {
  '>': ['many', 'one'],
  '<': ['one', 'many'],
  '-': ['one', 'one'],
  '<>': ['many', 'many'],
};

export function analyzeDbml(sourceOrParsed) {
  const parsed = typeof sourceOrParsed === 'string' ? parseDbml(sourceOrParsed) : sourceOrParsed;
  const diagnostics = [...parsed.diagnostics];
  const problem = (message, s, severity = 'error') => diagnostics.push({ severity, message, span: s });

  const tables = [];
  const byKey = new Map();
  const byAlias = new Map();
  for (const table of parsed.tables) {
    const key = tableKey(table.schema, table.name);
    if (byKey.has(key)) {
      problem(`Table "${table.name}" is defined twice`, table.nameSpan);
      continue;
    }
    const seen = new Set();
    const columns = [];
    for (const column of table.columns) {
      if (seen.has(column.name)) {
        problem(`Column "${column.name}" appears twice in "${table.name}"`, column.nameSpan);
        continue;
      }
      seen.add(column.name);
      columns.push(column);
    }
    const entry = { ...table, key, columns };
    tables.push(entry);
    byKey.set(key, entry);
    if (table.alias) {
      if (byAlias.has(table.alias) || byKey.has(tableKey(null, table.alias))) problem(`Alias "${table.alias}" is already used`, table.nameSpan);
      else byAlias.set(table.alias, entry);
    }
  }

  const enums = new Map();
  for (const e of parsed.enums) {
    const key = tableKey(e.schema, e.name);
    if (enums.has(key)) problem(`Enum "${e.name}" is defined twice`, e.span);
    else enums.set(key, e);
  }

  const resolveTable = (schema, name) => byKey.get(tableKey(schema, name)) || (!schema ? byAlias.get(name) : null) || null;

  /** Resolves an endpoint, reporting what is missing. Returns { table, columns } or null. */
  const resolveEndpoint = (endpoint) => {
    const table = resolveTable(endpoint.schema, endpoint.table);
    if (!table) {
      problem(`No table named "${endpoint.schema ? `${endpoint.schema}.` : ''}${endpoint.table}"`, endpoint.tableSpan || endpoint.span);
      return null;
    }
    const columns = [];
    endpoint.columns.forEach((name, i) => {
      const column = table.columns.find((c) => c.name === name);
      if (!column) problem(`"${table.name}" has no column "${name}"`, endpoint.columnSpans?.[i] || endpoint.span);
      else columns.push(column);
    });
    return columns.length === endpoint.columns.length ? { table, columns } : null;
  };

  const relations = [];
  const addRelation = ({ from, to, op, span, name = null, inline = false, onDelete = null, onUpdate = null, color = null }) => {
    const a = resolveEndpoint(from);
    const b = resolveEndpoint(to);
    if (!a || !b) return;
    if (a.columns.length !== b.columns.length) {
      problem(`A composite reference needs the same number of columns on both sides (${a.columns.length} vs ${b.columns.length})`, span);
      return;
    }
    const [fromCard, toCard] = CARDINALITY[op];
    // The foreign key sits on the "many" side (the `from` side of a one-to-one). When it may be
    // null, the end it points at is "zero or one" rather than "exactly one".
    const nullable = (cols) => cols.some((c) => !c.pk && !c.notNull);
    const fkOnFrom = op === '>' || op === '-';
    relations.push({
      id: `${a.table.key}.(${a.columns.map((c) => c.name).join(',')})${op}${b.table.key}.(${b.columns.map((c) => c.name).join(',')})`,
      name,
      inline,
      op,
      from: { table: a.table.key, columns: a.columns.map((c) => c.name), card: fromCard, optional: fromCard === 'one' && op === '<' && nullable(b.columns) },
      to: { table: b.table.key, columns: b.columns.map((c) => c.name), card: toCard, optional: toCard === 'one' && fkOnFrom && nullable(a.columns) },
      onDelete,
      onUpdate,
      color,
      span,
    });
  };

  for (const table of tables) {
    for (const column of table.columns) {
      for (const ref of column.refs) {
        addRelation({
          from: { schema: table.schema, table: table.name, columns: [column.name], span: column.nameSpan, tableSpan: table.nameSpan, columnSpans: [column.nameSpan] },
          to: ref.target,
          op: ref.op,
          span: ref.span,
          inline: true,
        });
      }
    }
  }
  for (const ref of parsed.refs) {
    addRelation({ from: ref.from, to: ref.to, op: ref.op, span: ref.span, name: ref.name, onDelete: ref.delete, onUpdate: ref.update, color: ref.color });
  }

  // Columns typed with an enum name point at it; unknown non-SQL types are left alone (DBML allows any type).
  for (const table of tables) {
    for (const column of table.columns) {
      const enumKey = column.type.name.includes('.') ? column.type.name : tableKey(table.schema, column.type.name);
      if (enums.has(enumKey)) column.enum = enumKey;
      else if (enums.has(tableKey(null, column.type.name))) column.enum = tableKey(null, column.type.name);
    }
  }

  const groups = parsed.groups.map((group) => ({
    ...group,
    tables: group.tables
      .map((ref) => {
        const table = resolveTable(ref.schema, ref.name);
        if (!table) problem(`TableGroup "${group.name}" lists unknown table "${ref.name}"`, ref.span, 'warning');
        return table?.key;
      })
      .filter(Boolean),
  }));

  diagnostics.sort((a, b) => a.span.start - b.span.start);
  return { project: parsed.project, tables, byKey, enums, relations, groups, notes: parsed.notes, diagnostics };
}
