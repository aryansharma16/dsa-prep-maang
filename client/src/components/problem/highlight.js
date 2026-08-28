/**
 * A small syntax highlighter for the code in the pattern guides and the Learn
 * track — Java and C++ for the algorithm snippets, JavaScript and JSX for the
 * React reference, SQL for the DBMS one.
 *
 * Hand-rolled rather than pulled from a library: the app has four runtime
 * dependencies and Prism or highlight.js would be the largest of them by a wide
 * margin, for a handful of languages whose snippets we write ourselves. This is
 * a single regex scan producing spans — no parsing, no worker, no stylesheet to
 * import.
 *
 * It is a lexer, not a parser, so it can be fooled. A `<` used as a less-than
 * sits next to a `<` opening a generic and both come out as punctuation; JSX
 * text between tags is scanned for identifiers like any other code. Neither
 * matters — nothing here changes what the code means.
 */

const JAVA_KEYWORDS = [
  'abstract', 'assert', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'default', 'do', 'else', 'enum', 'extends', 'final', 'finally', 'for', 'if',
  'implements', 'import', 'instanceof', 'interface', 'native', 'new', 'package',
  'private', 'protected', 'public', 'return', 'static', 'super', 'switch',
  'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'volatile',
  'while', 'true', 'false', 'null', 'var', 'record', 'yield',
];

const CPP_KEYWORDS = [
  'auto', 'break', 'case', 'catch', 'class', 'const', 'constexpr', 'continue',
  'default', 'delete', 'do', 'else', 'enum', 'explicit', 'extern', 'false',
  'for', 'friend', 'goto', 'if', 'inline', 'mutable', 'namespace', 'new',
  'nullptr', 'operator', 'private', 'protected', 'public', 'return', 'sizeof',
  'static', 'struct', 'switch', 'template', 'this', 'throw', 'true', 'try',
  'typedef', 'typename', 'union', 'using', 'virtual', 'while',
];

const KEYWORDS = new Set([...JAVA_KEYWORDS, ...CPP_KEYWORDS]);

// Lowercase names that are types rather than variables. Uppercase identifiers
// are treated as types by convention, which covers Java almost entirely.
const TYPES = new Set([
  'int', 'long', 'short', 'byte', 'char', 'float', 'double', 'boolean', 'bool',
  'void', 'string', 'vector', 'unordered_map', 'unordered_set', 'map', 'set',
  'pair', 'deque', 'stack', 'queue', 'priority_queue', 'array', 'size_t',
  'unsigned', 'signed', 'istringstream', 'bitset',
]);

const JS_KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const',
  'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export',
  'extends', 'finally', 'for', 'from', 'function', 'get', 'if', 'import', 'in',
  'instanceof', 'let', 'new', 'of', 'return', 'set', 'static', 'super',
  'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with',
  'yield', 'true', 'false', 'null', 'undefined',
  // TypeScript, so a `ts` variant does not read as plain text.
  'declare', 'enum', 'implements', 'interface', 'keyof', 'namespace',
  'readonly', 'satisfies', 'type',
]);

/**
 * Lowercase names that are a type or a well-known global rather than something
 * the snippet declared. Uppercase already reads as a type, which covers React,
 * every component, `Promise`, `Map` and the rest.
 */
const JS_TYPES = new Set([
  'string', 'number', 'boolean', 'symbol', 'bigint', 'object', 'any',
  'unknown', 'never', 'console', 'window', 'document', 'globalThis',
  // Node globals, so a server snippet reads the same way a browser one does.
  // None of these appear in React or pattern-guide code, so nothing else moves.
  'process', 'global', 'require', 'module', 'exports', '__dirname', '__filename',
]);

