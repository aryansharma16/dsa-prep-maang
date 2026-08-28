import { cheat, code, h, jsx, links, note, p, reactDoc, sig, table, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Putting a `ref` on a DOM element gives you the node. Putting one on your own component does nothing by default — a component is a function, and there is no node to hand back. Getting a ref *through* a component to something inside it is what this page is about.',
    ),
    p(
      'React 19 changed the answer, so there are two versions to know.',
    ),

    h('React 19: ref is a prop'),
    p(
      '`ref` is now an ordinary prop on function components. Destructure it, forward it, done. `forwardRef` still works but is deprecated and will be removed.',
    ),
    code(
      jsx(`
function TextInput({ label, ref, ...rest }) {
  return (
    <label>
      {label}
      <input ref={ref} {...rest} />
    </label>
  );
}

// The parent gets the real <input>
function Form() {
  const inputRef = useRef(null);
  useEffect(() => inputRef.current.focus(), []);
  return <TextInput label="Email" ref={inputRef} />;
}
`),
    ),

    h('React 18: forwardRef'),
    p(
      'Before 19, `ref` was stripped out of props and delivered as a second argument, which `forwardRef` existed to expose.',
    ),
    code(
      jsx(`
const TextInput = forwardRef(function TextInput({ label, ...rest }, ref) {
  return (
    <label>
      {label}
      <input ref={ref} {...rest} />
    </label>
  );
});
`),
    ),
    note(
      'This app runs React 18.3.1, so `forwardRef` is what applies here today. The migration is mechanical: unwrap the call, move `ref` into the destructured props.',
    ),

    h('useImperativeHandle'),
    p(
      'Sometimes handing out the raw DOM node is too much. `useImperativeHandle` replaces what the ref points at with an object you define, so the parent gets exactly the methods you meant to expose and nothing else.',
    ),
    sig([
      ['`ref`', 'the ref', 'The ref passed in — as a prop in React 19, as the second argument under `forwardRef`.'],
      ['`createHandle`', '`() => object`', 'Returns the object the ref will point at.'],
      ['`dependencies`', '`array`', 'Optional. When they change, the handle is rebuilt.'],
    ]),
    code(
      jsx(`
function Modal({ children, ref }) {
  const dialogRef = useRef(null);

  useImperativeHandle(ref, () => ({
    open: () => dialogRef.current.showModal(),
    close: () => dialogRef.current.close(),
    // Deliberately no scrollTo, no style, no innerHTML — the parent cannot
    // reach past this surface and do something the modal did not intend.
  }), []);

  return <dialog ref={dialogRef}>{children}</dialog>;
}

function Page() {
  const modal = useRef(null);
  return (
    <>
      <button onClick={() => modal.current.open()}>Open</button>
      <Modal ref={modal}>...</Modal>
    </>
  );
}
`),
    ),
    warn(
      'This is an escape hatch, and it is easy to reach for too early. Anything expressible as a prop should be a prop: `<Modal isOpen={open} />` is declarative, testable, and cannot get out of step with React. An imperative handle is for actions with no state — `focus`, `scrollIntoView`, `play`, `select` — where a prop would mean inventing a fake state variable to toggle.',
    ),
    table(
      ['Want the parent to', 'Use'],
      [
        ['Control whether something is shown', 'A prop — `isOpen`'],
        ['Focus a field after an error', 'A ref to the DOM node, or an imperative handle'],
        ['Scroll a list to an item', 'An imperative handle'],
        ['Play or pause a video', 'An imperative handle'],
        ['Reset a form', 'A `key`, or a prop — rarely a handle'],
        ['Read a measurement', 'A ref, in an effect'],
      ],
    ),

    h('Ref callbacks'),
    p(
      'A `ref` can be a function instead of an object. React calls it with the node when it attaches and, historically, with `null` when it detaches. React 19 lets the callback return a cleanup function instead, which is cleaner.',
    ),
    code(
      jsx(`
// React 19 — return a cleanup
<div ref={(node) => {
  const observer = new ResizeObserver(onResize);
  observer.observe(node);
  return () => observer.disconnect();
}} />

// React 18 — the null call is the teardown
<div ref={(node) => {
  if (node) observerRef.current.observe(node);
  else observerRef.current.disconnect();
}} />
`),
    ),
    warn(
      'An inline ref callback is a new function every render, so React calls it with `null` and then with the node again on **every** render. Harmless for a plain assignment; expensive if it does real work. Wrap it in `useCallback`, or use an object ref.',
    ),
    p(
      'Ref callbacks are also the answer for a list of nodes, since you cannot call `useRef` in a loop — collect them into one ref holding a `Map`, keyed by item id.',
    ),

    h('Watch for'),
    ul(
      '`ref.current` is `null` during the first render. The node attaches during commit, so read it in an effect or a handler.',
      'A ref is not a dependency. The object identity never changes, and `.current` changing does not re-run anything.',
      'A component wrapped in `memo` still forwards refs normally.',
      'React 19 removed `element.ref` access on element objects, and `forwardRef` will follow. New code should use the prop form.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Ref through a component, React 19', 'Accept `ref` as a prop and pass it down'],
      ['Ref through a component, React 18', '`forwardRef`'],
      ['Expose only specific methods', '`useImperativeHandle`'],
      ['Anything that can be a prop', 'Make it a prop, not a handle'],
      ['Refs for a list', 'One ref holding a `Map`, filled by ref callbacks'],
      ['Set up an observer on a node', 'A ref callback — with cleanup in React 19'],
      ['Stop a ref callback firing every render', '`useCallback`, or an object ref'],
    ]),

    links(
      reactDoc('reference/react/useImperativeHandle', 'useImperativeHandle'),
      reactDoc('reference/react/forwardRef', 'forwardRef'),
      reactDoc('learn/manipulating-the-dom-with-refs', 'Manipulating the DOM with refs'),
    ),
  ],
};
