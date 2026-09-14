/**
 * SQL DDL → DBML, for pasting an existing schema into a schema board.
 *
 * Reads the statements that describe structure — CREATE TABLE, ALTER TABLE …
 * ADD (CONSTRAINT) FOREIGN KEY / PRIMARY KEY / UNIQUE, CREATE [UNIQUE] INDEX,
 * CREATE TYPE … AS ENUM, COMMENT ON — in PostgreSQL and MySQL flavours (SQLite
 * mostly parses as either), and skips everything else (INSERTs, grants, SETs…)
 * with a note. It is a tolerant reader, not a validator: unknown column options
 * are ignored, so a real-world dump imports without hand-editing.
 *
 * Returns `{ dbml, warnings }`. Pure.
 */

/* -------------------------------------------------------------------------- */
/* tokens                                                                      */
/* -------------------------------------------------------------------------- */

function tokenizeSql(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (ch === '-' && src[i + 1] === '-') {
      while (i < src.length && src[i] !== '\n') i += 1;
    } else if (ch === '#' && (i === 0 || src[i - 1] === '\n')) {
      while (i < src.length && src[i] !== '\n') i += 1; // MySQL line comment
    } else if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
    } else if (ch === "'") {
      let j = i + 1;
      let value = '';
      while (j < src.length) {
        if (src[j] === "'" && src[j + 1] === "'") {
          value += "'";
          j += 2;
        } else if (src[j] === '\\' && j + 1 < src.length) {
          value += src[j + 1];
          j += 2;
        } else if (src[j] === "'") break;
        else value += src[j++];
      }
      tokens.push({ type: 'string', value, start: i, end: j + 1 });
      i = j + 1;
    } else if (ch === '"' || ch === '`' || (ch === '[' && /[\p{L}_]/u.test(src[i + 1] || ''))) {
      // [name] is SQL Server quoting; [] and [3] after a type are Postgres arrays.
      const close = ch === '[' ? ']' : ch;
      const end = src.indexOf(close, i + 1);
      const stop = end < 0 ? src.length : end;
      tokens.push({ type: 'ident', quoted: true, value: src.slice(i + 1, stop), start: i, end: stop + 1 });
      i = stop + 1;
    } else if (ch === '$' && /[$A-Za-z_]/.test(src[i + 1] || '')) {
      // Postgres dollar quoting ($$ … $$ or $tag$ … $tag$) — function bodies; kept as one opaque string.
      const tag = src.slice(i).match(/^\$[A-Za-z_]*\$/)?.[0];
      if (tag) {
        const end = src.indexOf(tag, i + tag.length);
        const stop = end < 0 ? src.length : end + tag.length;
        tokens.push({ type: 'string', value: src.slice(i + tag.length, end < 0 ? src.length : end), start: i, end: stop });
        i = stop;
      } else {
        tokens.push({ type: 'punct', value: ch, start: i, end: i + 1 });
        i += 1;
      }
    } else if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i + 1;
      while (j < src.length && /[0-9.eE]/.test(src[j])) j += 1;
      tokens.push({ type: 'number', value: src.slice(i, j), start: i, end: j });
      i = j;
    } else if (/[\p{L}_]/u.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[\p{L}\p{N}_$]/u.test(src[j])) j += 1;
      tokens.push({ type: 'ident', quoted: false, value: src.slice(i, j), start: i, end: j });
      i = j;
    } else if (ch === ':' && src[i + 1] === ':') {
      tokens.push({ type: 'punct', value: '::', start: i, end: i + 2 });
      i += 2;
    } else {
      tokens.push({ type: 'punct', value: ch, start: i, end: i + 1 });
      i += 1;
    }
  }
  return tokens;
}

/** Statements as token arrays, split on top-level semicolons. */
function statements(tokens) {
  const out = [];
  let current = [];
  for (const t of tokens) {
    if (t.type === 'punct' && t.value === ';') {
      if (current.length) out.push(current);
      current = [];
    } else current.push(t);
  }
  if (current.length) out.push(current);
  return out;
}