/*
  SQL, for the DBMS track and the Lab.

  It needs its own scan rather than a third entry in the C-family sets, and the
  reason is the one rule the other two scans lean on hardest: there, an
  identifier starting with a capital is a type. In SQL the convention is the
  opposite way round — keywords are the things people uppercase, and half of
  them (`SELECT`, `ORDER`, `KEY`) are also perfectly ordinary column names in
  lowercase. So the lists below are matched case-insensitively and capitalisation
  decides nothing at all.
*/
const SQL_KEYWORDS = new Set([
  // Querying
  'select', 'distinct', 'all', 'from', 'where', 'group', 'by', 'having',
  'order', 'asc', 'desc', 'limit', 'offset', 'fetch', 'first', 'next', 'only',
  'top', 'as', 'into',
  // Joins and set operations
  'join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'natural', 'on',
  'using', 'union', 'intersect', 'except', 'minus',
  // Predicates
  'and', 'or', 'not', 'in', 'between', 'like', 'ilike', 'rlike', 'regexp',
  'is', 'null', 'exists', 'any', 'some', 'case', 'when', 'then', 'else', 'end',
  'true', 'false', 'unknown', 'escape',
  // CTEs and window frames
  'with', 'recursive', 'over', 'partition', 'window', 'range', 'groups',
  'rows', 'row', 'unbounded', 'preceding', 'following', 'current', 'ties',
  'nulls', 'last', 'filter', 'within',
  // Changing data
  'insert', 'values', 'update', 'set', 'delete', 'truncate', 'merge',
  'matched', 'duplicate', 'replace', 'ignore', 'returning',
  // Defining it
  'create', 'alter', 'drop', 'rename', 'add', 'modify', 'change', 'table',
  'temporary', 'view', 'materialized', 'index', 'sequence', 'database',
  'schema', 'column', 'constraint', 'primary', 'foreign', 'unique', 'key',
  'references', 'check', 'default', 'cascade', 'restrict', 'no', 'action',
  'auto_increment', 'identity', 'generated', 'always', 'collate', 'if',
  'engine', 'charset', 'character', 'comment',
  // Transactions and locking
  'begin', 'start', 'transaction', 'commit', 'rollback', 'savepoint', 'work',
  'isolation', 'level', 'read', 'write', 'uncommitted', 'committed',
  'repeatable', 'serializable', 'lock', 'unlock', 'tables', 'share',
  'nowait', 'skip', 'locked', 'for', 'of',
  // Programmability and admin
  'procedure', 'function', 'trigger', 'before', 'after', 'each', 'statement',
  'returns', 'return', 'declare', 'while', 'loop', 'do', 'call',
  'grant', 'revoke', 'to', 'privileges', 'public', 'user', 'role',
  'explain', 'analyze', 'analyse', 'describe', 'show', 'use', 'vacuum',
]);

/**
 * Names that are a built-in function rather than something the schema declared.
 *
 * Consulted after the keyword set, so `IF` and `TRUNCATE` — which are in both —
 * read as keywords. Both are still coloured, just not as calls.
 */
const SQL_FUNCS = new Set([
  // Aggregates
  'count', 'sum', 'avg', 'min', 'max', 'group_concat', 'string_agg',
  'array_agg', 'listagg', 'stddev', 'variance',
  // Window
  'row_number', 'rank', 'dense_rank', 'percent_rank', 'cume_dist', 'ntile',
  'lag', 'lead', 'first_value', 'last_value', 'nth_value',
  // Null and branching
  'coalesce', 'ifnull', 'nullif', 'nvl', 'isnull', 'iif', 'greatest', 'least',
  // Strings
  'concat', 'concat_ws', 'substring', 'substr', 'mid', 'trim', 'ltrim',
  'rtrim', 'upper', 'lower', 'ucase', 'lcase', 'length', 'char_length',
  'character_length', 'reverse', 'locate', 'instr', 'position', 'lpad', 'rpad',
  'format', 'split_part', 'regexp_replace', 'regexp_like', 'md5',
  // Numbers
  'round', 'floor', 'ceil', 'ceiling', 'abs', 'mod', 'power', 'pow', 'sqrt',
  'exp', 'ln', 'log', 'sign', 'rand', 'random',
  // Dates
  'now', 'curdate', 'curtime', 'current_date', 'current_time',
  'current_timestamp', 'date', 'time', 'datediff', 'timestampdiff',
  'date_add', 'date_sub', 'adddate', 'subdate', 'date_format', 'to_char',
  'to_date', 'extract', 'year', 'month', 'day', 'hour', 'minute', 'second',
  'dayofweek', 'dayofmonth', 'dayname', 'monthname', 'weekday', 'week',
  'quarter', 'age', 'date_trunc', 'generate_series', 'unix_timestamp',
  // Conversion and JSON
  'cast', 'convert', 'json_extract', 'json_object', 'json_agg', 'uuid',
]);

/** Column types, so a `CREATE TABLE` reads as a shape rather than a word list. */
const SQL_TYPES = new Set([
  'int', 'integer', 'bigint', 'smallint', 'tinyint', 'mediumint', 'decimal',
  'dec', 'numeric', 'float', 'double', 'real', 'char', 'varchar', 'nchar',
  'nvarchar', 'text', 'tinytext', 'mediumtext', 'longtext', 'blob', 'binary',
  'varbinary', 'datetime', 'timestamp', 'timestamptz', 'year', 'boolean',
  'bool', 'bit', 'enum', 'json', 'jsonb', 'uuid', 'serial', 'bigserial',
  'money', 'interval', 'array', 'inet', 'xml',
]);

