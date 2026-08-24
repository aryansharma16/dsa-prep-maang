import { cheat, code, h, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'There is no conditional syntax in JSX because JSX is an expression, and JavaScript has no `if` expression. Everything below is ordinary JavaScript in an expression slot.',
    ),
    p(
      'React renders `null`, `undefined`, `true` and `false` as nothing at all. That is what makes short-circuiting work, and it is also the source of the one classic bug on this page.',
    ),

    h('The four forms'),
    code(
      jsx(`
// 1. Early return — the clearest when the whole component differs
function Row({ item }) {
  if (!item) return null;
  return <li>{item.title}</li>;
}

// 2. Ternary — for one value or one element, inline
<span className={done ? 'done' : 'todo'}>{title}</span>
{done ? <IconCheck /> : <IconClock />}

// 3. && — for "render this or nothing"
{error && <p className="alert">{error}</p>}

// 4. A variable computed above the return — for anything with three branches
function List({ status, items }) {
  let body;
  if (status === 'loading') body = <Spinner />;
  else if (status === 'error') body = <Alert />;
  else if (!items.length) body = <Empty />;
  else body = items.map((item) => <Row key={item.id} item={item} />);

  return <div className="list">{body}</div>;
}
`),
    ),
    tip(
      'Nested ternaries in JSX are where readability goes to die. Two branches inline, three or more in a variable above the return.',
    ),

    h('The && trap'),
    p(
      'When the left side of `&&` is falsy, JavaScript returns that value rather than `false`. `0` and `NaN` and `\'\'` are falsy — and `0` is a value React renders.',
    ),
    code(
      jsx(`
// Renders a literal "0" on the page when the cart is empty
{cart.length && <Badge count={cart.length} />}

// Fixes
{cart.length > 0 && <Badge count={cart.length} />}
{Boolean(cart.length) && <Badge count={cart.length} />}
{cart.length ? <Badge count={cart.length} /> : null}
`),
    ),
    warn(
      'The empty string renders as nothing, so `{name && <p>{name}</p>}` looks safe — until `name` is a number. Make the left side a real boolean and the class of bug disappears.',
    ),

    h('What renders as nothing'),
    table(
      ['Value', 'Rendered'],
      [
        ['`null`, `undefined`', 'Nothing'],
        ['`true`, `false`', 'Nothing'],
        ['`0`, `NaN`', 'The number, visibly'],
        ['`\'\'` (empty string)', 'Nothing'],
        ['`[]`', 'Nothing'],
        ['An object', 'A crash — objects are not valid React children'],
      ],
    ),

    h('Conditional props, not conditional JSX'),
    p(
      'When only an attribute differs, branch on the attribute. Duplicating the whole element is how the two copies drift apart, and it also gives React two different positions to reconcile.',
    ),
    code(
      jsx(`
// Duplicated — and the state inside would reset when isWide flips, because
// these are two different positions in the tree
{isWide ? <Panel className="wide" title={title} /> : <Panel title={title} />}

// One element
<Panel className={isWide ? 'wide' : ''} title={title} />

// Conditionally including a prop at all
<input {...(readOnly ? { readOnly: true } : {})} value={value} />
`),
    ),

    h('Conditional rendering unmounts'),
    p(
      'A component removed by a condition is unmounted: its state is destroyed and its effects clean up. It is not hidden — it is gone, and it will mount fresh when the condition flips back.',
    ),
    code(
      jsx(`
// Unmounts — Panel loses everything, effects run their cleanup
{isOpen && <Panel />}

// Stays mounted, just invisible — state and effects survive, and so does
// the cost of rendering it
<Panel style={{ display: isOpen ? 'block' : 'none' }} />
`),
    ),
    note(
      'Neither is right in general. Unmount when the component is expensive or its state should not persist; hide when remounting would lose scroll position, a video, or an in-progress form.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Render nothing', 'Return `null`'],
      ['One thing or nothing', '`{cond && <X />}` — with `cond` a real boolean'],
      ['One thing or another', '`{cond ? <A /> : <B />}`'],
      ['Three or more branches', 'Compute a variable above the return'],
      ['Only a prop differs', 'A ternary on the prop, not two elements'],
      ['Keep state while hidden', 'CSS, not a condition'],
    ]),
    ul(
      'A `key` on the two branches of a ternary forces a remount when they swap, which is occasionally what you want — a fresh form per mode, for instance.',
    ),

    links(
      reactDoc('learn/conditional-rendering', 'Conditional rendering'),
      reactDoc('learn/preserving-and-resetting-state', 'Preserving and resetting state'),
    ),
  ],
};