/* -------------------------------------------------------------------------- */
/* model                                                                       */
/* -------------------------------------------------------------------------- */

export function sqlToDbml(sql) {
  const src = String(sql ?? '');
  const warnings = [];
  const tables = new Map(); // key → { schema, name, columns: Map, pk: [], indexes: [], note }
  const enums = new Map(); // key → { schema, name, values }
  const refs = [];

  const keyOf = (schema, name) => `${schema || ''}.${name}`;
  const getTable = (schema, name) => tables.get(keyOf(schema, name)) || tables.get(keyOf(null, name)) || [...tables.values()].find((t) => t.name === name) || null;

  for (const stmt of statements(tokenizeSql(src))) {
    let pos = 0;
    const peek = (o = 0) => stmt[pos + o];
    const next = () => stmt[pos++];
    const isWord = (t, ...words) => t && t.type === 'ident' && !t.quoted && words.includes(t.value.toUpperCase());
    const atWord = (...words) => isWord(peek(), ...words);
    const acceptWord = (...words) => (atWord(...words) ? next() : null);
    const atPunct = (v) => peek()?.type === 'punct' && peek().value === v;
    const acceptPunct = (v) => (atPunct(v) ? next() : null);
    const rawFrom = (start, end) => src.slice(start, end).trim();

    /** schema.name | name — returns { schema, name } */
    const qualifiedName = () => {
      const parts = [next().value];
      while (atPunct('.') && peek(1)?.type === 'ident') {
        next();
        parts.push(next().value);
      }
      return { schema: parts.length > 1 ? parts.slice(0, -1).join('.') : null, name: parts.at(-1) };
    };

    /** ( a, b DESC, … ) → names (expressions kept as `expr`). */
    const columnList = () => {
      const cols = [];
      if (!acceptPunct('(')) return cols;
      while (pos < stmt.length && !atPunct(')')) {
        const start = peek().start;
        let depth = 0;
        const first = peek();
        let count = 0;
        while (pos < stmt.length && !(depth === 0 && (atPunct(',') || atPunct(')')))) {
          if (atPunct('(')) depth += 1;
          if (atPunct(')')) depth -= 1;
          next();
          count += 1;
        }
        const end = stmt[pos - 1].end;
        // "name" or "name ASC/DESC" is a column; anything else is an expression.
        const simple = first.type === 'ident' && (count === 1 || (count === 2 && isWord(stmt[pos - 1], 'ASC', 'DESC')));
        cols.push(simple ? { name: first.value } : { expr: rawFrom(start, end) });
        acceptPunct(',');
      }
      acceptPunct(')');
      return cols;
    };

    /** Skips a balanced ( … ) group. */
    const skipParens = () => {
      if (!atPunct('(')) return;
      let depth = 0;
      do {
        if (atPunct('(')) depth += 1;
        if (atPunct(')')) depth -= 1;
        next();
      } while (pos < stmt.length && depth > 0);
    };

    const referentialActions = (ref) => {
      while (atWord('ON', 'MATCH', 'DEFERRABLE', 'INITIALLY', 'NOT')) {
        if (acceptWord('MATCH')) {
          next();
          continue;
        }
        if (acceptWord('DEFERRABLE', 'INITIALLY', 'NOT')) {
          acceptWord('DEFERRABLE', 'DEFERRED', 'IMMEDIATE');
          continue;
        }
        next(); // ON
        const which = next()?.value.toUpperCase();
        const words = [];
        while (atWord('CASCADE', 'RESTRICT', 'NO', 'ACTION', 'SET', 'NULL', 'DEFAULT')) words.push(next().value.toLowerCase());
        if (which === 'DELETE') ref.delete = words.join(' ');
        if (which === 'UPDATE') ref.update = words.join(' ');
      }
    };

    const references = (fromTable, fromCols, name = null) => {
      acceptWord('REFERENCES');
      const target = qualifiedName();
      const toCols = columnList().map((c) => c.name).filter(Boolean);
      const ref = { name, from: { schema: fromTable.schema, table: fromTable.name, columns: fromCols }, to: { schema: target.schema, table: target.name, columns: toCols }, delete: null, update: null };
      referentialActions(ref);
      refs.push(ref);
    };

    try {
      if (atWord('CREATE')) {
        next();
        acceptWord('OR');
        acceptWord('REPLACE');
        acceptWord('TEMP', 'TEMPORARY', 'UNLOGGED', 'GLOBAL', 'LOCAL');
        acceptWord('TEMP', 'TEMPORARY');
        if (acceptWord('TABLE')) {
          if (acceptWord('IF')) {
            acceptWord('NOT');
            acceptWord('EXISTS');
          }
          const { schema, name } = qualifiedName();
          if (!atPunct('(')) {
            warnings.push(`Skipped CREATE TABLE ${name} (no column list — AS SELECT or LIKE)`);
            continue;
          }
          const table = { schema: schema === 'public' || schema === 'dbo' ? null : schema, name, columns: new Map(), pk: [], indexes: [], note: null };
          tables.set(keyOf(table.schema, name), table);
          next(); // (
          while (pos < stmt.length && !atPunct(')')) {
            let constraintName = null;
            if (acceptWord('CONSTRAINT')) constraintName = next().value;
            if (atWord('PRIMARY')) {
              next();
              acceptWord('KEY');
              table.pk = columnList().map((c) => c.name).filter(Boolean);
            } else if (atWord('UNIQUE') && (peek(1)?.value === '(' || isWord(peek(1), 'KEY', 'INDEX'))) {
              next();
              acceptWord('KEY', 'INDEX');
              const indexName = peek()?.type === 'ident' && peek(1)?.value === '(' ? next().value : null;
              table.indexes.push({ columns: columnList(), unique: true, name: constraintName ?? indexName });
            } else if (atWord('FOREIGN')) {
              next();
              acceptWord('KEY');
              const cols = columnList().map((c) => c.name).filter(Boolean);
              references(table, cols, constraintName);
            } else if (atWord('CHECK', 'EXCLUDE')) {
              next();
              if (atWord('USING')) {
                next();
                next();
              }
              skipParens();
            } else if (atWord('KEY', 'INDEX') && peek(1)?.type === 'ident') {
              // MySQL inline index: KEY idx_name (cols) [USING BTREE]
              next();
              const indexName = next().value;
              const cols = columnList();
              let type = null;
              if (acceptWord('USING')) type = next().value.toLowerCase();
              table.indexes.push({ columns: cols, unique: false, name: indexName, type });
            } else {
              // Column definition.
              const column = { name: next().value, type: '', args: null, array: false, pk: false, notNull: false, unique: false, increment: false, default: null, note: null };
              const typeWords = [];
              const characterSet = () => atWord('CHARACTER') && isWord(peek(1), 'SET');
              while (peek() && peek().type === 'ident' && !characterSet() && !atWord('PRIMARY', 'NOT', 'NULL', 'UNIQUE', 'DEFAULT', 'REFERENCES', 'CHECK', 'CONSTRAINT', 'AUTO_INCREMENT', 'AUTOINCREMENT', 'GENERATED', 'COMMENT', 'COLLATE', 'CHARSET', 'IDENTITY', 'ON', 'UNSIGNED', 'SIGNED', 'ZEROFILL', 'KEY')) {
                typeWords.push(next().value);
                if (atPunct('.')) {
                  next();
                  typeWords[typeWords.length - 1] += `.${next().value}`;
                }
              }
              if (atPunct('(')) {
                const start = peek().start;
                skipParens();
                const inner = rawFrom(start + 1, stmt[pos - 1].start);
                if (/^enum$/i.test(typeWords.at(-1) || '') || /^set$/i.test(typeWords.at(-1) || '')) {
                  const values = [...inner.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
                  const enumName = `${table.name}_${column.name}_enum`;
                  enums.set(keyOf(table.schema, enumName), { schema: table.schema, name: enumName, values });
                  typeWords[typeWords.length - 1] = enumName;
                } else {
                  column.args = inner.split(',').map((a) => a.trim()).filter(Boolean);
                }
              }
              // Words after the arguments that still belong to the type: "varying", "with time zone", "precision".
              while (atWord('WITH', 'WITHOUT', 'TIME', 'ZONE', 'VARYING', 'PRECISION')) typeWords.push(next().value);
              while (atPunct('[')) {
                next();
                if (peek()?.type === 'number') next();
                acceptPunct(']');
                column.array = true;
              }
              let type = typeWords.join(' ');
              if (/^(small|big)?serial$/i.test(type)) {
                column.increment = true;
                type = { serial: 'int', bigserial: 'bigint', smallserial: 'smallint' }[type.toLowerCase()];
              }
              column.type = type || 'text';
              if (!type) warnings.push(`Column ${table.name}.${column.name} has no type; imported as text`);
              // Column constraints, in any order.
              while (pos < stmt.length && !atPunct(',') && !atPunct(')')) {
                if (acceptWord('CONSTRAINT')) {
                  next();
                } else if (acceptWord('PRIMARY')) {
                  acceptWord('KEY');
                  column.pk = true;
                } else if (acceptWord('NOT')) {
                  if (acceptWord('NULL')) column.notNull = true;
                } else if (acceptWord('NULL')) {
                  // explicit NULL — the default
                } else if (acceptWord('UNIQUE')) {
                  acceptWord('KEY');
                  column.unique = true;
                } else if (acceptWord('AUTO_INCREMENT', 'AUTOINCREMENT', 'IDENTITY')) {
                  column.increment = true;
                  skipParens();
                } else if (acceptWord('GENERATED')) {
                  if (acceptWord('ALWAYS', 'BY')) acceptWord('DEFAULT');
                  if (acceptWord('AS')) {
                    if (acceptWord('IDENTITY')) {
                      column.increment = true;
                      skipParens();
                    } else {
                      skipParens(); // a computed column: GENERATED ALWAYS AS (expr) STORED
                      acceptWord('STORED', 'VIRTUAL');
                    }
                  }
                } else if (acceptWord('DEFAULT')) {
                  const start = peek().start;
                  let depth = 0;
                  let first = true;
                  while (pos < stmt.length && !(depth === 0 && (atPunct(',') || atPunct(')') || (!first && atWord('NOT', 'NULL', 'PRIMARY', 'UNIQUE', 'REFERENCES', 'CHECK', 'CONSTRAINT', 'COMMENT', 'ON', 'AUTO_INCREMENT', 'COLLATE'))))) {
                    if (atPunct('(')) depth += 1;
                    if (atPunct(')')) depth -= 1;
                    next();
                    first = false;
                  }
                  column.default = parseDefault(rawFrom(start, stmt[pos - 1].end));
                } else if (atWord('REFERENCES')) {
                  references(table, [column.name]);
                } else if (acceptWord('CHECK')) {
                  skipParens();
                } else if (acceptWord('COMMENT')) {
                  if (peek()?.type === 'string') column.note = next().value;
                } else if (acceptWord('COLLATE', 'CHARACTER', 'CHARSET')) {
                  acceptWord('SET');
                  next();
                } else if (acceptWord('ON')) {
                  // MySQL: ON UPDATE CURRENT_TIMESTAMP
                  acceptWord('UPDATE');
                  next();
                  skipParens();
                } else if (atPunct('(')) {
                  skipParens();
                } else {
                  next(); // UNSIGNED, ZEROFILL, anything unknown
                }
              }
              table.columns.set(column.name, column);
            }
            acceptPunct(',');
          }
          acceptPunct(')');
          // Table options: MySQL COMMENT='…'
          while (pos < stmt.length) {
            if (acceptWord('COMMENT')) {
              acceptPunct('=');
              if (peek()?.type === 'string') table.note = next().value;
            } else next();
          }
        } else if (acceptWord('UNIQUE') || atWord('INDEX')) {
          const unique = stmt[pos - 1] && isWord(stmt[pos - 1], 'UNIQUE');
          acceptWord('INDEX');
          acceptWord('CONCURRENTLY');
          if (acceptWord('IF')) {
            acceptWord('NOT');
            acceptWord('EXISTS');
          }
          const indexName = atWord('ON') ? null : qualifiedName().name;
          acceptWord('ON');
          acceptWord('ONLY');
          const target = qualifiedName();
          let type = null;
          if (acceptWord('USING')) type = next().value.toLowerCase();
          const columns = columnList();
          if (acceptWord('USING')) type = next().value.toLowerCase();
          const table = getTable(target.schema, target.name);
          if (table) table.indexes.push({ columns, unique, name: indexName, type });
          else warnings.push(`Index ${indexName || ''} is on unknown table ${target.name}`);
        } else if (acceptWord('TYPE')) {
          const { schema, name } = qualifiedName();
          if (acceptWord('AS') && acceptWord('ENUM')) {
            const values = [];
            acceptPunct('(');
            while (pos < stmt.length && !atPunct(')')) {
              const t = next();
              if (t.type === 'string') values.push(t.value);
            }
            enums.set(keyOf(schema === 'public' ? null : schema, name), { schema: schema === 'public' ? null : schema, name, values });
          } else {
            warnings.push(`Skipped CREATE TYPE ${name} (only enums are imported)`);
          }
        } else {
          warnings.push(`Skipped CREATE ${peek()?.value ?? ''} statement`);
        }
      } else if (atWord('ALTER') && isWord(peek(1), 'TABLE')) {
        next();
        next();
        acceptWord('ONLY');
        if (acceptWord('IF')) acceptWord('EXISTS');
        acceptWord('ONLY');
        const target = qualifiedName();
        const table = getTable(target.schema, target.name);
        while (pos < stmt.length) {
          if (!acceptWord('ADD')) {
            next();
            continue;
          }
          let constraintName = null;
          if (acceptWord('CONSTRAINT')) constraintName = next().value;
          if (acceptWord('FOREIGN')) {
            acceptWord('KEY');
            const cols = columnList().map((c) => c.name).filter(Boolean);
            references(table || { schema: target.schema, name: target.name }, cols, constraintName);
          } else if (acceptWord('PRIMARY')) {
            acceptWord('KEY');
            const cols = columnList().map((c) => c.name).filter(Boolean);
            if (table) table.pk = cols;
          } else if (acceptWord('UNIQUE')) {
            acceptWord('KEY', 'INDEX');
            const indexName = peek()?.type === 'ident' && peek(1)?.value === '(' ? next().value : null;
            const cols = columnList();
            if (table) table.indexes.push({ columns: cols, unique: true, name: constraintName ?? indexName });
          }
        }
        if (!table) warnings.push(`ALTER TABLE on unknown table ${target.name}`);
      } else if (atWord('COMMENT') && isWord(peek(1), 'ON')) {
        next();
        next();
        const what = next()?.value.toUpperCase();
        const parts = [next().value];
        while (acceptPunct('.')) parts.push(next().value);
        acceptWord('IS');
        const text = peek()?.type === 'string' ? next().value : null;
        if (what === 'TABLE') {
          const table = getTable(parts.length > 1 ? parts.at(-2) : null, parts.at(-1));
          if (table) table.note = text;
        } else if (what === 'COLUMN') {
          const table = getTable(parts.length > 2 ? parts.at(-3) : null, parts.at(-2));
          const column = table?.columns.get(parts.at(-1));
          if (column) column.note = text;
        }
      } else if (stmt.length) {
        const word = peek()?.value?.toUpperCase();
        if (!['SET', 'INSERT', 'BEGIN', 'COMMIT', 'START', 'USE', 'DROP', 'LOCK', 'UNLOCK', 'SELECT', 'GRANT', 'REVOKE'].includes(word)) warnings.push(`Skipped ${peek()?.value ?? ''} statement`);
      }
    } catch {
      warnings.push(`Could not read a statement near "${rawFrom(stmt[0].start, Math.min(stmt[0].start + 60, stmt.at(-1).end))}"`);
    }
  }

  return { dbml: formatDbml({ tables, enums, refs }), warnings };
}

function parseDefault(raw) {
  let text = raw.replace(/::[\w\s"[\]]+$/g, '').trim(); // Postgres casts: 'x'::text
  if (/^\(.*\)$/s.test(text)) text = text.slice(1, -1).trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) return { kind: 'number', value: text };
  if (/^'(.*)'$/s.test(text)) return { kind: 'string', value: text.slice(1, -1).replace(/''/g, "'") };
  if (!text || /^null$/i.test(text)) return null;
  if (/^(true|false)$/i.test(text)) return { kind: 'word', value: text.toLowerCase() };
  return { kind: 'expr', value: text };
}

/* -------------------------------------------------------------------------- */
/* DBML out                                                                    */
/* -------------------------------------------------------------------------- */

const ident = (name) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '\\"')}"`);
const qualify = (schema, name) => (schema ? `${ident(schema)}.${ident(name)}` : ident(name));
const quoteString = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function formatDbml({ tables, enums, refs }) {
  const blocks = [];
  for (const e of enums.values()) {
    blocks.push(`Enum ${qualify(e.schema, e.name)} {\n${e.values.map((v) => `  ${ident(v)}`).join('\n')}\n}`);
  }
  for (const table of tables.values()) {
    const lines = [];
    const singlePk = table.pk.length === 1 ? table.pk[0] : null;
    for (const column of table.columns.values()) {
      const settings = [];
      if (column.pk || column.name === singlePk) settings.push('pk');
      if (column.increment) settings.push('increment');
      if (column.notNull && !(column.pk || column.name === singlePk)) settings.push('not null');
      if (column.unique) settings.push('unique');
      if (column.default) {
        const d = column.default;
        settings.push(`default: ${d.kind === 'number' || d.kind === 'word' ? d.value : d.kind === 'string' ? quoteString(d.value) : `\`${d.value.replace(/`/g, '')}\``}`);
      }
      if (column.note) settings.push(`note: ${quoteString(column.note)}`);
      const type = `${/\s/.test(column.type) ? `"${column.type}"` : column.type}${column.args?.length ? `(${column.args.join(',')})` : ''}${column.array ? '[]' : ''}`;
      lines.push(`  ${ident(column.name)} ${type}${settings.length ? ` [${settings.join(', ')}]` : ''}`);
    }
    const indexLines = [];
    if (table.pk.length > 1) indexLines.push(`    (${table.pk.map(ident).join(', ')}) [pk]`);
    for (const index of table.indexes) {
      const cols = index.columns.map((c) => (c.expr ? `\`${c.expr.replace(/`/g, '')}\`` : ident(c.name)));
      const target = cols.length === 1 ? cols[0] : `(${cols.join(', ')})`;
      const settings = [];
      if (index.unique) settings.push('unique');
      if (index.name) settings.push(`name: ${quoteString(index.name)}`);
      if (index.type) settings.push(`type: ${index.type}`);
      indexLines.push(`    ${target}${settings.length ? ` [${settings.join(', ')}]` : ''}`);
    }
    if (indexLines.length) lines.push('', '  indexes {', ...indexLines, '  }');
    if (table.note) lines.push('', `  Note: ${quoteString(table.note)}`);
    blocks.push(`Table ${qualify(table.schema, table.name)} {\n${lines.join('\n')}\n}`);
  }
  for (const ref of refs) {
    const side = (end) => `${qualify(end.schema === 'public' ? null : end.schema, end.table)}.${end.columns.length === 1 ? ident(end.columns[0]) : `(${end.columns.map(ident).join(', ')})`}`;
    const settings = [ref.delete && `delete: ${ref.delete}`, ref.update && `update: ${ref.update}`].filter(Boolean);
    blocks.push(`Ref${ref.name ? ` ${ident(ref.name)}` : ''}: ${side(ref.from)} > ${side(ref.to)}${settings.length ? ` [${settings.join(', ')}]` : ''}`);
  }
  return blocks.length ? `${blocks.join('\n\n')}\n` : '';
}
