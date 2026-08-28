import { cheat, code, h, js, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'State is memory that belongs to one instance of a component and survives re-renders. Props come from outside and are read-only; state is owned by the component and is the only thing it may change about itself.',
    ),
    p(
      'Changing it is not an assignment. You call a setter, which asks React to schedule a re-render — and the value you are holding does not change until that render happens.',
    ),

    h('State is a snapshot'),
    p(
      'This is the single idea that explains most "state is one behind" confusion. Every render gets its own frozen copy of every state variable. The setter does not reach back and edit the copy the current render is holding.',
    ),
    code(
      js(`
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
    console.log(count); // 0 — still the snapshot this render was given
  }
  // count goes from 0 to 1, not to 3: all three calls computed 0 + 1
}
`),
    ),
    p(
      'The three calls are not overwriting one another out of some race. Each one read the same `count` — the constant this render closed over — and each queued "set it to 1".',
    ),

    h('The updater form'),
    p(
      'Pass a function instead of a value and React calls it with the latest queued state rather than the render snapshot. Use it whenever the next value is derived from the previous one.',
    ),
    code(
      js(`
setCount((prev) => prev + 1);
setCount((prev) => prev + 1);
setCount((prev) => prev + 1);
// count goes from 0 to 3
`),
    ),
    tip(
      'The rule of thumb: if the new value mentions the old value, use the updater. It is also what lets an effect or a callback update state without listing that state as a dependency — see stale closures in common pitfalls.',
    ),

    h('Batching'),
    p(
      'React groups the state updates that happen in one go into a single re-render. Since React 18 this covers everything — event handlers, timeouts, promises, native event listeners — which is what "automatic batching" means.',
    ),
    code(
      js(`
function handleSubmit() {
  setSaving(true);
  setError(null);
  setDraft('');
  // One re-render, not three.
}
`),
    ),
    note(
      'React 17 batched inside React event handlers only, so the same three calls inside a `.then()` produced three renders. Anything you read about that behaviour predates React 18.',
    ),
    p(
      'Batching is also why `flushSync` exists: it is the escape hatch for the rare case where you must see the DOM updated before the next line runs.',
    ),

    h('Never mutate state'),
    p(
      'React compares the previous state to the next with `Object.is`. Mutating an object or array leaves the reference identical, so React concludes nothing changed and skips the render.',
    ),
    code(
      js(`
// Nothing happens — same array reference
items.push(newItem);
setItems(items);

// Arrays
setItems((prev) => [...prev, newItem]);                       // add
setItems((prev) => prev.filter((i) => i.id !== id));          // remove
setItems((prev) => prev.map((i) => (i.id === id ? next : i))); // replace one
setItems((prev) => [...prev].sort(byName));                    // sort a copy

// Objects
setUser((prev) => ({ ...prev, name }));
setForm((prev) => ({ ...prev, address: { ...prev.address, city } }));
`),
    ),
    warn(
      '`sort`, `reverse`, `splice`, `push`, `pop` and `shift` all mutate in place. `map`, `filter`, `slice`, `concat` and `toSorted` return a new array. When in doubt, copy first.',
    ),

    h('Structuring state'),
    ul(
      '**Group what changes together.** Two values that always update in the same handler can be one object.',
      '**Do not duplicate.** If a value can be computed from another piece of state or from props, compute it during render instead of storing it. Two copies drift.',
      '**Avoid deep nesting.** Updating `a.b.c.d` immutably means spreading four levels. Flatten, or key by id.',
      '**Do not mirror props into state.** `useState(props.value)` only reads the prop once, and then silently ignores it. See derived state in common pitfalls.',
      '**Avoid contradictory flags.** `isLoading` plus `isError` plus `isSuccess` can be all three at once; one `status` string cannot.',
    ),
    code(
      js(`
// Storing something derivable — now there are two sources of truth
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);

// Derive it instead — impossible to get out of step
const [items, setItems] = useState([]);
const count = items.length;
`),
    ),

    h('State is tied to a position in the tree'),
    p(
      'React keys state to where a component sits in the rendered tree, not to the JSX that produced it. Render the same component type in the same position and the state stays; render a different type there, or the same type in a different position, and it is thrown away.',
    ),
    code(
      jsx(`
// State inside Editor is preserved across the toggle — same type, same slot
{isPreview ? <Editor mode="preview" /> : <Editor mode="edit" />}

// State is reset every time userId changes, on purpose
<Editor key={userId} userId={userId} />
`),
    ),
    tip(
      'A `key` on a non-list element is the standard way to say "this is a different thing now, forget everything". It is far more reliable than an effect that resets six state variables when a prop changes.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Set a value that depends on the old one', '`setX((prev) => ...)`'],
      ['Add to an array', '`setItems((prev) => [...prev, item])`'],
      ['Update one field of an object', '`setUser((prev) => ({ ...prev, field }))`'],
      ['Avoid an impossible combination of flags', 'One `status` string'],
      ['Reset a subtree when an id changes', 'A `key` on the component'],
      ['Read the DOM after an update', '`flushSync`, rarely'],
    ]),
    table(
      ['Question', 'Answer'],
      [
        ['Why is my value stale in the handler?', 'It is the snapshot from this render. Use the updater form.'],
        ['Why did nothing render?', 'You mutated. Same reference, so `Object.is` said equal.'],
        ['Why did state reset?', 'The type or the position or the key at that slot changed.'],
        ['Why did state NOT reset?', 'Same type, same position, same key. Add a `key`.'],
      ],
    ),

    links(
      reactDoc('learn/state-as-a-snapshot', 'State as a snapshot'),
      reactDoc('learn/queueing-a-series-of-state-updates', 'Queueing a series of state updates'),
      reactDoc('learn/choosing-the-state-structure', 'Choosing the state structure'),
      reactDoc('learn/updating-objects-in-state', 'Updating objects in state'),
    ),
  ],
};
