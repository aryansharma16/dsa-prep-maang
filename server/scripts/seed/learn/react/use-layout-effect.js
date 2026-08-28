import { cheat, code, h, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useLayoutEffect` is `useEffect` that runs **before the browser paints**. React commits the DOM changes, runs your layout effect synchronously, and only then lets the browser draw the frame.',
    ),
    p(
      'That one difference is the entire API. Same signature, same cleanup semantics, same dependency rules — the only thing that changes is where it sits relative to paint, and therefore whether the user can see the state before your code ran.',
    ),

    h('Signature'),
    sig([
      ['`setup`', '`() => (void | cleanup)`', 'Runs synchronously after commit, before paint. Blocks the browser until it returns.'],
      ['`dependencies`', '`array` or omitted', 'Identical to `useEffect`.'],
    ]),

    h('Where each one sits'),
    table(
      ['Step', 'useLayoutEffect', 'useEffect'],
      [
        ['React commits the DOM', 'done', 'done'],
        ['Your code runs', '**here** — synchronously, paint is blocked', 'not yet'],
        ['Browser paints', 'after your code', '**before** your code'],
        ['Your code runs', '—', '**here**, asynchronously'],
      ],
    ),
    p(
      'So a layout effect that measures a node and sets state causes React to re-render and re-commit *within the same frame*. The user never sees the intermediate state. The same code in `useEffect` paints once with the wrong layout and once with the right one — a visible flicker.',
    ),

    h('When you need it'),
    ul(
      'Measuring a DOM node and immediately positioning something from that measurement — a tooltip, a popover, a dropdown that must flip when it would overflow.',
      'Reading scroll position and restoring it before the user sees the wrong one.',
      'Synchronously mutating the DOM in a way that must be true on the first painted frame.',
    ),
    code(
      jsx(`
function Tooltip({ anchorRef, children }) {
  const tipRef = useRef(null);
  const [top, setTop] = useState(0);

  // Measured and repositioned before the browser paints, so the tooltip is
  // never seen at 0,0 on the way to its real place.
  useLayoutEffect(() => {
    const anchor = anchorRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const fitsAbove = anchor.top > tip.height;
    setTop(fitsAbove ? anchor.top - tip.height : anchor.bottom);
  }, [anchorRef]);

  return <div ref={tipRef} style={{ top }}>{children}</div>;
}
`),
    ),
    tip(
      'The test is simple: would the wrong value be visible for one frame? If yes, layout effect. If not, `useEffect`.',
    ),

    h('The cost'),
    warn(
      'A layout effect blocks painting. Everything it does — including the extra render and commit it triggers by setting state — happens while the screen is frozen. A slow one, or one that runs on every render, is a dropped frame.',
    ),
    ul(
      'Never fetch in a layout effect. The paint waits for nothing useful.',
      'Keep the dependency array tight. A layout effect with no array runs before every paint.',
      'Do the measuring, set the value, and stop. Anything that does not have to be pre-paint should be in a separate `useEffect`.',
    ),

    h('It does not run on the server'),
    p(
      'There is no layout on the server, so React skips layout effects during server rendering and warns that the markup may not match. The usual answers:',
    ),
    ul(
      'Move the work to `useEffect` if a one-frame flash is acceptable.',
      'Render the pre-measured state on the server and let the layout effect correct it after hydration.',
      'In a library, alias it: `const useIsomorphicLayoutEffect = typeof window !== \'undefined\' ? useLayoutEffect : useEffect`.',
    ),
    note(
      'This app renders entirely on the client, so the warning cannot occur here. It matters the moment the same component is used under Next.js or Remix.',
    ),

    h('The alternatives worth checking first'),
    table(
      ['Trying to', 'Better tool'],
      [
        ['React to an element resizing', '`ResizeObserver` in a `useEffect`'],
        ['React to an element entering the viewport', '`IntersectionObserver` in a `useEffect`'],
        ['Position a popover', 'CSS anchor positioning, or a positioning library'],
        ['Run something once with the DOM node available', 'A ref callback — it runs during commit too'],
        ['Animate on mount', 'CSS transitions or the Web Animations API'],
      ],
    ),
    code(
      jsx(`
// A ref callback is called with the node during commit, before paint, and is
// often all a layout effect was being used for.
<div ref={(node) => {
  if (!node) return;
  node.scrollTop = node.scrollHeight;
}} />
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Measure, then position, with no flicker', '`useLayoutEffect`'],
      ['Restore scroll before paint', '`useLayoutEffect`'],
      ['Subscribe, fetch, log, set a timer', '`useEffect`'],
      ['Silence the SSR warning', 'Move it to `useEffect`, or alias per environment'],
      ['Touch the DOM node right after mount', 'A ref callback is often enough'],
    ]),

    links(
      reactDoc('reference/react/useLayoutEffect', 'useLayoutEffect'),
      reactDoc('reference/react/useEffect', 'useEffect'),
    ),
  ],
};
