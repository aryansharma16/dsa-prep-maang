import { parseDbml } from './dbml.js';

/**
 * Diagram actions as text edits on the DBML source.
 *
 * The text is the truth on a schema board; the diagram only proposes changes to
 * it. Every function here takes the source and returns the new source, changing
 * exactly the characters it must (found through the parser's spans), so the
 * author's formatting, ordering and comments survive a rename done by
 * double-clicking a table header.
 *
 * Pure. Each returns the source unchanged when the thing it edits is not found.
 */

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const quoteName = (name) => (IDENT.test(name) ? name : `"${String(name).replace(/"/g, '\\"')}"`);

/** Applies non-overlapping `{ start, end, text }` edits, last first so spans stay valid. */
export function applyEdits(source, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  let floor = Infinity;
  for (const edit of sorted) {
    if (edit.end > floor) continue; // overlapping edit: the later one already covered this text
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    floor = edit.start;
  }
  return out;
}

const sameTable = (schema, name, ref) => ref.table === name && (ref.schema || null) === (schema || null);

function findTable(parsed, key) {
  const [schema, ...rest] = key.includes('.') ? key.split('.') : [null, key];
  const name = rest.join('.');
  return parsed.tables.find((t) => t.name === name && ((t.schema || 'public') === (schema || 'public'))) || null;
}

/** Deletes a span together with the line break and indentation around it, if it sits on lines of its own. */
function removeWithLine(source, start, end) {
  let s = start;
  let e = end;
  while (s > 0 && (source[s - 1] === ' ' || source[s - 1] === '\t')) s -= 1;
  const atLineStart = s === 0 || source[s - 1] === '\n';
  let e2 = e;
  while (e2 < source.length && (source[e2] === ' ' || source[e2] === '\t')) e2 += 1;
  const atLineEnd = e2 === source.length || source[e2] === '\n';
  if (atLineStart && atLineEnd) {
    e = e2 < source.length ? e2 + 1 : e2;
    return { start: s, end: e, text: '' };
  }
  return { start, end, text: '' };
}

/* -------------------------------------------------------------------------- */

/** Renames a table and every reference to it: Ref endpoints, inline refs, TableGroup entries. */
export function renameTable(source, key, newName) {
  const parsed = parseDbml(source);
  const table = findTable(parsed, key);
  if (!table || !newName || newName === table.name) return source;
  const nameText = quoteName(newName);
  const edits = [];
  // The name token is the last part of the qualified name span.
  const nameStart = source.lastIndexOf(source.slice(table.nameSpan.start, table.nameSpan.end).split('.').pop(), table.nameSpan.end);
  edits.push({ start: nameStart, end: table.nameSpan.end, text: nameText });
  const touch = (endpoint) => {
    if (endpoint && sameTable(table.schema, table.name, endpoint) && endpoint.tableSpan) edits.push({ start: endpoint.tableSpan.start, end: endpoint.tableSpan.end, text: nameText });
  };
  for (const ref of parsed.refs) {
    touch(ref.from);
    touch(ref.to);
  }
  for (const t of parsed.tables) for (const c of t.columns) for (const r of c.refs) touch(r.target);
  for (const group of parsed.groups) {
    for (const entry of group.tables) {
      if (entry.name === table.name && (entry.schema || null) === (table.schema || null)) {
        const last = source.lastIndexOf(source.slice(entry.span.start, entry.span.end).split('.').pop(), entry.span.end);
        edits.push({ start: last, end: entry.span.end, text: nameText });
      }
    }
  }
  return applyEdits(source, edits);
}

