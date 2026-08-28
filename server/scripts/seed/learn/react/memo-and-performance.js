import { cheat, code, h, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`memo` wraps a component so React skips re-rendering it when its props are unchanged. It is a shallow comparison — each prop against the previous one with `Object.is` — and if every prop passes, React reuses the last rendered output.',
    ),
    code(
      jsx(`
const Row = memo(function Row({ item, onSelect }) {
  return <li onClick={() => onSelect(item.id)}>{item.title}</li>;
});
`),
    ),

    h('Signature'),
    sig([
      ['`Component`', 'a component', 'The component to memoise. Returns a new component.'],
      [
        '`arePropsEqual`',
        '`(prev, next) => boolean`',
        'Optional custom comparison. Rarely correct — it is easy to forget a prop, and forgetting one means stale UI, not a slow one.',
      ],
    ]),

    h('Why your memo component still re-renders'),
    p('Almost always one of these four, in this order of likelihood:'),
    table(
      ['Cause', 'Fix'],
      [
        ['A prop is an object or array literal in the parent JSX', '`useMemo` it, or pass primitives'],
        ['A prop is an inline arrow function', '`useCallback`, or pass a stable setter'],
        ['`children` is passed', 'JSX creates a new element object every render — `memo` always fails. Memoise the child element with `useMemo`, or restructure'],
        ['It reads context that changed', '`memo` cannot stop this — context bypasses props entirely'],
      ],
    ),
    code(
      jsx(`
// All three props break the memo
<Row
  item={item}
  style={{ padding: 8 }}                  // new object
  onSelect={(id) => setSelected(id)}      // new function
/>

// All three are stable
const style = useMemo(() => ({ padding: 8 }), []);
const onSelect = useCallback((id) => setSelected(id), []);
<Row item={item} style={style} onSelect={onSelect} />
`),
    ),
    warn(
      '`memo` is all-or-nothing. One unstable prop out of ten and the comparison fails, so you have paid for the comparison and skipped nothing. A half-memoised component is strictly worse than none.',
    ),

    h('When memo is worth it'),
    ul(
      'The component renders **many** instances — a long list, a grid, a table.',
      'The component itself is genuinely expensive — a chart, a large tree, heavy formatting.',
      'The parent re-renders often for reasons unrelated to this child.',
      'Its props really do stay the same across most of those renders.',
    ),
    p(
      'All four together. If the props change every time the parent renders, `memo` adds a comparison and never skips.',
    ),

    h('The cheaper fixes to try first'),
    p(
      'Most React performance problems are structural. These cost nothing at runtime and often make `memo` unnecessary.',
    ),
    code(
      jsx(`
// 1. Move state down. If only the input needs it, the list stops re-rendering.
function Page() {
  return (
    <>
      <SearchBox />       {/* owns its own query state */}
      <HeavyList />       {/* never re-renders when you type */}
    </>
  );
}

// 2. Pass the subtree as children. Its element is created by the parent, so
// a re-render of Wrapper does not re-render it.
function Wrapper({ children }) {
  const [hover, setHover] = useState(false);
  return <div onMouseEnter={() => setHover(true)}>{children}</div>;
}
<Wrapper><HeavyList /></Wrapper>
`),
    ),
    tip(
      'Ask "why does this state live up here?" before reaching for `memo`. A state variable moved two levels down often removes the entire problem.',
    ),

    h('Measuring, honestly'),
    ul(
      'Profile a **production** build. Development renders twice under StrictMode and includes work that never ships, so the numbers are roughly twice as bad as reality.',
      'Use the React DevTools Profiler. Record an interaction, look at the flamegraph, and find the components that are wide *and* frequent.',
      'Turn on "Highlight updates when components render" to see what is re-rendering as you interact. It is usually more than you expected.',
      'Throttle the CPU in browser devtools. Your machine is not your users.',
      'React 19 devtools tells you *why* a component re-rendered — props, state, hooks or parent — which is faster than guessing.',
    ),
    warn(
      'A re-render is not automatically a problem. React re-rendering a component that returns the same output is cheap. It becomes a problem when it is wide, deep, or repeated many times a second — measure before optimising.',
    ),

    h('Bigger wins than memo'),
    table(
      ['Symptom', 'Fix'],
      [
        ['Thousands of rows on screen', 'Virtualise — render only the visible window'],
        ['A large route that is rarely visited', '`lazy` + `Suspense` code splitting'],
        ['Typing blocks a heavy list', '`useTransition` or `useDeferredValue`'],
        ['A slow calculation on every render', '`useMemo`'],
        ['Everything re-renders on one context change', 'Split the context'],
        ['A list flashes and loses state on reorder', 'Wrong keys — a correctness bug, not a perf one'],
        ['The whole app re-renders on every keystroke', 'State is too high. Move it down'],
      ],
    ),

    h('The React Compiler'),
    p(
      'The compiler shipping with the React 19 toolchain memoises components and values automatically, by analysing what actually depends on what. Where it is enabled, hand-written `memo`, `useMemo` and `useCallback` become largely unnecessary — and the manual versions it replaces were the ones most likely to have a wrong dependency array.',
    ),
    note(
      'It is opt-in and requires code that follows the rules of React. Until a project adopts it, memoise deliberately: measure, fix the structure first, and reach for `memo` when the four conditions above genuinely hold.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Skip a re-render with unchanged props', '`memo(Component)`'],
      ['Memo not working', 'Check for object, array, function or `children` props'],
      ['Memo not working, still', 'It reads context — `memo` cannot help'],
      ['Fix it without memo', 'Move state down, or pass the subtree as `children`'],
      ['A long list', 'Virtualise before you memoise'],
      ['Find the real cost', 'Profiler, production build, throttled CPU'],
    ]),

    links(
      reactDoc('reference/react/memo', 'memo'),
      reactDoc('learn/render-and-commit', 'Render and commit'),
      reactDoc('reference/react/useMemo', 'useMemo'),
    ),
  ],
};
