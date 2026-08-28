import { asked, cheat, code, h, jsx, js, link, links, note, p, reactDoc, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The `memo-and-performance` topic covers what `memo` compares and when it pays. This one is about the work around it: **measuring before changing anything**, and the three fixes that actually move the number — fewer renders, fewer DOM nodes, and less JavaScript downloaded.',
    ),

    h('Measure first'),
    code(
      sh(`
# React DevTools -> Profiler -> record an interaction -> stop
#   Flamegraph : what rendered, and how long each took
#   Ranked     : the most expensive components, sorted
#   "Why did this render?"  -> enable in Profiler settings. The single most
#                              useful setting in the whole tool.
`),
    ),
    code(
      jsx(`
// Or measure in code, including in production.
<Profiler id="TaskList" onRender={(id, phase, actualDuration) => {
  if (actualDuration > 16) analytics.track('slow-render', { id, phase, actualDuration });
}}>
  <TaskList />
</Profiler>
`),
    ),
    tip(
      '16 ms is the budget for one frame at 60 fps. A render over it drops a frame; a render over 100 ms feels like a stall. Profile in a **production build** — development React is several times slower, and StrictMode double-renders, so development timings tell you almost nothing about real cost.',
    ),

    h('Diagnose before optimising'),
    table(
      ['Symptom', 'Usually', 'Fix'],
      [
        ['Typing lags in a big form', 'Every keystroke re-renders the whole tree', 'Move state down, or uncontrolled inputs'],
        ['A long list scrolls badly', '5,000 DOM nodes', '**Virtualise**'],
        ['One click freezes for 300 ms', 'A heavy computation during render', '`useMemo`, or a transition'],
        ['Slow first paint', 'The bundle is 2 MB', '**Code splitting**'],
        ['Everything re-renders on any change', 'One context, or an unstable value', 'Split providers, stabilise props'],
        ['Slow after data arrives', 'Rendering 10,000 rows at once', 'Paginate or virtualise'],
      ],
    ),
    warn(
      'Wrapping everything in `memo`, `useMemo` and `useCallback` before profiling usually makes things **slower**. Each one costs a comparison and an allocation on every render, and a memo whose props change every time pays the cost and never skips a render. Measure, then apply narrowly.',
    ),

    h('Move state down'),
    p('The cheapest fix, and the one people skip because it involves no API.'),
    code(
      jsx(`
// Every keystroke re-renders ExpensiveChart and the whole 500-row table.
function Page() {
  const [query, setQuery] = useState('');
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ExpensiveChart />
      <Table rows={rows} query={query} />
    </>
  );
}

// The state now lives with the only components that care about it.
function Page() {
  return <><ExpensiveChart /><SearchableTable rows={rows} /></>;
}
function SearchableTable({ rows }) {
  const [query, setQuery] = useState('');
  …
}
`),
    ),
    tip(
      'Ask "what is the smallest subtree that needs this value?" and put the state there. Combined with passing children through (`<Layout>{expensiveChildren}</Layout>`), it removes most re-render problems without a single `memo`.',
    ),

    h('Virtualisation'),
    p(
      'The browser is fine with 200 DOM nodes and struggles with 20,000. Render only the rows in view and a few either side; scrolling swaps their contents.',
    ),
    code(
      jsx(`
import { useVirtualizer } from '@tanstack/react-virtual';

function TaskList({ tasks }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,                      // render a few beyond the viewport
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={tasks[row.index].id}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%',
              height: row.size, transform: \`translateY(\${row.start}px)\`,
            }}
          >
            <TaskRow task={tasks[row.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
`),
    ),
    warn(
      'Virtualisation breaks `Ctrl-F`, and it breaks screen-reader navigation unless you set the list and row ARIA roles and `aria-setsize` yourself. It is the right call for 10,000 rows and the wrong one for 50 — and "just paginate" is often better than either.',
    ),

    h('Code splitting'),
    code(
      jsx(`
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Editor = lazy(() => import('./components/RichEditor.jsx'));

<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/admin/*" element={<Admin />} />
  </Routes>
</Suspense>
`),
    ),
    code(
      sh(`
npm run build            # Vite prints every chunk and its gzip size
npx vite-bundle-visualizer   # a treemap of what is actually in there
`),
    ),
    table(
      ['Split at', 'Payoff'],
      [
        ['**Route boundaries**', 'Highest. A user who never opens admin never downloads it'],
        ['A heavy modal or editor', 'High — a rich text editor is often 300 kB alone'],
        ['A charting library', 'High, and it is usually the largest thing in the bundle'],
        ['Individual small components', 'Usually negative — an extra request for 2 kB'],
      ],
    ),
    tip(
      'Before splitting, check whether the dependency is needed at all. `moment` is ~70 kB and `Intl.DateTimeFormat` is built in; a chart library is 200 kB for one sparkline you could draw as SVG. Removing a dependency beats deferring it.',
    ),

    h('Transitions'),
    code(
      jsx(`
// The input stays responsive; the expensive list update is interruptible.
function Search({ items }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () => items.filter((i) => i.title.includes(deferredQuery)),
    [items, deferredQuery],
  );

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <Results items={results} stale={query !== deferredQuery} />
    </>
  );
}
`),
    ),
    note(
      'A transition does not make the work faster — it makes it **interruptible**, so typing is never blocked waiting for it. If the filter itself takes 400 ms, the real fix is filtering on the server or with an index, not deferring it.',
    ),

    h('Keys and reconciliation'),
    code(
      jsx(`
// An index key: inserting at the top makes React think every row changed,
// and re-renders all of them. It also moves input values to the wrong rows.
{tasks.map((task, i) => <Row key={i} task={task} />)}

// A stable identity: React moves the existing nodes and re-renders one.
{tasks.map((task) => <Row key={task.id} task={task} />)}
`),
    ),
    p(
      'This is a performance fix as often as it is a correctness fix, and it costs nothing. Before reaching for `memo` on a list row, check the key.',
    ),

    h('Images and fonts'),
    table(
      ['Do', 'Why'],
      [
        ['`loading="lazy"` on below-the-fold images', 'They stop competing with the first paint'],
        ['`width` and `height` on every image', 'Reserves the space — no layout shift'],
        ['Modern formats — AVIF, WebP', 'Often a quarter of the JPEG size'],
        ['`font-display: swap`', 'Text is visible before the font arrives'],
        ['Preload the one hero image', 'It is usually the largest-contentful-paint element'],
      ],
    ),
    note(
      'On a real product these usually beat every React-level optimisation. A 1.5 MB hero JPEG costs more than every wasted re-render in the application combined.',
    ),

    h('The order to work in'),
    code(
      js(`
1. Profile a production build. Find the actual slow thing.
2. Is it network? -> bundle size, images, fonts, caching.
3. Is it too many renders? -> move state down, split context, fix keys.
4. Is it too many DOM nodes? -> paginate, then virtualise.
5. Is it one expensive computation? -> useMemo, or move it to the server.
6. Only now: memo / useCallback, applied where the profiler pointed.
7. Measure again. Keep the change only if the number moved.
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Find the problem', 'DevTools Profiler, production build, "why did this render?"'],
      ['Typing lags', 'Move the state into a smaller component'],
      ['A huge list', 'Paginate; virtualise past a few thousand rows'],
      ['A big bundle', '`lazy` at route boundaries'],
      ['Find what is in the bundle', 'A bundle visualiser'],
      ['Keep input responsive', '`useDeferredValue` / `useTransition`'],
      ['A list re-rendering entirely', 'Check the key before reaching for `memo`'],
      ['Stop a context re-rendering everything', 'Split providers, memoise the value'],
      ['The biggest real-world win', 'Images and fonts, usually'],
    ]),

    h('Interview'),
    asked([
      ['How do you find a React performance problem?', 'Profile a production build in DevTools with "why did this render?" enabled — never guess.'],
      ['Why can `memo` make things slower?', 'It costs a props comparison on every render, and buys nothing when the props change each time.'],
      ['What do you do about a 10,000-row list?', 'Paginate, or virtualise so only visible rows are in the DOM.'],
      ['Where do you code split?', 'Route boundaries first, then heavy optional components like editors and charts.'],
      ['What does `useDeferredValue` actually do?', 'Makes the expensive update interruptible so input stays responsive — it does not make it faster.'],
      ['Why do index keys hurt performance?', 'Inserting or removing makes React treat every subsequent row as changed, re-rendering the whole list.'],
      ['A page is slow to first paint — where do you look?', 'The network: bundle size, images and fonts, before any React-level work.'],
    ]),

    links(
      reactDoc('reference/react/Profiler', 'Profiler'),
      link('TanStack Virtual', 'https://tanstack.com/virtual/latest'),
      link('web.dev — Core Web Vitals', 'https://web.dev/articles/vitals'),
    ),
  ],
};
