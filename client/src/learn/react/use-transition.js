import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useTransition` marks a state update as **non-urgent**. React renders it in the background, keeps the old screen visible and interactive while it works, and abandons the work entirely if a more urgent update arrives.',
    ),
    p(
      'The problem it solves: one state change often drives two things of very different weight. Typing into a search box should update the input immediately; re-rendering the two thousand results below it can wait. Without transitions both happen in the same blocking render and the input stutters.',
    ),
    code(
      js(`
const [isPending, startTransition] = useTransition();

startTransition(() => {
  setQuery(value); // this update is interruptible
});
`),
    ),

    h('Signature'),
    sig([
      ['returns `[0]` `isPending`', '`boolean`', 'True while a transition started here is still rendering. Use it to show a subtle pending state.'],
      [
        'returns `[1]` `startTransition`',
        '`(scope) => void`',
        'Every state update made **synchronously** inside `scope` is marked non-urgent. Stable — never needs to be a dependency.',
      ],
    ]),

    h('The pattern'),
    code(
      jsx(`
function SearchPage() {
  const [text, setText] = useState('');       // urgent — the input
  const [query, setQuery] = useState('');     // non-urgent — the results
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    // Applied immediately, so the input never lags
    setText(e.target.value);

    // Rendered in the background, and thrown away if another keystroke lands
    startTransition(() => setQuery(e.target.value));
  }

  return (
    <>
      <input value={text} onChange={handleChange} />
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        <Results query={query} />
      </div>
    </>
  );
}
`),
    ),
    p(
      'Two state variables is the shape. One holds what the user typed and updates urgently; the other trails behind and drives the expensive subtree.',
    ),

    h('What "interrupt" actually means'),
    p(
      'React renders the transition in memory, a slice at a time, yielding to the browser between slices. If an urgent update arrives — another keystroke, a click — React throws away the partial work and starts again from the new state. Nothing half-rendered is ever committed.',
    ),
    ul(
      'The previous screen stays on the page, fully interactive, for the whole transition.',
      'There is no intermediate loading state unless you render one from `isPending`.',
      'A transition that finishes without being interrupted commits normally.',
      'This is only possible because of fiber — rendering progress lives in a data structure React owns rather than on the call stack.',
    ),

    h('The rules'),
    warn(
      'The function passed to `startTransition` must update state **synchronously**. React marks whatever happens during that call; anything after an `await` or inside a `setTimeout` has already left the scope and is urgent again.',
    ),
    code(
      js(`
// Wrong — setResults happens after the await, outside the transition
startTransition(async () => {
  const data = await fetchResults(q);
  setResults(data);
});

// Right — await outside, transition around the update
const data = await fetchResults(q);
startTransition(() => setResults(data));
`),
    ),
    ul(
      'Do not put text-input state in a transition. An input whose `value` lags behind the keystrokes feels broken.',
      'A transition cannot make a slow render fast. It moves the cost off the critical path; it does not remove it.',
      'React 19 allows async functions in `startTransition` for Actions, where the pending state covers the await. That is a different feature — see Actions and form hooks.',
    ),

    h('useTransition or useDeferredValue?'),
    p(
      'They achieve the same thing from opposite ends. Use whichever end you control.',
    ),
    table(
      ['', '`useTransition`', '`useDeferredValue`'],
      [
        ['You wrap', 'The update — the setter call', 'The value you receive'],
        ['Needs', 'Access to the code that sets state', 'Only the value, which can be a prop'],
        ['Extra state', 'Usually two state variables', 'None — one value, one deferred copy'],
        ['Pending flag', '`isPending`', 'Compare `value !== deferred` yourself'],
        ['Typical use', 'A tab switch, a filter you own', 'A prop you were handed and cannot change'],
      ],
    ),

    h('The other common case: tab switching'),
    code(
      jsx(`
function Tabs() {
  const [tab, setTab] = useState('overview');
  const [isPending, startTransition] = useTransition();

  // Without the transition, clicking a heavy tab freezes on the old one with
  // no feedback until the new one is ready.
  const select = (next) => startTransition(() => setTab(next));

  return (
    <>
      <TabBar value={tab} onSelect={select} busy={isPending} />
      {tab === 'overview' ? <Overview /> : <HeavyReport />}
    </>
  );
}
`),
    ),
    tip(
      'Keep the pending signal subtle — a dimmed panel, a thin bar, a spinner on the tab. Replacing the content with a big spinner defeats the point, which was to keep the old content visible.',
    ),

    h('Is this debouncing?'),
    p(
      'No, and it is usually better. A debounce delays *starting* the work by a fixed time, so a fast machine waits for nothing and a slow one still blocks once it starts. A transition starts immediately, uses whatever time the browser is not otherwise using, and gets thrown away for free when the input changes again.',
    ),
    note(
      'Debouncing is still right for anything with a cost per call — a network request, an analytics event. Transitions are for rendering cost.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Keep the input responsive while a list re-renders', '`startTransition` around the list state'],
      ['Show that background work is happening', '`isPending`'],
      ['You only have the value, not the setter', '`useDeferredValue`'],
      ['Avoid a spinner replacing good content', 'A transition — the old screen stays'],
      ['Reduce network calls', 'Debounce, not a transition'],
      ['Update after an await', 'Await first, then `startTransition` around the setter'],
    ]),

    links(
      reactDoc('reference/react/useTransition', 'useTransition'),
      reactDoc('reference/react/useDeferredValue', 'useDeferredValue'),
    ),
  ],
};
