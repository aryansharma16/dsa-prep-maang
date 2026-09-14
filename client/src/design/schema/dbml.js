/**
 * A DBML parser (the language of dbdiagram.io), hand-written.
 *
 * Recursive descent over a small lexer, with character spans on everything it
 * produces and panic-mode recovery: a mistake inside one table becomes a
 * diagnostic and the parser resynchronises at the next line or closing brace,
 * so one typo never blanks the whole diagram. Spans are what let the editor
 * underline errors, jump from a column in the diagram to its line, and apply
 * diagram edits as precise text edits that keep the author's formatting.
 *
 * Covers what dbdiagram accepts in practice: Project, Table (schema-qualified
 * names, `as` alias, header settings, notes), columns (types with arguments and
 * `[]`, settings pk / primary key / null / not null / unique / increment /
 * default / note / inline ref), indexes (single, composite, expression,
 * settings), Enum, Ref in short and long form (`>` `<` `-` `<>`, composite
 * endpoints, delete/update/color), TableGroup, standalone Note, `//` and
 * `/* *\/` comments, '…', '''…''', "…" and `…` strings. `TablePartial` and
 * `~partial` injections are recognised and skipped with a warning.
 *
 * Pure. Resolution (does this ref point at a real column?) is analyze.js.
 */

/* -------------------------------------------------------------------------- */
/* lexer                                                                       */
/* -------------------------------------------------------------------------- */

const PUNCT = new Set(['{', '}', '[', ']', '(', ')', ':', ',', '.', '>', '<', '-', '~']);

export function tokenize(source) {
  const tokens = [];
  const src = String(source ?? '');
  let i = 0;
  const push = (type, start, end, value) => tokens.push({ type, value, start, end });
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') {
      push('newline', i, i + 1, '\n');
      i += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      // Keep the line structure: a block comment spanning lines still ends those lines.
      for (let k = i; k < stop; k += 1) if (src[k] === '\n') push('newline', k, k + 1, '\n');
      if (end < 0) push('error', i, stop, 'Unclosed /* comment');
      i = stop;
      continue;
    }
    if (ch === "'" && src.startsWith("'''", i)) {
      const end = src.indexOf("'''", i + 3);
      const stop = end < 0 ? src.length : end + 3;
      push(end < 0 ? 'error' : 'string', i, stop, end < 0 ? "Unclosed ''' string" : dedent(src.slice(i + 3, end)));
      i = stop;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      let value = '';
      while (j < src.length && src[j] !== ch && src[j] !== '\n') {
        if (src[j] === '\\' && j + 1 < src.length) {
          value += src[j + 1];
          j += 2;
        } else {
          value += src[j];
          j += 1;
        }
      }
      if (src[j] !== ch) {
        push('error', i, j, `Unclosed ${ch} quote`);
        i = j;
        continue;
      }
      push(ch === "'" ? 'string' : ch === '"' ? 'qident' : 'expr', i, j + 1, value);
      i = j + 1;
      continue;
    }
    if (ch === '#' && /[0-9a-fA-F]/.test(src[i + 1] || '')) {
      let j = i + 1;
      while (j < src.length && /[0-9a-fA-F]/.test(src[j])) j += 1;
      push('color', i, j, src.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '<' && src[i + 1] === '>') {
      push('punct', i, i + 2, '<>');
      i += 2;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(src[i + 1] || '') && prevAllowsNumber(tokens))) {
      let j = i + 1;
      while (j < src.length && /[0-9._]/.test(src[j])) j += 1;
      // "1st_table" is an identifier, not a number.
      if (/[A-Za-z_]/.test(src[j] || '') && ch !== '-') {
        while (j < src.length && isIdent(src[j])) j += 1;
        push('ident', i, j, src.slice(i, j));
      } else {
        push('number', i, j, src.slice(i, j));
      }
      i = j;
      continue;
    }
    if (isIdent(ch)) {
      let j = i + 1;
      while (j < src.length && isIdent(src[j])) j += 1;
      push('ident', i, j, src.slice(i, j));
      i = j;
      continue;
    }
    if (PUNCT.has(ch)) {
      push('punct', i, i + 1, ch);
      i += 1;
      continue;
    }
    push('error', i, i + 1, `Unexpected character ${JSON.stringify(ch)}`);
    i += 1;
  }
  push('eof', src.length, src.length, '');
  return tokens;
}

