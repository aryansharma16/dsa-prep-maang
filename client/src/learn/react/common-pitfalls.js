import { cheat, code, h, js, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'These are the bugs that come from the model rather than from a typo. Each one is code that looks correct, runs, and is wrong — and each is a direct consequence of something on one of the other pages.',
    ),

    h('Stale closures'),
    p(
      'Every render creates new functions that capture that render values. A function that outlives its render — inside a `setTimeout`, a subscription, a memoised callback with the wrong dependencies — keeps reading the old values forever.',
    ),
    code(
      js(`
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // This closure captured count === 0 and never sees another value,
    // so the display sticks at 1.
    const id = setInterval(() => setCount(count + 1), 1000);
    return () => clearInterval(id);
  }, []);
}
`),
    ),
    p('Three fixes, in order of preference:'),
    ul(
      '**Stop reading the value.** The updater form takes the latest state, so the effect no longer depends on it: `setCount((prev) => prev + 1)`.',
      '**List the dependency.** Correct, but here it tears down and rebuilds the interval every second.',
      '**Keep it in a ref.** A ref updated by its own effect, read as `latest.current`, when the identity must stay stable.',
    ),
    tip(
      'The symptom to recognise: a value that is always the one it had when the component mounted. If you see "it works the first time and then stops", start here.',
    ),

    h('Derived state — copying props into state'),
    code(
      jsx(`
// The bug: useState reads its argument once. When the user prop changes,
// name keeps the old value and nothing updates.
function Editor({ user }) {
  const [name, setName] = useState(user.name);
}

// The usual "fix" — an effect that syncs. Now there is one committed render
// showing the wrong name, and every child re-renders twice.
useEffect(() => {
  setName(user.name);
}, [user]);
`),
    ),
    p('What to do instead, depending on what you actually meant:'),
    table(
      ['You meant', 'Do'],
      [
        ['It is fully derived from the prop', 'Do not store it. Use `user.name` directly.'],
        ['It is an editable copy that resets per user', 'A `key` on the component — `<Editor key={user.id} user={user} />`'],
        ['It is an editable copy the parent should know about', 'Lift it. The parent owns it and passes `value` and `onChange`.'],
        ['It is a genuinely independent draft', 'Keep the state, and be explicit about when it resets.'],
      ],
    ),
    warn(
      'The `key` version is the one people forget, and it is usually the right one. It resets everything in the subtree in the same commit that changes the prop, so nothing is ever briefly wrong.',
    ),

    h('Effects doing work that belongs elsewhere'),
    p(
      'The most common structural mistake in React code. An effect is for synchronising with something outside React — if nothing outside React is involved, something else fits better.',
    ),
    table(
      ['An effect that', 'Should be'],
      [
        ['Computes a value from props or state', 'A calculation during render'],
        ['Recomputes something expensive', '`useMemo`'],
        ['Resets state when a prop changes', 'A `key`'],
        ['POSTs because a button was clicked', 'Code in the click handler'],
        ['Calls a parent callback after state changed', 'Called in the same handler that set the state'],
        ['Reacts to state another effect just set', 'Both computed in one place'],
      ],
    ),
    code(
      js(`
// Two renders, and a frame where fullName is stale
const [fullName, setFullName] = useState('');
useEffect(() => setFullName(first + ' ' + last), [first, last]);

// One render, never stale
const fullName = first + ' ' + last;
`),
    ),

    h('Unstable dependencies'),
    p(
      'Objects, arrays and functions created during render are new every render, and `Object.is` on two structurally identical objects is `false`. Put one in a dependency array and the effect runs forever, or the memo never hits.',
    ),
    code(
      js(`
// Loops: new object -> effect runs -> setState -> render -> new object
const options = { userId, include: 'profile' };
useEffect(() => { load(options).then(setData); }, [options]);

// Depend on the primitives instead — no memo needed
useEffect(() => {
  load({ userId, include: 'profile' }).then(setData);
}, [userId]);
`),
    ),
    tip(
      'Prefer primitives in dependency arrays. `[userId, page]` cannot go wrong; `[options]` requires a `useMemo` that itself has to be right.',
    ),

    h('Mutating state'),
    code(
      js(`
items.push(item); setItems(items);        // same reference — no render
user.name = name; setUser(user);          // same reference — no render
rows.sort(byName); setRows(rows);         // sort mutates in place

setItems((prev) => [...prev, item]);
setUser((prev) => ({ ...prev, name }));
setRows((prev) => [...prev].sort(byName));
`),
    ),
    warn(
      'The mutating array methods to watch for: `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`. The copying ones: `map`, `filter`, `slice`, `concat`, and the newer `toSorted` and `toReversed`.',
    ),

    h('Index as a key'),
    p(
      'Covered fully in lists and keys, and worth repeating because it survives review: an index key describes the slot, not the item. It is invisible in a read-only list and corrupting the moment a row holds state.',
    ),
    code(
      jsx(`
// Prepend an item and every checkbox state shifts to the wrong row
{items.map((item, i) => <Row key={i} item={item} />)}

{items.map((item) => <Row key={item.id} item={item} />)}
`),
    ),

    h('Defining a component inside a component'),
    code(
      jsx(`
// A new function identity every render, so React sees a different type at
// that position and destroys the subtree — every render. All state inside
// Inner is lost, and the DOM is rebuilt from scratch.
function Page() {
  function Inner() { return <input />; }
  return <Inner />;
}
`),
    ),
    p(
      'Move it to module scope and pass what it needs as props. The same applies to a component created inside a `useMemo` or returned from a function called during render.',
    ),

    h('The && zero'),
    code(
      jsx(`
{cart.length && <Badge count={cart.length} />}      // renders "0" when empty
{cart.length > 0 && <Badge count={cart.length} />}
`),
    ),

    h('Async state after unmount'),
    code(
      js(`
// Two requests in flight; whichever lands last wins, which on a slow
// connection is the one for the previous id.
useEffect(() => {
  fetch(\`/api/users/\${id}\`).then((r) => r.json()).then(setUser);
}, [id]);

useEffect(() => {
  const controller = new AbortController();
  fetch(\`/api/users/\${id}\`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((err) => { if (err.name !== 'AbortError') setError(err); });
  return () => controller.abort();
}, [id]);
`),
    ),
    note(
      'React 18 no longer warns about setting state on an unmounted component — it was a false positive more often than not. The race condition it was pointing at is real, and the abort is what fixes it.',
    ),

    h('Suppressing the exhaustive-deps warning'),
    warn(
      'An `eslint-disable-next-line react-hooks/exhaustive-deps` is almost always hiding a stale closure that will be found by a user, months later, as "sometimes it saves the wrong value". The lint rule has a very low false-positive rate.',
    ),
    p(
      'The three legitimate answers are on the useEffect page: stop reading the value, move the value out of the effect, or accept that the code is not synchronisation and move it to an event handler.',
    ),

    h('Cheatsheet'),
    cheat([
      ['A value stuck at its mount-time value', 'Stale closure — updater form, or a ref'],
      ['A prop change that does not update the UI', 'Derived state — remove the copy, or use a `key`'],
      ['An effect that never stops running', 'An unstable object in the dependency array'],
      ['A state change that renders nothing', 'You mutated — copy instead'],
      ['State attached to the wrong list row', 'Index as a key'],
      ['A subtree that remounts constantly', 'A component defined inside a component'],
      ['A stray `0` on the page', '`&&` on a number'],
      ['The wrong record after switching fast', 'Unaborted fetch — `AbortController`'],
    ]),

    links(
      reactDoc('learn/you-might-not-need-an-effect', 'You might not need an effect'),
      reactDoc('learn/removing-effect-dependencies', 'Removing effect dependencies'),
      reactDoc('learn/keeping-components-pure', 'Keeping components pure'),
      reactDoc('learn/choosing-the-state-structure', 'Choosing the state structure'),
    ),
  ],
};
