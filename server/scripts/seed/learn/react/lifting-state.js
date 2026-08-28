import { cheat, code, h, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'When two components need the same value, neither can own it. Move it to their nearest common parent and pass it down — that is lifting state up, and it is the answer to most "how do these two talk to each other" questions.',
    ),
    p(
      'The parent owns the value and the function that changes it. The children receive both: the value as a prop, and the setter as a callback. Data down, events up.',
    ),

    h('The move'),
    code(
      jsx(`
// Before — each panel owns its own text, and they cannot be compared
function Compare() {
  return (
    <>
      <Panel />
      <Panel />
    </>
  );
}

// After — the parent owns it
function Compare() {
  const [active, setActive] = useState('left');

  return (
    <>
      <Panel isActive={active === 'left'} onShow={() => setActive('left')} />
      <Panel isActive={active === 'right'} onShow={() => setActive('right')} />
    </>
  );
}

function Panel({ isActive, onShow, children }) {
  return isActive ? <div>{children}</div> : <button onClick={onShow}>Show</button>;
}
`),
    ),
    p(
      'Notice what `Panel` lost: it no longer has state at all. A component that takes everything it displays as props and reports everything that happens as callbacks is fully controlled by its parent, easy to test, and impossible to get out of sync with its sibling.',
    ),

    h('Where does this piece of state belong?'),
    p('Work down the list. The first one that fits is the answer.'),
    table(
      ['Question', 'If yes'],
      [
        ['Can it be computed from props or other state?', 'Do not store it. Compute it during render.'],
        ['Does it live outside React — the URL, the server, localStorage?', 'That is the source of truth. Read from it, do not copy it.'],
        ['Does only one component use it?', 'Local `useState` in that component.'],
        ['Do a few nearby components use it?', 'Lift to their nearest common parent.'],
        ['Does the whole app use it — session, theme, locale?', 'Context, or a store.'],
        ['Is it server data?', 'A data layer that caches and revalidates, not `useState` plus `useEffect`.'],
      ],
    ),
    warn(
      'Lift only as far as necessary. State parked at the root that only two leaves use makes every render of the app pass through the root, and turns a small change into a wide one.',
    ),

    h('Composition instead of prop drilling'),
    p(
      'Prop drilling is passing a prop through components that do not use it, only to hand it further down. Before reaching for context, check whether passing the JSX itself removes the middle layer entirely.',
    ),
    code(
      jsx(`
// Drilling — Layout does not care about user, it just carries it
<Layout user={user}>
  <Sidebar user={user} />
</Layout>

function Layout({ user, children }) {
  return <div className="shell"><Header user={user} />{children}</div>;
}

// Composition — Layout takes elements, and whoever built them already had
// the user. Nothing is threaded through.
<Layout header={<Header user={user} />}>
  <Sidebar user={user} />
</Layout>

function Layout({ header, children }) {
  return <div className="shell">{header}{children}</div>;
}
`),
    ),
    tip(
      'This is the cheapest fix for a prop that is two or three layers deep, and it costs nothing at runtime. Context is for values that genuinely have no single owner in the tree — the session, the theme, the router.',
    ),

    h('Controlled and uncontrolled components'),
    p(
      'The same distinction as form inputs, generalised. A component driven by props from its parent is controlled; one that keeps its own state is uncontrolled. Most reusable components end up supporting both.',
    ),
    code(
      jsx(`
// Uncontrolled unless the parent passes value + onChange
function Tabs({ tabs, value, defaultValue, onChange }) {
  const [inner, setInner] = useState(defaultValue ?? tabs[0].id);
  const controlled = value !== undefined;
  const active = controlled ? value : inner;

  const select = (id) => {
    if (!controlled) setInner(id);
    onChange?.(id);
  };
  // ...
}
`),
    ),
    note(
      'Decide once, at mount, whether an instance is controlled. Switching mid-life is the bug React warns about on inputs, and it is just as confusing on your own components.',
    ),

    h('Keeping the callback stable'),
    ul(
      'A handler defined inline is a new function every render. That is fine — until the child is wrapped in `memo`, or the function ends up in a dependency array.',
      'Prefer passing the setter itself (`onChange={setActive}`) when no extra work is needed. `useState` setters are guaranteed stable.',
      'Otherwise `useCallback`, and only when there is a measured reason.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Two siblings need the same value', 'Lift it to their parent'],
      ['A prop is threaded through a layer that ignores it', 'Pass JSX instead — composition'],
      ['A value the whole app needs', 'Context'],
      ['A value derived from another', 'Compute it, do not store it'],
      ['Make a component reusable', 'Take `value` + `onChange`, fall back to internal state'],
      ['Server data', 'A caching data layer, not state plus an effect'],
    ]),

    links(
      reactDoc('learn/sharing-state-between-components', 'Sharing state between components'),
      reactDoc('learn/passing-data-deeply-with-context', 'Passing data deeply with context'),
      reactDoc('learn/extracting-state-logic-into-a-reducer', 'Extracting state logic into a reducer'),
    ),
  ],
};
