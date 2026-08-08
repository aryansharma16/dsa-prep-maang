/**
 * A small syntax highlighter for the Java and C++ snippets in the pattern
 * guides.
 *
 * Hand-rolled rather than pulled from a library: the app has four runtime
 * dependencies and Prism or highlight.js would be the largest of them by a wide
 * margin, for two languages whose snippets we write ourselves. This is a single
 * regex scan producing spans — no parsing, no worker, no stylesheet to import.
 *
 * It is a lexer, not a parser, so it can be fooled. A `<` used as a
 * less-than sits next to a `<` opening a generic and both come out as
 * punctuation, which is fine — nothing here changes what the code means.
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

// Order matters — comments and strings must win before anything inside them
// gets a chance to look like code.
const TOKEN_RE = new RegExp(
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

// VS Code's bracket-pair palette, cycled by nesting depth.
const BRACKET_CLASSES = ['tok-br1', 'tok-br2', 'tok-br3'];

function classify(word, source, endIndex) {
  if (KEYWORDS.has(word)) return 'tok-kw';
  if (TYPES.has(word)) return 'tok-typ';
  // An identifier immediately followed by "(" is being called.
  if (/^\s*\(/.test(source.slice(endIndex, endIndex + 8))) return 'tok-fn';
  if (/^[A-Z]/.test(word)) return 'tok-typ';
  return '';
}

function tokenize(source) {
  const tokens = [];
  let last = 0;
  let depth = 0;
  let match;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(source)) !== null) {
    if (match.index > last) {
      tokens.push({ t: source.slice(last, match.index), c: '' });
    }

    const [text, lineComment, blockComment, str, chr, num, word, bracket] = match;

    if (lineComment || blockComment) tokens.push({ t: text, c: 'tok-cm' });
    else if (str || chr) tokens.push({ t: text, c: 'tok-str' });
    else if (num) tokens.push({ t: text, c: 'tok-num' });
    else if (word) tokens.push({ t: text, c: classify(word, source, TOKEN_RE.lastIndex) });
    else if (bracket) {
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

    last = TOKEN_RE.lastIndex;
  }

  if (last < source.length) tokens.push({ t: source.slice(last), c: '' });
  return tokens;
}

/**
 * Tokenises and splits into lines, so the renderer can put each on its own
 * element and hang a line number off it.
 */
export function highlight(source) {
  const lines = [[]];

  for (const token of tokenize(source)) {
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