/** Renames a column, and the references to it. */
export function renameColumn(source, key, oldName, newName) {
  const parsed = parseDbml(source);
  const table = findTable(parsed, key);
  const column = table?.columns.find((c) => c.name === oldName);
  if (!column || !newName || newName === oldName) return source;
  const nameText = quoteName(newName);
  const edits = [{ start: column.nameSpan.start, end: column.nameSpan.end, text: nameText }];
  const touch = (endpoint) => {
    if (!endpoint || !sameTable(table.schema, table.name, endpoint)) return;
    endpoint.columns.forEach((name, i) => {
      if (name === oldName && endpoint.columnSpans?.[i]) edits.push({ start: endpoint.columnSpans[i].start, end: endpoint.columnSpans[i].end, text: nameText });
    });
  };
  for (const ref of parsed.refs) {
    touch(ref.from);
    touch(ref.to);
  }
  for (const t of parsed.tables) for (const c of t.columns) for (const r of c.refs) touch(r.target);
  return applyEdits(source, edits);
}

/** Adds a column line (`name type [settings]`) at the end of a table, matching its indentation. */
export function addColumn(source, key, line) {
  const parsed = parseDbml(source);
  const table = findTable(parsed, key);
  if (!table) return source;
  const last = table.columns.at(-1);
  let indent = '  ';
  let at;
  if (last) {
    const lineStart = source.lastIndexOf('\n', last.span.start) + 1;
    indent = source.slice(lineStart, last.span.start).match(/^\s*/)[0] || '  ';
    at = last.span.end;
    return `${source.slice(0, at)}\n${indent}${line}${source.slice(at)}`;
  }
  // No columns yet: just inside the opening brace.
  at = source.indexOf('{', table.nameSpan.end) + 1;
  return `${source.slice(0, at)}\n${indent}${line}${source.slice(at)}`;
}

/** Removes a column line. */
export function removeColumn(source, key, columnName) {
  const parsed = parseDbml(source);
  const column = findTable(parsed, key)?.columns.find((c) => c.name === columnName);
  if (!column) return source;
  return applyEdits(source, [removeWithLine(source, column.span.start, column.span.end)]);
}

/** Replaces a whole column line's text (name, type and settings) in place. */
export function replaceColumn(source, key, columnName, line) {
  const parsed = parseDbml(source);
  const column = findTable(parsed, key)?.columns.find((c) => c.name === columnName);
  if (!column) return source;
  return applyEdits(source, [{ start: column.span.start, end: column.span.end, text: line }]);
}

/** Appends a new table block. */
export function addTable(source, name, columns = ['id bigint [pk, increment]']) {
  const block = `Table ${quoteName(name)} {\n${columns.map((c) => `  ${c}`).join('\n')}\n}\n`;
  const trimmed = source.replace(/\s*$/, '');
  return trimmed ? `${trimmed}\n\n${block}` : block;
}

/** Removes a table block, every Ref that mentions it, inline refs pointing at it, and its TableGroup entries. */
export function removeTable(source, key) {
  const parsed = parseDbml(source);
  const table = findTable(parsed, key);
  if (!table) return source;
  const edits = [removeWithLine(source, table.span.start, table.span.end)];
  const mentions = (endpoint) => sameTable(table.schema, table.name, endpoint);
  for (const ref of parsed.refs) if (mentions(ref.from) || mentions(ref.to)) edits.push(removeWithLine(source, ref.span.start, ref.span.end));
  for (const t of parsed.tables) {
    if (t === table) continue;
    for (const c of t.columns) for (const r of c.refs) if (mentions(r.target)) edits.push(removeInlineRef(source, c, r));
  }
  for (const group of parsed.groups) {
    for (const entry of group.tables) if (entry.name === table.name) edits.push(removeWithLine(source, entry.span.start, entry.span.end));
  }
  return applyEdits(source, edits.filter(Boolean)).replace(/\n{3,}/g, '\n\n');
}

/** The edit that removes one inline `ref: …` from a column's settings (and the brackets if nothing is left). */
function removeInlineRef(source, column, ref) {
  const settings = column.settingsSpan;
  if (!settings) return null;
  const inner = source.slice(settings.start + 1, settings.end - 1);
  const refText = source.slice(ref.span.start, ref.span.end);
  const parts = inner.split(',').map((p) => p.trim()).filter(Boolean);
  const kept = parts.filter((p) => p.replace(/\s+/g, ' ') !== refText.replace(/\s+/g, ' '));
  if (kept.length === parts.length) return null;
  // Drop the space before the brackets too when they go.
  const start = kept.length ? settings.start : source[settings.start - 1] === ' ' ? settings.start - 1 : settings.start;
  return { start, end: settings.end, text: kept.length ? `[${kept.join(', ')}]` : '' };
}

