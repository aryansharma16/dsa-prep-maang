import { cheat, code, h, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useDeferredValue` returns a copy of a value that is allowed to lag behind. React renders once immediately with the old copy, then renders again in the background with the new one — and that second render is interruptible, so a fast-changing value never blocks the UI.',
    ),
    code(
      jsx(`
const deferred = useDeferredValue(value, initialValue?);
`),
    ),

    h('Signature'),
    sig([
      ['`value`', 'any', 'The value to defer. Should be a primitive or a stable reference — see below.'],
      ['`initialValue`', 'any', 'React 19. What to return on the very first render, instead of `value`.'],
      ['returns', 'same type', 'The current value, or the previous one while a background render is in flight.'],
    ]),

    h('How the two renders play out'),
    p('Typing one character into a search box:'),
    ul(
      '1. `query` becomes `"rea"`. `useDeferredValue` returns the old `"re"`.',
      '2. React renders urgently with `query = "rea"` and `deferred = "re"`. The input updates; the results still show the old ones. This render is fast.',
      '3. React starts a background render with `deferred = "rea"`.',
      '4. Another keystroke arrives — React abandons that render and starts again from `"real"`.',
      '5. When typing pauses, the background render finishes and commits. The results catch up.',
    ),
    p(
      'The old content stays on screen the entire time. There is no flash of empty, no spinner, and the input never drops a frame.',
    ),

    h('The pattern'),
    code(
      jsx(`
function Search() {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  // Compare the two to know a background render is in flight
  const stale = query !== deferred;

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: stale ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        <Results query={deferred} />
      </div>
    </>
  );
}
`),
    ),
    warn(
      'The deferred value only helps if the expensive child actually skips work when its props are unchanged. Wrap it in `memo`, or the background render re-renders everything anyway and you have gained nothing.',
    ),
    code(
      jsx(`
// Required for the above to do anything
const Results = memo(function Results({ query }) {
  const rows = useMemo(() => search(query), [query]);
  return rows.map((row) => <Row key={row.id} row={row} />);
});
`),
    ),

    h('Against useTransition'),
    table(
      ['', '`useDeferredValue`', '`useTransition`'],
      [
        ['You hold', 'The value', 'The setter'],
        ['Works on a prop from a parent', 'Yes', 'No — you would need to change the parent'],
        ['Extra state variable', 'No', 'Usually one more'],
        ['Pending signal', '`value !== deferred`', '`isPending`'],
        ['Wraps', 'A value', 'An update'],
      ],
    ),
    tip(
      'If you own the `setState` call, `useTransition` is more direct. If the value arrives as a prop and you cannot touch where it came from, `useDeferredValue` is the only one of the two available.',
    ),

    h('Against debouncing and throttling'),
    ul(
      'A debounce waits a fixed number of milliseconds whether or not the machine needed them. A deferred value starts immediately and uses whatever time is idle.',
      'A debounce that is interrupted has still burned its timer. An abandoned background render costs nothing.',
      'A debounce cannot know when rendering finished. React does.',
      'But a debounce can throttle *network calls*, and a deferred value cannot — it only defers rendering.',
    ),
    note(
      'The two compose: debounce the fetch, defer the render of whatever comes back.',
    ),

    h('Suspense'),
    p(
      'When the deferred value feeds a component that suspends, React shows the previous content instead of the fallback while the new data loads. That is what makes a search-as-you-type interface stop flashing a spinner on every keystroke.',
    ),
    code(
      jsx(`
<Suspense fallback={<Skeleton />}>
  {/* The skeleton shows only on the very first load. After that the previous
      results stay put until the new ones are ready. */}
  <Results query={deferred} />
</Suspense>
`),
    ),

    h('Watch for'),
    warn(
      'Pass a primitive, or a reference that only changes when the data does. `useDeferredValue({ query })` receives a new object every render, so the deferred copy is always different from the current one and React never settles.',
    ),
    ul(
      'It does not make anything faster. The same work happens; it happens off the critical path.',
      'It has no delay to tune. React decides, based on how busy the main thread is.',
      'Nothing is skipped or dropped — the final value always renders.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Keep typing smooth over a heavy list', '`useDeferredValue(query)` + `memo` on the list'],
      ['Show that results are catching up', '`query !== deferred`'],
      ['You own the setter instead', '`useTransition`'],
      ['Avoid a Suspense fallback on every keystroke', 'Defer the value the suspending child reads'],
      ['Cut down network requests', 'Debounce — this hook does not do that'],
      ['First-render placeholder', 'The `initialValue` argument, React 19'],
    ]),

    links(
      reactDoc('reference/react/useDeferredValue', 'useDeferredValue'),
      reactDoc('reference/react/useTransition', 'useTransition'),
    ),
  ],
};
