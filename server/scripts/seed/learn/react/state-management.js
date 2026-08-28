import { asked, cheat, code, h, jsx, js, link, links, note, p, reactDoc, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'React gives you `useState`, `useReducer` and context. The ecosystem gives you Redux Toolkit, Zustand and a dozen others. The interview question is never "which library" — it is **"what kind of state is this?"**, because most state people reach for a library to manage should not be client state at all.',
    ),

    h('Four kinds of state'),
    table(
      ['Kind', 'Example', 'Belongs in'],
      [
        ['**Local**', 'Is this dropdown open, what is in this input', '`useState`, in the component'],
        ['**Shared UI**', 'Theme, the current user, a toast queue', 'Context, or a small store'],
        ['**Server**', 'Tasks, users, anything from an API', '**A data-fetching library** — not a store'],
        ['**URL**', 'Filters, page number, the open tab', '**The URL** — search params'],
      ],
    ),
    warn(
      'Most "we need Redux" moments are really rows 3 and 4 in disguise. A store full of `tasks`, `tasksLoading` and `tasksError` is a cache you now have to invalidate by hand — that is the `data-fetching` topic. Filters kept in a store instead of the URL means the page is not linkable, refreshable or shareable.',
    ),
    tip(
      'Put state in the URL whenever a user might reasonably reload the page and expect it back. `?status=open&page=2` costs nothing to implement, survives refresh, and works with the back button — three things a store gives you only if you write them.',
    ),

    h('Start with lifting and composition'),
    p('Before any library, two React techniques remove most of the pressure that leads to one.'),
    code(
      jsx(`
// Lifting: move state to the nearest common parent, pass it down.
function TaskList() {
  const [selectedId, setSelectedId] = useState(null);
  return (
    <>
      <Rows onSelect={setSelectedId} />
      <Details id={selectedId} />
    </>
  );
}

// Composition: pass JSX as children so the middle layer never sees the prop.
// This kills most "prop drilling" without any context at all.
<Layout sidebar={<Filters value={filters} onChange={setFilters} />}>
  <Results filters={filters} />
</Layout>
`),
    ),

    h('Context, and its one real problem'),
    code(
      jsx(`
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');

  // Without useMemo, a NEW object every render -> every consumer re-renders.
  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
`),
    ),
    warn(
      'Context is not a state manager — it is **dependency injection**. It has no selectors, so every consumer re-renders whenever any part of the value changes. A single `AppContext` holding user, theme, cart and notifications re-renders the entire tree when a toast appears.',
    ),
    code(
      jsx(`
// The fix without a library: split by change frequency.
<AuthProvider>        {/* changes on login */}
  <ThemeProvider>     {/* changes rarely */}
    <CartProvider>    {/* changes constantly */}
      <App />
`),
    ),
    p(
      'Once you are splitting providers to control re-renders, you are hand-rolling what a store gives you for free. That is the point at which a library earns its place.',
    ),

    h('Zustand'),
    code(
      js(`
// store/cart.js — no provider, no boilerplate
import { create } from 'zustand';

export const useCart = create((set, get) => ({
  items: [],
  add: (item) => set((s) => ({ items: [...s.items, item] })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
  get total() { return get().items.reduce((n, i) => n + i.price, 0); },
}));
`),
    ),
    code(
      jsx(`
function CartBadge() {
  // A SELECTOR: this component re-renders only when the length changes.
  const count = useCart((s) => s.items.length);
  return <span>{count}</span>;
}

function AddButton({ item }) {
  // Selecting only the action means this never re-renders at all.
  const add = useCart((s) => s.add);
  return <button onClick={() => add(item)}>Add</button>;
}
`),
    ),
    warn(
      'Selecting a new object each render defeats the whole mechanism: `useCart((s) => ({ a: s.a, b: s.b }))` returns a fresh object every time, so the equality check always fails and the component always re-renders. Select primitives, or use `useShallow`.',
    ),

    h('Redux Toolkit'),
    p(
      'Modern Redux is `createSlice` — actions and reducers generated together, with Immer underneath so you write mutations and get immutable updates. It is far less code than the Redux people remember from 2018.',
    ),
    code(
      js(`
// features/filters/filtersSlice.js
import { createSlice } from '@reduxjs/toolkit';

const filtersSlice = createSlice({
  name: 'filters',
  initialState: { status: 'all', tags: [] },
  reducers: {
    statusChanged(state, action) {
      state.status = action.payload;        // "mutation" — Immer makes it immutable
    },
    tagToggled(state, action) {
      const tag = action.payload;
      const i = state.tags.indexOf(tag);
      if (i === -1) state.tags.push(tag);
      else state.tags.splice(i, 1);
    },
  },
});

export const { statusChanged, tagToggled } = filtersSlice.actions;
export default filtersSlice.reducer;
`),
    ),
    code(
      js(`
// app/store.js
import { configureStore } from '@reduxjs/toolkit';

export const store = configureStore({
  reducer: { filters: filtersReducer, auth: authReducer },
});
// Thunk middleware, devtools and immutability checks are on by default.
`),
    ),
    code(
      jsx(`
function StatusFilter() {
  const status = useSelector((s) => s.filters.status);
  const dispatch = useDispatch();
  return (
    <select value={status} onChange={(e) => dispatch(statusChanged(e.target.value))}>
      …
    </select>
  );
}
`),
    ),
    note(
      'The reason to still choose Redux is the **devtools**: a time-travelling log of every action and the state before and after it. On a large app with complex flows that is a genuine debugging advantage nothing else matches.',
    ),

    h('Choosing'),
    table(
      ['Reach for', 'When'],
      [
        ['`useState`', 'One component owns it. **The default.**'],
        ['`useReducer`', 'Several fields change together by well-named transitions'],
        ['Context', 'Rarely-changing shared values — user, theme, locale'],
        ['**Zustand / Jotai**', 'Real shared client state with selectors, minimal ceremony'],
        ['**Redux Toolkit**', 'A large app, many contributors, complex flows worth time-travelling'],
        ['**TanStack Query**', 'Anything that came from a server. See the next topic'],
        ['**The URL**', 'Anything a user would expect to survive a refresh'],
      ],
    ),
    tip(
      'The answer interviewers want is the reasoning, not the brand. "Server state goes in a query cache, UI state stays local, shared UI state in a small store, and filters in the URL" demonstrates more than naming a library — and it is what stops an app accumulating four copies of the same data.',
    ),

    h('The mistakes'),
    code(
      jsx(`
// 1. Server data in a store — a cache you must invalidate by hand.
const tasks = useSelector((s) => s.tasks.items);   // now: refetch? stale? dedupe?

// 2. Derived state stored instead of computed.
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);             // can disagree with items
const count = items.length;                        // cannot

// 3. One global context for everything — the whole tree re-renders.

// 4. Filters in a store instead of the URL — no back button, no sharing.
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['One component owns it', '`useState`'],
      ['Complex transitions', '`useReducer`'],
      ['Avoid prop drilling', 'Composition first, then context'],
      ['Shared client state with selectors', 'Zustand'],
      ['Large app, many people, devtools', 'Redux Toolkit'],
      ['Data from an API', 'TanStack Query — not a store'],
      ['Filters, page, tabs', 'URL search params'],
      ['Stop context re-renders', 'Split providers and memoise the value'],
      ['Never store', 'Anything you can compute from what you already have'],
    ]),

    h('Interview'),
    asked([
      ['When do you need a state management library?', 'When shared client state changes often enough that context re-renders hurt — server data and URL state do not count.'],
      ['Why is context not a state manager?', 'It has no selectors, so every consumer re-renders when any part of the value changes.'],
      ['Redux vs Zustand?', 'Zustand for less ceremony and built-in selectors; Redux Toolkit for large teams and time-travel devtools.'],
      ['Where does server data belong?', 'A query cache like TanStack Query — putting it in a store means hand-writing caching, dedupe and invalidation.'],
      ['What state belongs in the URL?', 'Anything a user would expect to survive a refresh or share — filters, pagination, the open tab.'],
      ['Why does Redux Toolkit let you mutate state?', 'Immer records the mutations on a draft and produces a new immutable state from them.'],
    ]),

    links(
      reactDoc('learn/scaling-up-with-reducer-and-context', 'Scaling up with reducer and context'),
      link('Redux Toolkit', 'https://redux-toolkit.js.org'),
      link('Zustand', 'https://zustand.docs.pmnd.rs'),
    ),
  ],
};
