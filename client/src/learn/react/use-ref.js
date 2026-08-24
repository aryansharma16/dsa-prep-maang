import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useRef` returns a mutable box that survives re-renders: an object of the shape `{ current: value }`. React gives you the same object on every render, and changing `.current` does **not** trigger a render.',
    ),
    p(
      'Two uses fall out of that: holding a value that should persist but not be displayed, and holding a DOM node.',
    ),
    code(
      js(`
const ref = useRef(initialValue);
ref.current; // read or write freely
`),
    ),

    h('Signature'),
    sig([
      ['`initialValue`', 'any', 'The value of `.current` on the first render. Ignored afterwards, and — unlike `useState` — there is no lazy form.'],
      ['returns', '`{ current }`', 'The same object for the life of the component. Mutable, and invisible to React.'],
    ]),

    h('Ref versus state'),
    table(
      ['', '`useRef`', '`useState`'],
      [
        ['Changing it re-renders', 'No', 'Yes'],
        ['Readable during render', 'You may, but should not', 'Yes, that is the point'],
        ['Value between renders', 'The same object, mutated in place', 'A fresh snapshot each render'],
        ['Update style', '`ref.current = x`, immediately', '`setX(x)`, applied on the next render'],
        ['Use for', 'Timer ids, DOM nodes, previous values, "has this run" flags', 'Anything the UI displays'],
      ],
    ),
    p(
      'The rule of thumb: if changing it should change what is on screen, it is state. If it is bookkeeping, it is a ref.',
    ),

    h('Holding a DOM node'),
    code(
      jsx(`
function SearchBox() {
  const inputRef = useRef(null);

  useEffect(() => {
    // The node exists by now — the effect runs after commit.
    inputRef.current.focus();
  }, []);

  return <input ref={inputRef} />;
}
`),
    ),
    warn(
      '`inputRef.current` is `null` during the first render. React attaches the node while committing, which is after your function returned — so any code that touches it must be in an effect, an event handler, or a ref callback. Reading it during render is always `null` the first time.',
    ),
    ul(
      'A ref set on a DOM element is attached before layout effects and detached on unmount.',
      'On a component, `ref` needs `forwardRef` in React 18 — in React 19 it is an ordinary prop. See refs to components.',
      'A list of nodes is easiest with a ref holding a `Map` keyed by id, filled from ref callbacks.',
    ),
    code(
      jsx(`
function List({ items }) {
  const nodes = useRef(new Map());

  return items.map((item) => (
    <li
      key={item.id}
      ref={(node) => {
        if (node) nodes.current.set(item.id, node);
        else nodes.current.delete(item.id);
        // React 19: returning a function makes it the cleanup instead
      }}
    >
      {item.title}
    </li>
  ));
}
`),
    ),

    h('Holding a value'),
    code(
      js(`
// A timer id — changing it must not re-render
const timer = useRef(null);
const start = () => {
  timer.current = setTimeout(fire, 500);
};
const cancel = () => clearTimeout(timer.current);

// The previous value of a prop
function usePrevious(value) {
  const ref = useRef(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// The latest callback, without making an effect depend on it
const latest = useRef(onSave);
useEffect(() => {
  latest.current = onSave;
}, [onSave]);
`),
    ),
    note(
      'This codebase uses the pattern in `ChatContext.jsx`: `conversationRef` shadows the conversation id so `send` reads the current value rather than the one its closure captured, which is what stops two quick messages creating two threads.',
    ),

    h('The rules'),
    ul(
      '**Do not read or write `.current` during render.** Rendering must be pure, and a value React cannot see changing makes the output unpredictable across the render passes React is allowed to do. Effects and handlers only.',
      '**A ref is not a dependency.** The ref object never changes identity, so listing it in a dependency array does nothing — and reading `.current` inside an effect will not re-run it when the value changes.',
      '**Do not use one to avoid a re-render you actually need.** If the screen should update, it is state.',
    ),
    code(
      js(`
// Wrong — the UI will not update, and the write during render is impure
function Counter() {
  const count = useRef(0);
  count.current += 1;
  return <p>{count.current}</p>;
}
`),
    ),
    tip(
      'The one sanctioned read during render is lazy initialisation of an expensive object, guarded so it happens once: `if (ref.current === null) ref.current = new Thing()`. React documents this as acceptable because the result is the same on every pass.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Focus, scroll or measure a node', '`useRef` + `ref={...}`, used in an effect'],
      ['Keep a timer or subscription id', '`useRef`'],
      ['Remember the previous value', '`useRef` written in an effect'],
      ['Read the latest prop inside a stable callback', 'A ref updated by its own effect'],
      ['Store a value that should show on screen', 'Not a ref — `useState`'],
      ['Collect refs for a list', 'One ref holding a `Map`, filled by ref callbacks'],
      ['Expose methods from a child', '`useImperativeHandle`'],
    ]),

    links(
      reactDoc('reference/react/useRef', 'useRef'),
      reactDoc('learn/referencing-values-with-refs', 'Referencing values with refs'),
      reactDoc('learn/manipulating-the-dom-with-refs', 'Manipulating the DOM with refs'),
    ),
  ],
};
