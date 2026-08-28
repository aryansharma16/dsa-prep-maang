import { cheat, code, h, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'An error boundary is a component that catches a JavaScript error thrown while rendering anywhere in its subtree, logs it, and renders a fallback UI instead of the tree that crashed.',
    ),
    p(
      'Without one, an uncaught render error unmounts the **entire** React tree — the whole page goes blank. That behaviour is deliberate: React decided that a corrupted UI is worse than no UI, on the grounds that a broken banking app showing the wrong balance is more dangerous than one showing nothing.',
    ),

    h('There is no hook for this'),
    p(
      'Error boundaries must be class components, because the two lifecycle methods involved — `static getDerivedStateFromError` and `componentDidCatch` — have no hook equivalent. This is the only remaining reason to write a class in modern React.',
    ),
    code(
      jsx(`
class ErrorBoundary extends React.Component {
  state = { error: null };

  // Runs during render. Returns the new state — so this decides what to show.
  static getDerivedStateFromError(error) {
    return { error };
  }

  // Runs after commit. This is where side effects go — reporting, logging.
  componentDidCatch(error, info) {
    reportToService(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? <p className="alert">Something went wrong.</p>;
    }
    return this.props.children;
  }
}
`),
    ),
    tip(
      'Most projects use `react-error-boundary` rather than writing this, because it adds the parts the bare version lacks: a reset function, an `onError` callback, and a `resetKeys` prop that clears the error when a value changes.',
    ),

    h('What it does not catch'),
    warn(
      'An error boundary catches errors thrown **during rendering, in lifecycle methods, and in constructors of the tree below it**. Everything else escapes.',
    ),
    table(
      ['Not caught', 'Why, and what to do'],
      [
        ['Event handlers', 'They run outside the render pass. Use `try`/`catch` in the handler.'],
        ['`setTimeout`, `requestAnimationFrame` callbacks', 'Same — outside React entirely. `try`/`catch`.'],
        ['Async code and rejected promises', 'The throw happens after the render finished. Catch it and put the error in state, then throw during render if you want the boundary to take over.'],
        ['Errors in the boundary itself', 'They propagate to the boundary above it.'],
        ['Server-rendering errors', 'Handled by the server renderer, not by this.'],
      ],
    ),
    code(
      jsx(`
// An async failure, routed into the boundary on purpose
function Panel() {
  const [error, setError] = useState(null);
  if (error) throw error;   // now it is a render error, so it is caught

  useEffect(() => {
    load().catch(setError);
  }, []);
  // ...
}
`),
    ),

    h('Where to put them'),
    p(
      'Granularity is the whole design decision. One boundary at the root means any error blanks the app; one around every component means a page of error messages. Put them where a failure has a natural containment.',
    ),
    ul(
      '**At the root** — the last resort. A full-page "something went wrong" with a reload button.',
      '**Per route** — a broken page does not take the navigation with it.',
      '**Around independent widgets** — a chart, an embedded map, a third-party component. The rest of the page survives.',
      '**Around anything rendering untrusted or unusual data** — a markdown renderer, a chart fed by an API.',
    ),
    code(
      jsx(`
<ErrorBoundary fallback={<AppCrashed />}>
  <AppShell>
    <ErrorBoundary fallback={<PageCrashed />} resetKeys={[pathname]}>
      <Outlet />
    </ErrorBoundary>
  </AppShell>
</ErrorBoundary>
`),
    ),
    p(
      'The `resetKeys={[pathname]}` is what makes the page-level boundary recoverable: navigating elsewhere clears the error, so the user is not stuck on the fallback forever.',
    ),

    h('Recovering'),
    p(
      'A boundary that only shows a message is half a feature. Give the user a way out, and remember that re-rendering the same broken tree will just throw again.',
    ),
    code(
      jsx(`
function Fallback({ error, resetErrorBoundary }) {
  return (
    <div className="empty">
      <h3>That did not load</h3>
      <p>{error.message}</p>
      <button className="btn" onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
`),
    ),
    ul(
      'Reset only makes sense if the cause might be gone — a failed request, a transient state.',
      'If the cause is the data itself, reset just throws again. Navigate away, or clear the offending state first.',
      'Show `error.message` in development. In production, show something human and log the real one.',
    ),

    h('React 19'),
    p(
      'React 19 adds root-level error handlers, so uncaught errors can be reported without a boundary at the very top, and it stops the duplicate console logging that React 18 produced for every caught error.',
    ),
    code(
      jsx(`
createRoot(node, {
  onUncaughtError: (error, info) => report(error, info.componentStack),
  onCaughtError: (error, info) => report(error, info.componentStack),
}).render(<App />);
`),
    ),
    note(
      'React 19 also changed hydration mismatches from a wall of warnings into a single readable diff — a related quality-of-life fix in the same area.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Stop one crash blanking the app', 'An error boundary per route'],
      ['Catch an event handler error', '`try`/`catch` — boundaries do not see it'],
      ['Catch an async error', 'Put it in state and `throw` it during render'],
      ['Let the user recover', '`resetErrorBoundary`, plus `resetKeys`'],
      ['Report every error', '`componentDidCatch`, or React 19 root handlers'],
      ['Avoid writing the class', '`react-error-boundary`'],
    ]),

    links(
      reactDoc('reference/react/Component#catching-rendering-errors-with-an-error-boundary', 'Catching rendering errors'),
      reactDoc('reference/react-dom/client/createRoot#show-a-dialog-for-uncaught-errors', 'Root error handlers'),
    ),
  ],
};