// Order matters — comments and strings must win before anything inside them
// gets a chance to look like code.
const C_TOKEN_RE = new RegExp(
  [
    '(\\/\\/[^\\n]*)', // 1 line comment
    '(\\/\\*[\\s\\S]*?\\*\\/)', // 2 block comment
    '("(?:\\\\.|[^"\\\\])*")', // 3 string
    "('(?:\\\\.|[^'\\\\])*')", // 4 char literal
    '(\\b\\d[\\w.]*)', // 5 number
    '([A-Za-z_$][\\w$]*)', // 6 identifier
    '([(){}\\[\\]])', // 7 bracket
  ].join('|'),
  'g',
);

/*
  The same shape with one addition: a template literal, which has to be its own
  alternative because a backtick string can run over several lines and contain
  quotes. `${...}` inside one is swallowed with the rest of the string rather
  than highlighted as code — a nested scan would double the size of this file to
  colour the inside of `` `${count} items` ``.
*/
const JS_TOKEN_RE = new RegExp(
  [
    '(\\/\\/[^\\n]*)', // 1 line comment
    '(\\/\\*[\\s\\S]*?\\*\\/)', // 2 block comment
    '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)', // 3 string
    '(\\b\\d[\\w.]*)', // 4 number
    '([A-Za-z_$][\\w$]*)', // 5 identifier
    '([(){}\\[\\]])', // 6 bracket
  ].join('|'),
  'g',
);

/*
  The C-family shape with three substitutions, and each of them is a place where
  SQL would otherwise be scanned as something it is not.

  `--` and `#` open a line comment, not `//`. A string is single-quoted, with
  `''` as the escape rather than a backslash. And a *quoted identifier* —
  MySQL's backticks, everyone else's double quotes — gets its own alternative
  instead of falling in with the strings, because `` `order` `` is a column
  name that happened to collide with a keyword, and colouring it as a literal
  would say the opposite.
*/
const SQL_TOKEN_RE = new RegExp(
  [
    '(--[^\\n]*|#[^\\n]*)', // 1 line comment
    '(\\/\\*[\\s\\S]*?\\*\\/)', // 2 block comment
    "('(?:''|[^'])*')", // 3 string
    '(`[^`]*`|"[^"]*")', // 4 quoted identifier
    '(\\b\\d[\\w.]*)', // 5 number
    '([A-Za-z_][\\w$]*)', // 6 identifier
    '([(){}\\[\\]])', // 7 bracket
  ].join('|'),
  'g',
);

// VS Code's bracket-pair palette, cycled by nesting depth.
const BRACKET_CLASSES = ['tok-br1', 'tok-br2', 'tok-br3'];

const JS_LANGS = new Set(['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript']);

