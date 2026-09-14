/**
 * Syntax colouring for the DBML editor: `[{ start, end, kind }]` covering the
 * interesting parts of the text (the rest is plain).
 *
 * A small scanner of its own rather than the parser's lexer, because colouring
 * needs what parsing throws away (comments) and must never fail on half-typed
 * text. It knows just enough context to tell a column's type from its name and
 * a setting's key from a value.
 *
 * Pure.
 */

const KEYWORDS = new Set(['project', 'table', 'enum', 'ref', 'tablegroup', 'note', 'indexes', 'as', 'tablepartial']);
const SETTINGS = new Set(['pk', 'primary', 'key', 'null', 'not', 'unique', 'increment', 'default', 'note', 'ref', 'delete', 'update', 'headercolor', 'name', 'type', 'color', 'cascade', 'restrict', 'set', 'no', 'action']);

export function highlightDbml(source) {
  const src = String(source ?? '');
  const out = [];
  const push = (start, end, kind) => end > start && out.push({ start, end, kind });
  let i = 0;
  let depth = 0; // { } nesting
  let inSettings = false;
  let lineWord = 0; // identifiers seen on the current line (column name, then type)
  let blockKind = null; // keyword of the block we are in at depth 1
  let pendingBlock = null;

  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') {
      lineWord = 0;
      i += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      push(i, stop, 'comment');
      i = stop;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      push(i, stop, 'comment');
      i = stop;
      continue;
    }
    if (src.startsWith("'''", i)) {
      const end = src.indexOf("'''", i + 3);
      const stop = end < 0 ? src.length : end + 3;
      push(i, stop, 'string');
      i = stop;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== ch && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      const stop = Math.min(src.length, j + 1);
      push(i, stop, ch === '"' ? (inSettings ? 'string' : lineWord === 1 && depth === 1 && blockKind === 'table' ? 'type' : 'name') : ch === '`' ? 'expr' : 'string');
      if (ch === '"' && !inSettings) lineWord += 1;
      i = stop;
      continue;
    }
    if (ch === '#' && /[0-9a-fA-F]/.test(src[i + 1] || '')) {
      let j = i + 1;
      while (j < src.length && /[0-9a-fA-F]/.test(src[j])) j += 1;
      push(i, j, 'color');
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch) && !/[\p{L}_]/u.test(src[i - 1] || '')) {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      if (!/[\p{L}_]/u.test(src[j] || '')) {
        push(i, j, 'number');
        i = j;
        continue;
      }
    }
    if (/[\p{L}_]/u.test(ch) || /[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[\p{L}\p{N}_$]/u.test(src[j])) j += 1;
      const word = src.slice(i, j);
      const lower = word.toLowerCase();
      let kind = null;
      if (inSettings) kind = SETTINGS.has(lower) ? 'setting' : null;
      else if (KEYWORDS.has(lower) && (depth === 0 || lower === 'indexes' || lower === 'note' || lower === 'as')) {
        kind = 'keyword';
        if (depth === 0 && lower !== 'as' && lower !== 'note') pendingBlock = lower;
      } else if (depth === 1 && blockKind === 'table' && lineWord === 1) kind = 'type';
      else if (depth === 0 && lineWord >= 1) kind = 'name';
      push(i, j, kind || 'ident');
      lineWord += 1;
      i = j;
      continue;
    }
    if (ch === '[') {
      inSettings = true;
      push(i, i + 1, 'punct');
    } else if (ch === ']') {
      inSettings = false;
      push(i, i + 1, 'punct');
    } else if (ch === '{') {
      depth += 1;
      if (depth === 1) blockKind = pendingBlock;
      pendingBlock = null;
      push(i, i + 1, 'punct');
    } else if (ch === '}') {
      depth = Math.max(0, depth - 1);
      if (depth === 0) blockKind = null;
      push(i, i + 1, 'punct');
    } else if (ch === '<' && src[i + 1] === '>') {
      push(i, i + 2, 'op');
      i += 2;
      continue;
    } else if (ch === '>' || ch === '<' || (ch === '-' && !/[0-9]/.test(src[i + 1] || ''))) {
      push(i, i + 1, 'op');
    } else if (ch === ':' || ch === ',' || ch === '.' || ch === '(' || ch === ')') {
      push(i, i + 1, 'punct');
    }
    i += 1;
  }
  return out.filter((t) => t.kind !== 'ident');
}
