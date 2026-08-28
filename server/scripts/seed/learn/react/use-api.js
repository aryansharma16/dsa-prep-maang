import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    note(
      'React 19. This app runs React 18.3.1, so it is not available here yet.',
    ),
    p(
      '`use` reads the value of a resource during render. Given a promise, it suspends until the promise resolves and then returns its value; given a context, it returns the context value. It is the first React API of its kind that is **not** bound by the rules of hooks.',
    ),
    code(
      js(`
const value = use(promiseOrContext);
`),
    ),

    h('Signature'),
    sig([
      [
        '`resource`',
        '`Promise` or `Context`',
        'A promise React reads from — suspending while pending, throwing if it rejects — or a context to read.',
      ],
      ['returns', 'the value', 'The resolved value, or the context value.'],
    ]),

    h('Why it may be called conditionally'),
    p(
      'The rules of hooks exist because React matches hooks to state by call order. `use` stores nothing per call — it reads something that already exists — so there is no slot to get out of order.',
    ),
    code(
      jsx(`
function Message({ messagePromise, show }) {
  if (!show) return null;

  // Legal. useContext or useState here would be a bug.
  const text = use(messagePromise);
  return <p>{text}</p>;
}
`),
    ),
    ul(
      'It can go inside an `if`, a loop, or after an early return.',
      'It still may only be called from a component or a hook — not from an event handler, a callback, or a `try` block.',
      'That last restriction is why errors from a rejected promise go to an error boundary rather than to a local `catch`.',
    ),

    h('Reading a promise'),
    p(
      'The critical rule: **the promise must be created outside the component that reads it**, or by a framework or cache that returns the same promise for the same input.',
    ),
    code(
      jsx(`
// Wrong — a new promise every render, so it suspends, re-renders, creates
// another promise, suspends again. An infinite loop.
function Profile({ id }) {
  const user = use(fetch(\`/api/users/\${id}\`).then((r) => r.json()));
}

// Right — the parent creates it once and passes it down
function Page({ id }) {
  const userPromise = useMemo(() => loadUser(id), [id]);
  return (
    <Suspense fallback={<Skeleton />}>
      <Profile userPromise={userPromise} />
    </Suspense>
  );
}

function Profile({ userPromise }) {
  const user = use(userPromise);
  return <h1>{user.name}</h1>;
}
`),
    ),
    warn(
      '`useMemo` is a hint, not a guarantee — React may drop the cached promise. In practice this pattern is only safe with a cache that really does return the same promise for the same key: a framework loader, React Query, or `cache()` in a Server Component. Hand-rolled `use` + `fetch` in a plain SPA is not a supported data-fetching strategy.',
    ),

    h('Reading a context'),
    p(
      'This half is immediately useful and has none of the caveats. `use(SomeContext)` is `useContext(SomeContext)` that can be called conditionally.',
    ),
    code(
      jsx(`
function Row({ item, compact }) {
  // Only read the theme in the branch that needs it
  if (compact) return <li>{item.title}</li>;

  const theme = use(ThemeContext);
  return <li className={theme}>{item.title}</li>;
}
`),
    ),
    tip(
      'The more common win is reading a context inside a loop, or after an early return — both of which `useContext` forbids and neither of which was ever a real hazard.',
    ),

    h('use against the alternatives'),
    table(
      ['', '`use(promise)`', '`useEffect` + `useState`'],
      [
        ['Loading state', 'A `Suspense` boundary', 'Your own boolean'],
        ['Error state', 'An error boundary', 'Your own state, plus a `catch`'],
        ['Race conditions', 'React handles ordering', 'You abort or use a `live` flag'],
        ['Where the request starts', 'Wherever the promise was created', 'After render and commit'],
        ['Works today, React 18', 'No', 'Yes'],
      ],
    ),
    p(
      'For a client-only SPA like this one, the practical answer today remains a data library — it gives you caching, deduping and revalidation on top of the loading and error handling, and the good ones already integrate with Suspense.',
    ),

    h('Watch for'),
    ul(
      'A rejected promise throws to the nearest error boundary. Give the boundary a fallback, or the whole subtree unmounts.',
      'Wrap the reader in `Suspense`, or the suspension bubbles to whatever boundary is above — often the whole page.',
      'When the deferred value pattern applies, `useDeferredValue` plus `use` keeps previous content on screen instead of flashing the fallback.',
      'The name is `use`, not `useSomething`, precisely because the hook rules do not apply. Do not read the prefix as a promise of hook semantics.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Read a promise during render', '`use(promise)` inside a `Suspense` boundary'],
      ['Read a context conditionally', '`use(SomeContext)`'],
      ['Create the promise', 'In a parent, a loader, or a cache — never inline'],
      ['Handle failure', 'An error boundary, not a `try`'],
      ['Fetch data in a plain SPA today', 'A data library — not hand-rolled `use`'],
    ]),

    links(
      reactDoc('reference/react/use', 'use'),
      reactDoc('reference/react/Suspense', 'Suspense'),
    ),
  ],
};