function classify(word, source, endIndex) {
  if (KEYWORDS.has(word)) return 'tok-kw';
  if (TYPES.has(word)) return 'tok-typ';
  // An identifier immediately followed by "(" is being called.
  if (/^\s*\(/.test(source.slice(endIndex, endIndex + 8))) return 'tok-fn';
  if (/^[A-Z]/.test(word)) return 'tok-typ';
  return '';
}

/**
 * `inTag` is what makes JSX read as markup rather than as a run of bare
 * identifiers: while the scan is between `<div` and the `>` that closes it,
 * every plain identifier is an attribute name.
 */
function classifyJs(word, source, startIndex, endIndex, inTag) {
  // A tag name — `<div`, `</section>`, `<Suspense`. Checked before the keyword
  // set so a component named `Set` or `Map` still reads as a tag.
  if (/<\/?\s*$/.test(source.slice(Math.max(0, startIndex - 3), startIndex))) return 'tok-typ';
  if (JS_KEYWORDS.has(word)) return 'tok-kw';
  if (inTag) return 'tok-fn';
  if (JS_TYPES.has(word)) return 'tok-typ';
  if (/^\s*\(/.test(source.slice(endIndex, endIndex + 8))) return 'tok-fn';
  if (/^[A-Z]/.test(word)) return 'tok-typ';
  return '';
}

/**
 * Case-insensitive throughout, and with no capital-letter rule — see the note on
 * `SQL_KEYWORDS`. What is left after the three lists is a table or a column,
 * which is exactly the thing the reader is looking for, so it stays plain.
 */
function classifySql(word, source, endIndex) {
  const lower = word.toLowerCase();
  if (SQL_KEYWORDS.has(lower)) return 'tok-kw';
  if (SQL_TYPES.has(lower)) return 'tok-typ';
  if (SQL_FUNCS.has(lower)) return 'tok-fn';
  // Anything else called like a function is one the schema defined.
  if (/^\s*\(/.test(source.slice(endIndex, endIndex + 8))) return 'tok-fn';
  return '';
}

function tokenize(source, mode) {
  const tokens = [];
  const isJs = mode === 'js';
  const isSql = mode === 'sql';
  const re = isJs ? JS_TOKEN_RE : isSql ? SQL_TOKEN_RE : C_TOKEN_RE;
  let last = 0;
  let depth = 0;
  let match;

  /*
    JSX state, and only meaningful when `isJs`. `inTag` is true from a tag name
    until the `>` that ends the opening tag; `braceDepth` counts the `{}` of an
    expression attribute, because a `>` inside `onClick={() => go()}` is an
    arrow, not the end of the tag.
  */
  let inTag = false;
  let braceDepth = 0;

  re.lastIndex = 0;
  while ((match = re.exec(source)) !== null) {
    if (match.index > last) {
      const gap = source.slice(last, match.index);
      tokens.push({ t: gap, c: '' });
      if (inTag && braceDepth === 0 && gap.includes('>')) inTag = false;
    }

    // The three scans carry a different number of groups — the JS one folds the
    // C family's char literal into its string alternative, and the SQL one
    // spends that slot on a quoted identifier instead — so the match is
    // normalised here rather than destructured positionally.
    const text = match[0];
    const comment = match[1] || match[2];
    const str = isJs || isSql ? match[3] : match[3] || match[4];
    const quoted = isSql ? match[4] : '';
    const num = isJs ? match[4] : match[5];
    const word = isJs ? match[5] : match[6];
    const bracket = isJs ? match[6] : match[7];

    if (comment) tokens.push({ t: text, c: 'tok-cm' });
    else if (str) tokens.push({ t: text, c: 'tok-str' });
    // A backticked or double-quoted name — an identifier wearing armour, not a
    // literal, so it takes the identifier colour rather than the string one.
    else if (quoted) tokens.push({ t: text, c: 'tok-typ' });
    else if (num) tokens.push({ t: text, c: 'tok-num' });
    else if (word) {
      if (isSql) {
        tokens.push({ t: text, c: classifySql(word, source, re.lastIndex) });
      } else if (isJs) {
        const cls = classifyJs(word, source, match.index, re.lastIndex, inTag && braceDepth === 0);
        // A tag name opens a tag; a closing `</div>` does not, since its `>`
        // arrives before any attribute could.
        if (cls === 'tok-typ' && /<\s*$/.test(source.slice(Math.max(0, match.index - 2), match.index))) {
          inTag = true;
          braceDepth = 0;
        }
        tokens.push({ t: text, c: cls });
      } else {
        tokens.push({ t: text, c: classify(word, source, re.lastIndex) });
      }
    } else if (bracket) {
      if (inTag) {
        if (text === '{') braceDepth += 1;
        else if (text === '}') braceDepth = Math.max(0, braceDepth - 1);
      }
      // Openers take the current depth and push; closers pop first so a pair
      // ends up the same colour.
      if (text === '(' || text === '[' || text === '{') {
        tokens.push({ t: text, c: BRACKET_CLASSES[depth % BRACKET_CLASSES.length] });
        depth += 1;
      } else {
        depth = Math.max(0, depth - 1);
        tokens.push({ t: text, c: BRACKET_CLASSES[depth % BRACKET_CLASSES.length] });
      }
    }

    last = re.lastIndex;
  }

  if (last < source.length) tokens.push({ t: source.slice(last), c: '' });
  return tokens;
}

/**
 * Tokenises and splits into lines, so the renderer can put each on its own
 * element and hang a line number off it.
 *
 * `lang` picks the keyword set. It defaults to the C-family scan, so the guide
 * call sites that predate the Learn track need no change.
 */
export function highlight(source, lang) {
  const lines = [[]];
  const name = String(lang || '').toLowerCase();
  const mode = JS_LANGS.has(name) ? 'js' : name === 'sql' ? 'sql' : 'c';

  for (const token of tokenize(source, mode)) {
    const parts = token.t.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ t: part, c: token.c });
    });
  }

  // A trailing newline leaves an empty last line that renders as a stray gutter
  // number.
  if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}
