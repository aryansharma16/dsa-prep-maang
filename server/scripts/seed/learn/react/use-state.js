import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, table, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useState` declares a piece of state: a value that persists between renders, and a function that replaces it and schedules a re-render.',
    ),
    code(
      js(`
const [value, setValue] = useState(initialValue);
`),
    ),

    h('Signature'),
    sig([
      [
        '`initialState`',
        'any, or `() => any`',
        'The value on the first render only. Ignored on every render after. Pass a function to compute it lazily.',
      ],
      ['returns `[0]`', 'the value', 'The current state for this render. A constant — it never changes mid-render.'],
      [
        'returns `[1]`',
        '`(next) => void` or `((prev) => next) => void`',
        'The setter. Stable for the life of the component, so it never needs to be a dependency.',
      ],
    ]),

    h('The initialiser runs once — but is evaluated every render'),
    p(
      'React ignores the argument after the first render, but JavaScript still evaluates the expression you wrote every time. If computing it is expensive, that cost is paid on every render for nothing.',
    ),
    code(
      js(`
// readStoredFilters() runs on EVERY render; its result is used on the first
const [filters, setFilters] = useState(readStoredFilters());

// Lazy initialiser — React calls it only when it needs an initial value
const [filters, setFilters] = useState(readStoredFilters);
const [rows, setRows] = useState(() => parse(bigCsvString));
`),
    ),
    warn(
      'Pass the function itself, not the result. `useState(() => 0)` gives state of `0`; `useState(makeThing)` calls `makeThing` once. To store an actual function as state you must wrap it: `useState(() => myFn)`.',
    ),

    h('Setting state'),
    code(
      js(`
setCount(5);                        // replace
setCount((prev) => prev + 1);       // derive from the latest queued value
setUser((prev) => ({ ...prev, name })); // objects: replace, never mutate
`),
    ),
    p(
      'The setter replaces — it does not merge. Class components merged with `setState`; `useState` does not, which is why object state always spreads the previous value.',
    ),
    p(
      'Use the updater form whenever the next value is computed from the current one. It reads the latest queued state rather than the render snapshot, so several updates in one handler compound instead of colliding. See state for the full snapshot model.',
    ),

    h('Bailing out'),
    p(
      'If the new value is `Object.is`-equal to the current one, React skips the re-render. That is why `setStatus(\'idle\')` when it is already `idle` costs nothing — and why mutating an object and passing it back renders nothing at all.',
    ),
    code(
      js(`
setItems(items);        // same reference, no render, even after items.push()
setItems([...items]);   // new reference, renders
`),
    ),
    note(
      'React may still render once more before bailing out — it has to call your component to find out the result. It will not go on to re-render the children.',
    ),

    h('Resetting state'),
    table(
      ['Want', 'Do'],
      [
        ['Reset when a prop changes', 'Put the prop in a `key` on the component'],
        ['Reset part of the state when a prop changes', 'Store the previous prop in state and compare during render'],
        ['Reset on a button click', 'Call the setters in the handler'],
      ],
    ),
    code(
      jsx(`
// The whole form resets when userId changes — no effect involved
<ProfileForm key={userId} userId={userId} />
`),
    ),
    code(
      js(`
// The rarer partial case: adjust during render, not in an effect. React
// re-runs the component immediately without committing the first pass.
function List({ items }) {
  const [selection, setSelection] = useState(null);
  const [prevItems, setPrevItems] = useState(items);

  if (items !== prevItems) {
    setPrevItems(items);
    setSelection(null);
  }
  // ...
}
`),
    ),
    warn(
      'Doing that in a `useEffect` instead means one committed render where the new items are shown with the old selection. It flashes, and every child re-renders twice.',
    ),

    h('When not to use it'),
    ul(
      '**It can be computed.** `const count = items.length` beats a `count` state that has to be kept in step.',
      '**It does not affect the output.** A timer id, a previous value, a scroll position you only read — that is `useRef`.',
      '**It is server data.** A fetch plus `useState` plus `useEffect` reinvents caching, deduping and revalidation badly.',
      '**It is a copy of a prop.** See derived state in common pitfalls.',
      '**There are too many related pieces.** Once several values always change together under named events, `useReducer` is clearer.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Expensive initial value', '`useState(() => compute())`'],
      ['Next value uses the old one', '`setX((prev) => ...)`'],
      ['Update one field of an object', '`setX((prev) => ({ ...prev, field }))`'],
      ['Store a function as state', '`useState(() => fn)`'],
      ['Reset everything when an id changes', 'A `key`'],
      ['A value that must not cause a render', '`useRef`'],
      ['Several values, complex transitions', '`useReducer`'],
    ]),

    links(
      reactDoc('reference/react/useState', 'useState'),
      reactDoc('learn/state-a-components-memory', 'State: a components memory'),
    ),
  ],
};
