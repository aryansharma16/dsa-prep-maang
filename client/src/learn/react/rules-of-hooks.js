import { cheat, code, h, js, jsx, links, note, p, reactDoc, table, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A hook is a function whose name starts with `use` and that lets a component tap into React features — state, effects, context. Two rules govern all of them, and both come from the same implementation detail.',
    ),
    ul(
      '**Only call hooks at the top level.** Not inside a condition, a loop, a nested function, a `try`/`catch`, or after an early return.',
      '**Only call hooks from React functions.** A component, or another hook. Not a plain utility, not a class, not an event handler.',
    ),

    h('Why: hooks are matched by call order'),
    p(
      'React does not know the names of your hooks. It keeps an ordered list per component instance and walks it as your function runs — first `useState` call gets slot 0, second gets slot 1, and so on. On the next render it walks the same list in the same order and hands each call the state it left there.',
    ),
    code(
      js(`
function Profile({ userId }) {
  const [name, setName] = useState('');   // slot 0
  const [age, setAge] = useState(0);      // slot 1
  useEffect(() => { ... }, [userId]);     // slot 2
}
`),
    ),
    p(
      'Nothing ties `name` to slot 0 except that it was the first call. Skip a hook on one render and every hook after it shifts up a slot, so `age` is handed the state that belonged to `name`.',
    ),
    code(
      js(`
// Render 1: query is truthy   -> slots are [results, filter, effect]
// Render 2: query is ''       -> slots are [filter, effect, ???]
function Search({ query }) {
  if (query) {
    const [results, setResults] = useState([]); // sometimes slot 0
  }
  const [filter, setFilter] = useState('all');  // slot 0 or slot 1
  useEffect(() => { ... });
}
`),
    ),
    warn(
      'React detects the count changing and throws "Rendered fewer hooks than expected", but it cannot detect a swap that keeps the count the same — two `useState` calls in different branches of the same `if`. That one silently hands you the wrong state.',
    ),

    h('The patterns that replace each broken form'),
    table(
      ['Instead of', 'Do this'],
      [
        ['A hook inside `if`', 'Call the hook unconditionally, put the condition inside it — `useEffect(() => { if (!on) return; ... })`'],
        ['A hook after an early return', 'Move every hook above the return'],
        ['A hook in a loop over `items`', 'Extract a child component and render one per item — each gets its own hooks'],
        ['A hook inside an event handler', 'Call it at the top level and use the value in the handler'],
        ['`useEffect` you want to skip', 'Keep the call, make the dependency array or an early return decide'],
      ],
    ),
    code(
      jsx(`
// Wrong — hooks below a conditional return
function Panel({ user }) {
  if (!user) return null;
  const [open, setOpen] = useState(false);
  return <div>{open ? user.name : null}</div>;
}

// Right — the hook runs on every render, the return moves down
function Panel({ user }) {
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return <div>{open ? user.name : null}</div>;
}
`),
    ),
    code(
      jsx(`
// Wrong — one hook per item
function List({ items }) {
  return items.map((item) => {
    const [open, setOpen] = useState(false); // in a loop
    return <Row key={item.id} open={open} />;
  });
}

// Right — one component per item, each with its own slot list
function List({ items }) {
  return items.map((item) => <Row key={item.id} item={item} />);
}
function Row({ item }) {
  const [open, setOpen] = useState(false);
  // ...
}
`),
    ),

    h('Custom hooks follow the same rules'),
    p(
      'A custom hook is a function that calls other hooks, so its calls occupy slots in whichever component called it. That is why the `use` prefix matters: it is how the lint rule knows to enforce the rules inside it, and how a reader knows the call is not free to move.',
    ),
    code(
      js(`
// This is a hook, and must obey the rules
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { ... }, []);
  return online;
}

// This is not a hook — no hook calls inside, so name it plainly
function formatBytes(n) { ... }
`),
    ),

    h('The one exception: use'),
    p(
      'React 19 adds `use`, which reads a promise or a context and *can* be called conditionally and inside loops. It is deliberately not named `useSomething` in the hook sense — it is an API with different rules. Everything else on this page still applies to every hook.',
    ),
    note(
      'Install `eslint-plugin-react-hooks` and leave `rules-of-hooks` as an error. It catches every case above statically, and there is no legitimate reason to disable it.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Conditionally run an effect', 'Unconditional `useEffect`, condition inside'],
      ['Conditionally use state', 'Unconditional `useState`, ignore the value when unused'],
      ['State per list item', 'A child component per item'],
      ['State only when a prop exists', 'Hooks first, early return after'],
      ['Share hook logic', 'A custom hook named `useSomething`'],
    ]),

    links(
      reactDoc('reference/rules/rules-of-hooks', 'Rules of hooks'),
      reactDoc('learn/reusing-logic-with-custom-hooks', 'Reusing logic with custom hooks'),
    ),
  ],
};
