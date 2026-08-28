import { cheat, code, h, js, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'JSX is a syntax extension to JavaScript that lets you write markup inside a JavaScript file. It is not HTML and it is not part of React — it is a syntax that compiles to plain function calls, and React is one of several libraries that can consume the result.',
    ),
    p(
      'Every rule that seems arbitrary makes sense once you see the output. JSX is an expression. Wherever a JavaScript expression is legal, JSX is legal; wherever a statement is required, JSX will not do.',
    ),

    h('What it compiles to'),
    p(
      'Older toolchains compiled JSX to `React.createElement`, which is why you used to have to import React in every file. Since the automatic runtime, the compiler imports a `jsx` helper for you.',
    ),
    code(
      jsx(`
// What you write
const el = <Row count={3}>Save</Row>;

// The classic runtime — needs React in scope
const el = React.createElement(Row, { count: 3 }, 'Save');

// The automatic runtime (default since React 17) — no React import needed
import { jsx as _jsx } from 'react/jsx-runtime';
const el = _jsx(Row, { count: 3, children: 'Save' });
`),
    ),
    note(
      'Vite handles this for you. It is worth knowing anyway, because it explains why a lowercase `<row>` and an uppercase `<Row>` mean different things — see below.',
    ),

    h('The rules, and where they come from'),
    table(
      ['Rule', 'Why'],
      [
        [
          'One root element per return',
          'A function returns one value. Two siblings would be two values — wrap them, or use a `<>...</>` fragment.',
        ],
        [
          'Every tag closes',
          '`<img>` must be `<img />`. The compiler is parsing an expression tree, not forgiving HTML.',
        ],
        [
          'Attributes are camelCase',
          'They become object keys. `class` and `for` are reserved words in JavaScript, hence `className` and `htmlFor`.',
        ],
        [
          'Uppercase means component, lowercase means DOM tag',
          '`<Row />` compiles to a reference to the variable `Row`; `<row />` compiles to the string `"row"`. This is purely a casing convention the compiler enforces.',
        ],
        [
          'Braces hold an expression',
          '`{}` is an escape hatch back into JavaScript. An expression, not a statement — no `if`, no `for`, no `let`.',
        ],
      ],
    ),

    h('Curly braces'),
    code(
      jsx(`
function Card({ user, size }) {
  return (
    <div
      className="card"
      // An expression — the value is a JS string
      title={\`\${user.name} joined \${user.year}\`}
      // A double brace is not special syntax: it is an object literal
      // inside an expression slot
      style={{ width: size, opacity: user.active ? 1 : 0.5 }}
    >
      {user.name}
      {user.tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}
`),
    ),
    p(
      'Braces are also how you render nothing. `null`, `undefined`, `true` and `false` all render as nothing at all, which is what makes `{isOpen && <Panel />}` work — and also what makes `{count && <Panel />}` print a stray `0`. See conditional rendering.',
    ),

    h('Fragments'),
    p(
      'A fragment groups children without adding a DOM node. `<>...</>` is the short form; the long form exists because the short one cannot take a key, which you need when the fragment is the thing being repeated.',
    ),
    code(
      jsx(`
import { Fragment } from 'react';

// Short form — no key possible
<>
  <dt>{term}</dt>
  <dd>{definition}</dd>
</>

// Long form — required when the fragment itself is in a list
{items.map((item) => (
  <Fragment key={item.id}>
    <dt>{item.term}</dt>
    <dd>{item.definition}</dd>
  </Fragment>
))}
`),
    ),

    h('Loops and conditions'),
    p(
      'There is no loop syntax in JSX because there is no loop expression in JavaScript. You produce an array instead, which is why `.map()` is everywhere in React code — it is an expression that returns a list of elements, and React renders arrays by rendering each item.',
    ),
    code(
      jsx(`
// Not possible — for is a statement
{for (const item of items) <Row item={item} />}

// The expression version
{items.map((item) => <Row key={item.id} item={item} />)}

// Anything more complicated than a ternary: compute above the return
function List({ items, status }) {
  let body;
  if (status === 'loading') body = <Spinner />;
  else if (!items.length) body = <Empty />;
  else body = items.map((item) => <Row key={item.id} item={item} />);

  return <div className="list">{body}</div>;
}
`),
    ),
    warn(
      'Anything in an array needs a stable `key`. Without one React warns, and falls back to the array index — which is a real bug, not a lint nag. See lists and keys.',
    ),

    h('Strings, whitespace and escaping'),
    ul(
      'Text in JSX is escaped. `{userInput}` renders as text, never as markup — that is the default that makes XSS the exception in React rather than the rule.',
      'Whitespace collapses roughly as it does in HTML, but a line break between two expressions disappears entirely. Use `{\' \'}` when you need a literal space between two elements on separate lines.',
      'Comments inside JSX go in braces: `{/* like this */}`.',
    ),
    code(
      js(`
// The one escape hatch, and the only place a sanitizer becomes your problem.
<div dangerouslySetInnerHTML={{ __html: trustedHtml }} />
`),
    ),
    tip(
      'The clumsy name is deliberate. If you are reaching for it, the question to answer first is where the HTML came from and who can influence it.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Return two siblings', '`<>...</>`'],
      ['Repeat something', '`items.map(...)` with a `key`'],
      ['Branch', 'A ternary, or `&&` with a real boolean, or compute above the return'],
      ['Pass an object', 'Double braces — `style={{ ... }}` is an object in an expression slot'],
      ['Spread props through', '`<Row {...props} />`'],
      ['Render nothing', 'Return `null`'],
    ]),

    links(
      reactDoc('learn/writing-markup-with-jsx', 'Writing markup with JSX'),
      reactDoc('learn/javascript-in-jsx-with-curly-braces', 'JavaScript in JSX with curly braces'),
      reactDoc('reference/react/Fragment', 'Fragment'),
    ),
  ],
};
