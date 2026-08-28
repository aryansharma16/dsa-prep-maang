import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`lazy` declares a component whose code is loaded the first time it renders. `Suspense` is the boundary that shows a fallback while anything below it is still loading. They are usually used together, but they are separate ideas: `lazy` is about code, `Suspense` is about waiting.',
    ),
    code(
      jsx(`
const Report = lazy(() => import('./Report.jsx'));

<Suspense fallback={<Skeleton />}>
  <Report />
</Suspense>
`),
    ),

    h('lazy'),
    sig([
      [
        '`load`',
        '`() => Promise<{ default: Component }>`',
        'Called once, the first time the component renders. Must resolve to a module with a **default export**.',
      ],
      ['returns', 'a component', 'Render it like any other. React suspends while the promise is pending.'],
    ]),
    warn(
      'It must be a default export, and `lazy` must be called **outside** any component. Calling it during render creates a new lazy component every time, so React unmounts and re-downloads on every render.',
    ),
    code(
      js(`
// Wrong — a new lazy component per render
function Page() {
  const Report = lazy(() => import('./Report.jsx'));
}

// Right — module scope
const Report = lazy(() => import('./Report.jsx'));

// Named export? Adapt it in the loader.
const Report = lazy(() =>
  import('./Report.jsx').then((m) => ({ default: m.Report })),
);
`),
    ),
    note(
      'This app uses named exports everywhere, so any lazy route here would need the second form. Its Learn content dodges the issue by importing plain data modules rather than components — `useLearnDoc` calls `import()` directly and never goes through `lazy`.',
    ),

    h('Suspense'),
    p(
      'A `Suspense` boundary catches any descendant that suspends and shows `fallback` until it is ready. "Suspends" means the component threw a promise — which `lazy`, `use`, and Suspense-enabled data libraries all do internally.',
    ),
    table(
      ['Suspends today', 'Does not suspend'],
      [
        ['A `lazy` component still downloading', 'A `useEffect` fetch — effects run after render'],
        ['`use(promise)` in React 19', '`useState` + `fetch`'],
        ['Framework data loaders (Next.js, Remix)', 'Anything with its own `loading` boolean'],
        ['Suspense-enabled libraries — React Query, Relay', 'Images, unless the library wraps them'],
      ],
    ),
    warn(
      'A plain `useEffect` fetch does not trigger Suspense. Wrapping such a component in `<Suspense>` does nothing at all — the fallback never shows, because nothing ever suspends.',
    ),

    h('Where to draw the boundary'),
    p(
      'Boundary placement is the design decision. It decides how much of the screen disappears while something loads.',
    ),
    code(
      jsx(`
// Too coarse — the whole page vanishes because one chart is loading
<Suspense fallback={<PageSkeleton />}>
  <Header />
  <Chart />
  <Table />
</Suspense>

// Better — the header stays, and each slow part has its own placeholder
<Header />
<Suspense fallback={<ChartSkeleton />}>
  <Chart />
</Suspense>
<Suspense fallback={<TableSkeleton />}>
  <Table />
</Suspense>
`),
    ),
    ul(
      'Nested boundaries reveal content progressively — the outer one resolves, then the inner ones fill in.',
      'A fallback should be the same rough size and shape as the content, or the page jumps when it arrives.',
      'Every route in a code-split app wants a boundary around it.',
    ),

    h('The fallback flashing on every navigation'),
    p(
      'The classic complaint. The cause is that a normal state update showing new content that suspends replaces the existing screen with the fallback, even though there was perfectly good content on screen.',
    ),
    code(
      js(`
// Without a transition: click a tab -> the current tab vanishes -> spinner
setTab('report');

// With one: the current tab stays on screen and interactive until the new
// one is ready. React skips the fallback entirely.
startTransition(() => setTab('report'));
`),
    ),
    tip(
      'The rule: a Suspense fallback is for content that has **never** been shown. For replacing content that is already there, wrap the update in a transition, or feed the child a `useDeferredValue`.',
    ),
    ul(
      'Routers do this for you — React Router and Next.js wrap navigations in transitions.',
      'A second flash on going back means the chunk is not cached; that is usually a build or server-header problem, not a React one.',
    ),

    h('Preloading'),
    p(
      'A route split on `lazy` downloads its chunk at click time, which is the worst possible moment. Start it earlier — on hover, on focus, or when the app is idle.',
    ),
    code(
      jsx(`
const load = () => import('./Report.jsx');
const Report = lazy(load);

// The pointer sits on a link for a beat before the click lands, which is
// usually enough for the chunk to arrive.
<Link to="/report" onMouseEnter={() => load()} onFocus={() => load()}>
  Report
</Link>
`),
    ),
    note(
      'The `TopicCard` in this Learn track does exactly this with `topic.load()` on hover, which is why opening a topic rarely shows a skeleton.',
    ),

    h('What to split'),
    table(
      ['Good candidate', 'Why'],
      [
        ['A route most users never visit', 'Admin panels, settings, an onboarding flow'],
        ['A heavy dependency behind an interaction', 'A chart library, a rich text editor, a PDF viewer, a map'],
        ['A modal with a large body', 'Nobody pays for it until they open it'],
        ['Locale or content bundles', 'Load one, not forty'],
      ],
    ),
    warn(
      'Do not split everything. Each split is a separate request and a possible spinner, and a hundred tiny chunks are slower than a few sensible ones. Split on genuine boundaries and measure the bundle before and after.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Split a route', '`lazy(() => import(...))` at module scope + `Suspense`'],
      ['Named export', 'Map it to `default` in the loader'],
      ['Stop the fallback replacing good content', '`startTransition` around the update'],
      ['Load before the click', 'Call the loader on hover or focus'],
      ['Show partial content as it arrives', 'Nested `Suspense` boundaries'],
      ['Suspend on data', '`use`, or a Suspense-enabled data library — not `useEffect`'],
      ['Avoid layout shift', 'A fallback shaped like the real content'],
    ]),

    links(
      reactDoc('reference/react/lazy', 'lazy'),
      reactDoc('reference/react/Suspense', 'Suspense'),
      reactDoc('reference/react/useTransition', 'useTransition'),
    ),
  ],
};
