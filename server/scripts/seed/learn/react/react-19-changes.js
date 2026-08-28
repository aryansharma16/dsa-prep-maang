import { cheat, code, h, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    note(
      'React 19, released December 2024. This app runs React 18.3.1 — this page is the map of what an upgrade changes.',
    ),
    p(
      'Actions, `useActionState`, `useOptimistic` and `use` have their own topics. What follows is everything else: the ergonomic changes, the removals, and the parts that quietly delete code you have already written.',
    ),

    h('ref is a prop'),
    p(
      'Function components receive `ref` as an ordinary prop. `forwardRef` still works and is deprecated, with a codemod to remove it.',
    ),
    code(
      jsx(`
// React 19
function Input({ ref, ...rest }) {
  return <input ref={ref} {...rest} />;
}

// React 18
const Input = forwardRef((props, ref) => <input ref={ref} {...props} />);
`),
    ),

    h('Ref callbacks can return a cleanup'),
    code(
      jsx(`
<div ref={(node) => {
  const observer = new ResizeObserver(onResize);
  observer.observe(node);
  return () => observer.disconnect();   // React 19
}} />
`),
    ),
    warn(
      'A subtle consequence: because a returned function is now the cleanup, an arrow body that implicitly returns something is a breaking change. `ref={(node) => (map[id] = node)}` returns the node, which React 19 tries to call. Use a block body.',
    ),

    h('Context renders as its own provider'),
    code(
      jsx(`
// React 19
<ThemeContext value="dark">{children}</ThemeContext>

// React 18 — still works in 19, but .Provider will be deprecated
<ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
`),
    ),

    h('Document metadata hoists itself'),
    p(
      'Rendering `<title>`, `<meta>`, `<link>` or `<style>` anywhere in the tree moves them into `<head>` automatically. That removes the main reason to reach for a helmet library.',
    ),
    code(
      jsx(`
function TopicPage({ topic }) {
  return (
    <article>
      <title>{topic.title}</title>
      <meta name="description" content={topic.summary} />
      <h1>{topic.title}</h1>
    </article>
  );
}
`),
    ),
    ul(
      'Stylesheets support a `precedence` prop so React can order them deterministically.',
      'Scripts with `async` are deduplicated across the tree.',
      '`preload`, `preinit`, `prefetchDNS` and `preconnect` from `react-dom` let a component declare what to fetch early.',
    ),

    h('Better error reporting'),
    ul(
      'A caught error is logged once, not three times.',
      '`onUncaughtError` and `onCaughtError` options on `createRoot` and `hydrateRoot`.',
      'Hydration mismatches print a single readable diff instead of a wall of warnings.',
    ),

    h('Removed'),
    warn(
      'These are the ones that break a build. Every entry has a codemod in `react-codemod`.',
    ),
    table(
      ['Gone', 'Replacement'],
      [
        ['`ReactDOM.render`, `ReactDOM.hydrate`', '`createRoot`, `hydrateRoot`'],
        ['`ReactDOM.unmountComponentAtNode`', '`root.unmount()`'],
        ['`ReactDOM.findDOMNode`', 'A ref'],
        ['`defaultProps` on function components', 'Default values in the destructuring'],
        ['Legacy context — `contextTypes`, `getChildContext`', '`createContext`'],
        ['String refs — `ref="input"`', 'Callback or object refs'],
        ['`propTypes` on function components', 'TypeScript, or nothing'],
        ['`element.ref`', '`element.props.ref`'],
        ['`react-test-renderer`', 'React Testing Library'],
      ],
    ),

    h('Other behaviour changes'),
    ul(
      '`useDeferredValue` takes an `initialValue` for the first render.',
      'A custom element receives unknown props as attributes rather than being ignored — Web Components work properly now.',
      '`<Context>` and cleanup-returning refs are the two changes most likely to need a manual review after the codemods run.',
      'Server Components and Server Actions are stable, but require a framework — they are not available in a plain Vite SPA.',
    ),

    h('The React Compiler'),
    p(
      'Not part of React 19 itself, but shipping alongside it. It analyses components and inserts memoisation automatically, which makes most hand-written `memo`, `useMemo` and `useCallback` unnecessary — and removes the class of bug where a dependency array is wrong.',
    ),
    tip(
      'It requires code that follows the rules of React: pure renders, no mutation of props or state, hooks called unconditionally. Running its ESLint rule is a useful audit even if you never turn the compiler on.',
    ),

    h('Upgrading'),
    ul(
      '1. Go to 18.3 first. It is 18.2 plus warnings for everything 19 removes.',
      '2. Fix every warning. That is the bulk of the work.',
      '3. Run the codemods: `npx codemod@latest react/19/migration-recipe`.',
      '4. Upgrade `react`, `react-dom` and the types together.',
      '5. Review ref callbacks with implicit returns, and anything depending on `element.ref`.',
    ),
    note(
      'This app is on 18.3.1 already, which is step one done.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Forward a ref', 'Accept `ref` as a prop'],
      ['Clean up a ref callback', 'Return a function from it'],
      ['Provide a context', '`<Context value={...}>`'],
      ['Set the page title', 'Render `<title>` anywhere'],
      ['Default prop values', 'Destructuring defaults'],
      ['Report uncaught errors', '`onUncaughtError` on the root'],
      ['Skip manual memoisation', 'The React Compiler'],
    ]),

    links(
      reactDoc('blog/2024/12/05/react-19', 'React 19 release notes'),
      reactDoc('blog/2024/04/25/react-19-upgrade-guide', 'React 19 upgrade guide'),
      reactDoc('learn/react-compiler', 'React Compiler'),
    ),
  ],
};