const isIdent = (ch) => /[\p{L}\p{N}_$]/u.test(ch);
// A minus directly after ":" or "[" or "," starts a negative default, not a one-to-one ref.
const prevAllowsNumber = (tokens) => {
  const last = tokens.at(-1);
  return last && last.type === 'punct' && (last.value === ':' || last.value === ',' || last.value === '(');
};

function dedent(text) {
  const rows = text.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
  const indent = Math.min(...rows.filter((r) => r.trim()).map((r) => r.match(/^\s*/)[0].length));
  return rows.map((r) => r.slice(Number.isFinite(indent) ? indent : 0)).join('\n');
}

/* -------------------------------------------------------------------------- */
/* parser                                                                      */
/* -------------------------------------------------------------------------- */

const span = (start, end) => ({ start, end });

export function parseDbml(source) {
  const tokens = tokenize(source);
  let pos = 0;
  const out = { project: null, tables: [], enums: [], refs: [], groups: [], notes: [], diagnostics: [] };

  const peek = (offset = 0) => tokens[Math.min(pos + offset, tokens.length - 1)];
  const next = () => tokens[pos < tokens.length - 1 ? pos++ : pos];
  const at = (type, value) => {
    const t = peek();
    return t.type === type && (value === undefined || t.value === value);
  };
  const atKeyword = (word) => peek().type === 'ident' && peek().value.toLowerCase() === word;
  const skipNewlines = () => {
    while (at('newline')) next();
  };
  const error = (message, start, end, severity = 'error') => out.diagnostics.push({ severity, message, span: span(start, end ?? start + 1) });

  class ParseError extends Error {}
  const fail = (message, token = peek()) => {
    error(message, token.start, Math.max(token.end, token.start + 1));
    throw new ParseError(message);
  };
  const expect = (type, value, what) => {
    if (at(type, value)) return next();
    return fail(`Expected ${what || value || type}`);
  };

  /** Skips to the end of the current line (or a closing brace on it) — resynchronisation inside blocks. */
  const recoverLine = () => {
    while (!at('eof') && !at('newline') && !at('punct', '}')) next();
  };
  /** Skips to just after the block's closing brace, respecting nesting — resynchronisation at top level. */
  const recoverBlock = () => {
    let depth = 0;
    while (!at('eof')) {
      const t = next();
      if (t.type === 'punct' && t.value === '{') depth += 1;
      if (t.type === 'punct' && t.value === '}') {
        depth -= 1;
        if (depth <= 0) return;
      }
      if (depth === 0 && t.type === 'newline' && isTopKeyword(peek())) return;
    }
  };

  const isTopKeyword = (t) => t.type === 'ident' && ['project', 'table', 'enum', 'ref', 'tablegroup', 'note', 'tablepartial'].includes(t.value.toLowerCase());

  /** name | "name" */
  const name = (what = 'a name') => {
    if (at('ident') || at('qident')) {
      const t = next();
      return { value: t.value, span: span(t.start, t.end) };
    }
    return fail(`Expected ${what}`);
  };

  /** a.b.c → parts */
  const dotted = (what) => {
    const first = name(what);
    const parts = [first];
    while (at('punct', '.') && (peek(1).type === 'ident' || peek(1).type === 'qident')) {
      next();
      parts.push(name(what));
    }
    return parts;
  };

  /** Value after "key:" in settings or Project: string, number, expression, color, identifier words. */
  const settingValue = () => {
    const t = peek();
    if (t.type === 'string' || t.type === 'number' || t.type === 'expr' || t.type === 'color' || t.type === 'qident') {
      next();
      return { kind: t.type === 'qident' ? 'string' : t.type, value: t.value, span: span(t.start, t.end) };
    }
    if (t.type === 'ident') {
      const start = t.start;
      const words = [];
      let end = t.end;
      while (at('ident')) {
        const w = next();
        words.push(w.value);
        end = w.end;
      }
      return { kind: 'word', value: words.join(' '), span: span(start, end) };
    }
    return fail('Expected a value');
  };

  /** [a, b: c, ref: > t.c] → list of { key, value?, span } */
  const settings = () => {
    const open = expect('punct', '[');
    const list = [];
    while (!at('punct', ']')) {
      // Settings live on one line: an unclosed [ must not swallow the lines after it.
      if (at('eof') || at('newline')) fail('Unclosed [ settings');
      const start = peek().start;
      if (!at('ident') && !at('qident')) fail('Expected a setting');
      // Multi-word keys: "not null", "primary key", "no action".
      const words = [];
      let end = start;
      while (at('ident')) {
        const w = next();
        words.push(w.value.toLowerCase());
        end = w.end;
      }
      if (!words.length) {
        const w = next();
        words.push(w.value.toLowerCase());
        end = w.end;
      }
      const key = words.join(' ');
      if (at('punct', ':')) {
        next();
        if (key === 'ref') {
          const op = refOp();
          const target = endpoint();
          list.push({ key, ref: { op, target }, span: span(start, target.span.end) });
        } else {
          const value = settingValue();
          list.push({ key, value, span: span(start, value.span.end) });
        }
      } else {
        list.push({ key, span: span(start, end) });
      }
      if (at('punct', ',')) next();
      else if (!at('punct', ']')) fail('Expected , or ] in settings');
    }
    const close = next();
    return { list, span: span(open.start, close.end) };
  };

  const refOp = () => {
    const t = peek();
    if (t.type === 'punct' && ['>', '<', '-', '<>'].includes(t.value)) {
      next();
      return t.value;
    }
    return fail('Expected a relationship: >, <, - or <>');
  };

  /** schema.table.column | table.column | table.(a, b) */
  const endpoint = () => {
    const start = peek().start;
    const parts = [name('a table')];
    let columns = null;
    while (at('punct', '.')) {
      next();
      if (at('punct', '(')) {
        next();
        columns = [];
        while (!at('punct', ')')) {
          columns.push(name('a column'));
          if (at('punct', ',')) next();
          else if (!at('punct', ')')) fail('Expected , or ) in a composite reference');
        }
        next();
        break;
      }
      parts.push(name('a column'));
    }
    const end = tokens[pos - 1].end;
    if (!columns) {
      if (parts.length < 2) fail('A reference needs table.column');
      columns = [parts.pop()];
    }
    const table = parts.pop();
    const schema = parts.length ? parts.map((p) => p.value).join('.') : null;
    return { schema, table: table.value, tableSpan: table.span, columns: columns.map((c) => c.value), columnSpans: columns.map((c) => c.span), span: span(start, end) };
  };

  /** Note: 'x'  |  Note { 'x' } — the keyword has been consumed; returns { text, span }. */
  const noteBody = (start) => {
    if (at('punct', ':')) {
      next();
      const value = expect('string', undefined, 'a quoted note');
      return { text: value.value, span: span(start, value.end) };
    }
    if (at('punct', '{')) {
      next();
      skipNewlines();
      const value = expect('string', undefined, 'a quoted note');
      skipNewlines();
      const close = expect('punct', '}');
      return { text: value.value, span: span(start, close.end) };
    }
    return fail('Expected : or { after Note');
  };

  /* ---- blocks ---- */

  function project(keyword) {
    const result = { name: null, databaseType: null, note: null, settings: {}, span: null };
    if (at('ident') || at('qident')) result.name = name().value;
    expect('punct', '{');
    while (true) {
      skipNewlines();
      if (at('punct', '}') || at('eof')) break;
      try {
        const key = name('a project setting');
        if (key.value.toLowerCase() === 'note') {
          result.note = noteBody(key.span.start).text;
        } else {
          expect('punct', ':');
          const value = settingValue();
          result.settings[key.value] = value.value;
          if (key.value.toLowerCase() === 'database_type') result.databaseType = value.value;
        }
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        recoverLine();
      }
    }
    const close = expect('punct', '}');
    result.span = span(keyword.start, close.end);
    return result;
  }

  function column() {
    const colName = name('a column name');
    const start = colName.span.start;
    if (!at('ident') && !at('qident')) fail(`Column "${colName.value}" needs a type`);
    const typeParts = dotted('a type');
    const typeStart = typeParts[0].span.start;
    let typeName = typeParts.map((p) => p.value).join('.');
    let args = null;
    if (at('punct', '(')) {
      next();
      args = [];
      while (!at('punct', ')')) {
        const t = next();
        if (t.type === 'eof' || t.type === 'newline') fail('Unclosed ( in a type');
        if (!(t.type === 'punct' && t.value === ',')) args.push(t.value);
      }
      next();
    }
    let array = false;
    while (at('punct', '[') && peek(1).type === 'punct' && peek(1).value === ']') {
      next();
      next();
      array = true;
    }
    const typeEnd = tokens[pos - 1].end;
    const result = {
      name: colName.value,
      nameSpan: colName.span,
      type: { name: typeName, args, array, span: span(typeStart, typeEnd) },
      pk: false,
      notNull: false,
      nullable: null,
      unique: false,
      increment: false,
      default: null,
      note: null,
      refs: [],
      settingsSpan: null,
      span: null,
    };
    if (at('punct', '[')) {
      const s = settings();
      result.settingsSpan = s.span;
      for (const entry of s.list) {
        switch (entry.key) {
          case 'pk':
          case 'primary key':
            result.pk = true;
            break;
          case 'not null':
            result.notNull = true;
            result.nullable = false;
            break;
          case 'null':
            result.nullable = true;
            break;
          case 'unique':
            result.unique = true;
            break;
          case 'increment':
            result.increment = true;
            break;
          case 'default':
            result.default = entry.value ? { kind: entry.value.kind, value: entry.value.value } : null;
            break;
          case 'note':
            result.note = entry.value?.value ?? null;
            break;
          case 'ref':
            result.refs.push({ ...entry.ref, span: entry.span });
            break;
          default:
            error(`Unknown column setting "${entry.key}"`, entry.span.start, entry.span.end, 'warning');
        }
      }
    }
    result.span = span(start, tokens[pos - 1].end);
    return result;
  }

  function indexes() {
    expect('punct', '{');
    const list = [];
    while (true) {
      skipNewlines();
      if (at('punct', '}') || at('eof')) break;
      try {
        const start = peek().start;
        const columns = [];
        if (at('punct', '(')) {
          next();
          while (!at('punct', ')')) {
            if (at('expr')) {
              const t = next();
              columns.push({ expr: t.value });
            } else columns.push({ name: name('a column').value });
            if (at('punct', ',')) next();
            else if (!at('punct', ')')) fail('Expected , or ) in an index');
          }
          next();
        } else if (at('expr')) {
          columns.push({ expr: next().value });
        } else {
          columns.push({ name: name('an indexed column').value });
        }
        const index = { columns, pk: false, unique: false, name: null, type: null, note: null, span: null };
        if (at('punct', '[')) {
          for (const entry of settings().list) {
            if (entry.key === 'pk') index.pk = true;
            else if (entry.key === 'unique') index.unique = true;
            else if (entry.key === 'name') index.name = entry.value?.value ?? null;
            else if (entry.key === 'type') index.type = entry.value?.value ?? null;
            else if (entry.key === 'note') index.note = entry.value?.value ?? null;
            else error(`Unknown index setting "${entry.key}"`, entry.span.start, entry.span.end, 'warning');
          }
        }
        index.span = span(start, tokens[pos - 1].end);
        list.push(index);
        if (!at('newline') && !at('punct', '}')) fail('Expected the end of the line');
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        recoverLine();
      }
    }
    expect('punct', '}');
    return list;
  }

  function table(keyword) {
    const parts = dotted('a table name');
    const tableName = parts.at(-1);
    const result = {
      name: tableName.value,
      schema: parts.length > 1 ? parts.slice(0, -1).map((p) => p.value).join('.') : null,
      nameSpan: span(parts[0].span.start, tableName.span.end),
      alias: null,
      headerColor: null,
      note: null,
      settingsSpan: null, // the [ … ] after the name, and each setting in it — for editing one without retyping the rest
      settings: [],
      columns: [],
      indexes: [],
      span: null,
      bodySpan: null,
    };
    if (atKeyword('as')) {
      next();
      result.alias = name('an alias').value;
    }
    if (at('punct', '[')) {
      const s = settings();
      result.settingsSpan = s.span;
      result.settings = s.list.map((entry) => ({ key: entry.key, span: entry.span }));
      for (const entry of s.list) {
        if (entry.key === 'headercolor') result.headerColor = entry.value?.value ?? null;
        else if (entry.key === 'note') result.note = entry.value?.value ?? null;
        else error(`Unknown table setting "${entry.key}"`, entry.span.start, entry.span.end, 'warning');
      }
    }
    skipNewlines();
    const open = expect('punct', '{');
    while (true) {
      skipNewlines();
      if (at('punct', '}') || at('eof')) break;
      try {
        if (atKeyword('indexes') && peek(1).type === 'punct' && peek(1).value === '{') {
          next();
          result.indexes.push(...indexes());
        } else if (atKeyword('note') && peek(1).type === 'punct' && (peek(1).value === ':' || peek(1).value === '{')) {
          const kw = next();
          result.note = noteBody(kw.start).text;
        } else if (at('punct', '~')) {
          const t = next();
          name('a partial name');
          error('Table partials are not supported yet; this injection is ignored', t.start, tokens[pos - 1].end, 'warning');
        } else {
          result.columns.push(column());
          if (!at('newline') && !at('punct', '}')) fail('Expected the end of the column line');
        }
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        recoverLine();
      }
    }
    if (at('eof')) {
      error(`Table "${result.name}" is missing its closing }`, keyword.start, open.end);
      result.span = span(keyword.start, tokens[pos].start);
      result.bodySpan = span(open.start, tokens[pos].start);
      return result;
    }
    const close = next();
    result.span = span(keyword.start, close.end);
    result.bodySpan = span(open.start, close.end);
    return result;
  }

  function enumBlock(keyword) {
    const parts = dotted('an enum name');
    const result = { name: parts.at(-1).value, schema: parts.length > 1 ? parts.slice(0, -1).map((p) => p.value).join('.') : null, values: [], span: null };
    skipNewlines();
    expect('punct', '{');
    while (true) {
      skipNewlines();
      if (at('punct', '}') || at('eof')) break;
      try {
        const value = name('an enum value');
        const entry = { name: value.value, note: null, span: value.span };
        if (at('punct', '[')) {
          for (const s of settings().list) {
            if (s.key === 'note') entry.note = s.value?.value ?? null;
            else error(`Unknown enum setting "${s.key}"`, s.span.start, s.span.end, 'warning');
          }
          entry.span = span(value.span.start, tokens[pos - 1].end);
        }
        result.values.push(entry);
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        recoverLine();
      }
    }
    const close = expect('punct', '}');
    result.span = span(keyword.start, close.end);
    return result;
  }

  function refLine(refName, start) {
    const from = endpoint();
    const op = refOp();
    const to = endpoint();
    const ref = { name: refName, from, to, op, delete: null, update: null, color: null, inline: false, span: null };
    if (at('punct', '[')) {
      for (const entry of settings().list) {
        if (entry.key === 'delete') ref.delete = entry.value?.value ?? null;
        else if (entry.key === 'update') ref.update = entry.value?.value ?? null;
        else if (entry.key === 'color') ref.color = entry.value?.value ?? null;
        else error(`Unknown ref setting "${entry.key}"`, entry.span.start, entry.span.end, 'warning');
      }
    }
    ref.span = span(start, tokens[pos - 1].end);
    return ref;
  }

  function refBlock(keyword) {
    let refName = null;
    if ((at('ident') || at('qident')) && !(peek(1).type === 'punct' && peek(1).value === '.')) refName = name().value;
    if (at('punct', ':')) {
      next();
      out.refs.push(refLine(refName, keyword.start));
      return;
    }
    skipNewlines();
    expect('punct', '{', ': or {');
    while (true) {
      skipNewlines();
      if (at('punct', '}') || at('eof')) break;
      try {
        out.refs.push(refLine(refName, peek().start));
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        recoverLine();
      }
    }
    expect('punct', '}');
  }

  function group(keyword) {
    const result = { name: name('a group name').value, color: null, note: null, tables: [], span: null };
    if (at('punct', '[')) {
      for (const entry of settings().list) {
        if (entry.key === 'color') result.color = entry.value?.value ?? null;
        else if (entry.key === 'note') result.note = entry.value?.value ?? null;
      }
    }
    skipNewlines();
    expect('punct', '{');
    while (true) {
      skipNewlines();
      if (at('punct', '}') || at('eof')) break;
      try {
        if (atKeyword('note') && peek(1).type === 'punct' && (peek(1).value === ':' || peek(1).value === '{')) {
          const kw = next();
          result.note = noteBody(kw.start).text;
          continue;
        }
        const parts = dotted('a table name');
        result.tables.push({ name: parts.at(-1).value, schema: parts.length > 1 ? parts.slice(0, -1).map((p) => p.value).join('.') : null, span: span(parts[0].span.start, parts.at(-1).span.end) });
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        recoverLine();
      }
    }
    const close = expect('punct', '}');
    result.span = span(keyword.start, close.end);
    return result;
  }

  /* ---- top level ---- */

  while (true) {
    skipNewlines();
    if (at('eof')) break;
    const t = peek();
    if (t.type === 'error') {
      error(t.value, t.start, t.end);
      next();
      continue;
    }
    const word = t.type === 'ident' ? t.value.toLowerCase() : '';
    try {
      if (word === 'project') {
        next();
        if (out.project) error('Only one Project is allowed', t.start, t.end);
        out.project = project(t);
      } else if (word === 'table') {
        next();
        out.tables.push(table(t));
      } else if (word === 'enum') {
        next();
        out.enums.push(enumBlock(t));
      } else if (word === 'ref') {
        next();
        refBlock(t);
      } else if (word === 'tablegroup') {
        next();
        out.groups.push(group(t));
      } else if (word === 'note') {
        next();
        const noteName = at('ident') || at('qident') ? name().value : null;
        const body = noteBody(t.start);
        out.notes.push({ name: noteName, text: body.text, span: body.span });
      } else if (word === 'tablepartial') {
        next();
        error('TablePartial is not supported yet; this block is ignored', t.start, t.end, 'warning');
        recoverBlock();
      } else {
        fail(`Expected Table, Ref, Enum, TableGroup, Note or Project — found ${JSON.stringify(t.value)}`, t);
      }
    } catch (err) {
      if (!(err instanceof ParseError)) throw err;
      recoverBlock();
    }
  }

  // Error tokens met inside blocks were consumed as "unexpected"; surface any the parser skipped past.
  for (const token of tokens) {
    if (token.type === 'error' && !out.diagnostics.some((d) => d.span.start === token.start)) error(token.value, token.start, token.end);
  }
  out.diagnostics.sort((a, b) => a.span.start - b.span.start);
  return out;
}
