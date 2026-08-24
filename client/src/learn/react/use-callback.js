import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useCallback` caches a function definition between renders. It is `useMemo` specialised for functions — `useCallback(fn, deps)` is exactly `useMemo(() => fn, deps)`, and exists only because that form is awkward to read.',
    ),
    code(
      js(`
const handleSave = useCallback(() => {
  save(id, draft);
}, [id, draft]);
`),
    ),

    h('Signature'),
    sig([
      ['`fn`', '`function`', 'The function to cache. Not called — stored.'],
      ['`dependencies`', '`array`', 'Everything the function reads from the component. Compared with `Object.is`.'],
      ['returns', '`function`', 'The same function reference until a dependency changes.'],
    ]),
    table(
      ['', 'Caches', 'You pass'],
      [
        ['`useMemo(fn, deps)`', 'What `fn` returns', 'A function that computes a value'],
        ['`useCallback(fn, deps)`', '`fn` itself', 'The function you want to keep'],
      ],
    ),

    h('Why a stable function matters'),
    p(
      'Every render creates new function objects. That is normally invisible — passing a fresh `onClick` to a `<button>` costs nothing. It stops being invisible in exactly three places.',
    ),
    ul(
      'The function is a **prop of a `memo` component**. A new reference fails the props comparison, so `memo` never skips anything.',
      'The function is a **dependency of an effect**. A new reference re-runs the effect on every render — tearing down and rebuilding a subscription each time.',
      'The function is a **dependency of another memo or callback**, which then invalidates for the same reason.',
    ),
    code(
      jsx(`
const Row = memo(function Row({ item, onSelect }) { ... });

function List({ items }) {
  // New function every render -> every Row re-renders -> memo is decorative
  const onSelect = (id) => setSelected(id);

  // Stable — setSelected is guaranteed stable, so there are no dependencies
  const onSelect = useCallback((id) => setSelected(id), []);

  return items.map((item) => (
    <Row key={item.id} item={item} onSelect={onSelect} />
  ));
}
`),
    ),
    warn(
      'Both halves are required. `useCallback` on a prop passed to a component that is *not* wrapped in `memo` does nothing at all — the child re-renders because its parent did, regardless of what the prop identity is.',
    ),

    h('The effect case'),
    code(
      js(`
// The effect depends on a function rebuilt every render, so it re-subscribes
// on every render
function Room({ roomId }) {
  function createOptions() {
    return { serverUrl: SERVER, roomId };
  }
  useEffect(() => {
    const conn = connect(createOptions());
    return () => conn.close();
  }, [createOptions]);  // new every render
}

// Fix 1 — move it inside the effect, and depend on the primitive
useEffect(() => {
  const conn = connect({ serverUrl: SERVER, roomId });
  return () => conn.close();
}, [roomId]);

// Fix 2 — when the function must be shared, memoise it
const createOptions = useCallback(() => ({ serverUrl: SERVER, roomId }), [roomId]);
`),
    ),
    tip(
      'Fix 1 first, always. A function only used by one effect belongs inside that effect, where the linter can see its real dependencies and nothing can go stale.',
    ),

    h('What is already stable'),
    p('These never need wrapping, and listing them as dependencies is harmless but pointless:'),
    ul(
      '`useState` setters.',
      '`useReducer` dispatch.',
      'Ref objects from `useRef` — though not `ref.current`.',
      'Functions declared outside the component entirely.',
    ),

    h('The stale closure risk'),
    warn(
      'A cached function keeps the values from the render that created it. Omit a dependency and it will happily go on reading a value from three renders ago — silently, with no warning, until someone notices the wrong number was saved.',
    ),
    code(
      js(`
// count is missing from the deps, so this always saves the count from mount
const save = useCallback(() => {
  api.save(count);
}, []);

// Either list it — the function is re-created when count changes
const save = useCallback(() => api.save(count), [count]);

// Or stop reading it: the updater form has no such problem
const bump = useCallback(() => setCount((prev) => prev + 1), []);

// Or keep the latest value in a ref, when the identity must stay stable
const latest = useRef(count);
useEffect(() => { latest.current = count; }, [count]);
const save = useCallback(() => api.save(latest.current), []);
`),
    ),

    h('When not to bother'),
    p(
      'Most of the time. A `useCallback` that guards nothing costs a closure allocation and an array comparison on every render, and adds a dependency list that can go wrong — all to avoid an allocation that was already free.',
    ),
    table(
      ['Situation', 'Wrap it?'],
      [
        ['Prop of a `memo` child, in a list', 'Yes'],
        ['Prop of a plain child', 'No'],
        ['Dependency of an effect you cannot inline', 'Yes'],
        ['Returned from a custom hook used in unknown places', 'Yes — you cannot see the call sites'],
        ['An inline `onClick` on a DOM element', 'No'],
        ['Everything, out of habit', 'No'],
      ],
    ),
    note(
      'The React Compiler in the React 19 toolchain does this automatically and correctly, which is the eventual answer to this whole page. Until it is adopted, memoise deliberately and rarely.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Prop to a `memo` child', '`useCallback(fn, [deps])`'],
      ['Function used by an effect', 'Move it inside the effect first'],
      ['Function returned by a custom hook', '`useCallback` — the caller may be memoised'],
      ['Update state without depending on it', 'The updater form, no dependency needed'],
      ['Keep identity but read fresh values', 'A ref updated in an effect'],
      ['A plain button handler', 'Leave it inline'],
    ]),

    links(
      reactDoc('reference/react/useCallback', 'useCallback'),
      reactDoc('reference/react/memo', 'memo'),
      reactDoc('learn/removing-effect-dependencies', 'Removing effect dependencies'),
    ),
  ],
};