/** Appends `Ref: from > to`. `from`/`to` are `{ table: key, columns: [...] }`. */
export function addRelation(source, from, to, op = '>') {
  const side = ({ table, columns }) => {
    const [schema, ...rest] = table.split('.');
    const name = rest.join('.');
    const qualified = schema && schema !== 'public' ? `${quoteName(schema)}.${quoteName(name)}` : quoteName(name);
    return `${qualified}.${columns.length === 1 ? quoteName(columns[0]) : `(${columns.map(quoteName).join(', ')})`}`;
  };
  const line = `Ref: ${side(from)} ${op} ${side(to)}`;
  const trimmed = source.replace(/\s*$/, '');
  return `${trimmed}${trimmed ? '\n' : ''}${line}\n`;
}

/**
 * Removes a relation from an analyzed model (`relation.span`, `relation.inline`):
 * a Ref line, or the inline `ref:` setting on the column.
 */
export function removeRelation(source, relation) {
  const parsed = parseDbml(source);
  if (relation.inline) {
    for (const t of parsed.tables) {
      for (const c of t.columns) {
        for (const r of c.refs) {
          if (r.span.start === relation.span.start && r.span.end === relation.span.end) {
            const edit = removeInlineRef(source, c, r);
            return edit ? applyEdits(source, [edit]) : source;
          }
        }
      }
    }
    return source;
  }
  const ref = parsed.refs.find((r) => r.span.start === relation.span.start && r.span.end === relation.span.end);
  return ref ? applyEdits(source, [removeWithLine(source, ref.span.start, ref.span.end)]) : source;
}

/** Changes a relation's operator (`>`, `<`, `-`, `<>`) in place. */
export function setRelationOp(source, relation, op) {
  const text = source.slice(relation.span.start, relation.span.end);
  const match = text.match(/\s(<>|>|<|-)\s/);
  if (!match) return source;
  const at = relation.span.start + match.index + 1;
  return applyEdits(source, [{ start: at, end: at + match[1].length, text: op }]);
}

const quoteSettingString = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * A parsed column (see dbml.js) written back as one DBML line — for editing a
 * column's flags from the inspector without losing its default, note or refs.
 */
export function columnLine(column) {
  const type = `${/\s/.test(column.type.name) ? `"${column.type.name}"` : column.type.name}${column.type.args?.length ? `(${column.type.args.join(',')})` : ''}${column.type.array ? '[]' : ''}`;
  const settings = [];
  if (column.pk) settings.push('pk');
  if (column.increment) settings.push('increment');
  if (column.notNull && !column.pk) settings.push('not null');
  if (column.nullable && !column.notNull && !column.pk) settings.push('null');
  if (column.unique && !column.pk) settings.push('unique');
  if (column.default) {
    const d = column.default;
    settings.push(`default: ${d.kind === 'number' || d.kind === 'word' ? d.value : d.kind === 'expr' ? `\`${d.value}\`` : quoteSettingString(d.value)}`);
  }
  if (column.note) settings.push(`note: ${quoteSettingString(column.note)}`);
  for (const ref of column.refs || []) {
    const target = `${ref.target.schema ? `${quoteName(ref.target.schema)}.` : ''}${quoteName(ref.target.table)}.${ref.target.columns.length === 1 ? quoteName(ref.target.columns[0]) : `(${ref.target.columns.map(quoteName).join(', ')})`}`;
    settings.push(`ref: ${ref.op} ${target}`);
  }
  return `${quoteName(column.name)} ${type}${settings.length ? ` [${settings.join(', ')}]` : ''}`;
}
