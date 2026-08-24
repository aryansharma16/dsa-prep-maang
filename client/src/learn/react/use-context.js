import { cheat, code, h, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Context lets a component read a value from an ancestor without it being passed down through every level in between. `createContext` makes the channel, a provider puts a value on it, and `useContext` reads the nearest one above.',
    ),
    p(
      'It solves prop drilling, and nothing else. Context is a transport, not a store — it does not hold state, it does not batch, it does not optimise. Whatever state you put in it still lives in a component above.',
    ),

    h('The three pieces'),
    code(
      jsx(`
// 1. Create the channel — outside any component
const ThemeContext = createContext('dark');

// 2. Provide a value to a subtree
function App() {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeContext.Provider value={theme}>
      <Page />
    </ThemeContext.Provider>
  );
}

// 3. Read it, at any depth
function Button() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Save</button>;
}
`),
    ),
    note(
      'React 19 lets you render `<ThemeContext>` directly as the provider — `.Provider` is optional and will eventually be deprecated. React 18, which this app runs, still needs `.Provider`.',
    ),

    h('Signature'),
    sig([
      ['`SomeContext`', 'the value from `createContext`', 'The context object itself, not the provider and not a string.'],
      [
        'returns',
        'the context value',
        'The `value` of the nearest matching provider above this component. If there is none, the `defaultValue` given to `createContext`.',
      ],
    ]),
    warn(
      'The default value is used **only** when there is no provider at all — not when a provider passes `undefined`. A component reading a context it was never wrapped in silently gets the default, which is why the pattern below throws instead.',
    ),

    h('The custom-hook wrapper'),
    p(
      'Exporting the raw context invites two problems: every consumer imports the context object, and forgetting the provider fails silently. A hook fixes both.',
    ),
    code(
      jsx(`
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({ user, setUser }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}
`),
    ),
    tip(
      'This is the shape every context in this codebase uses — `AuthContext.jsx`, `ChatContext.jsx`, `RoadmapContext.jsx` all export a provider and a `useX` hook, and nothing else.',
    ),

    h('Every consumer re-renders'),
    p(
      'When the provider `value` changes by `Object.is`, every component that calls `useContext` on it re-renders. There is no selector and no partial subscription — this is the one performance fact you have to design around.',
    ),
    code(
      jsx(`
// A brand new object every render of App, so every consumer re-renders
// whenever ANYTHING in App changes — not just when user changes
<AuthContext.Provider value={{ user, setUser }}>

// Stable while user is stable
const value = useMemo(() => ({ user, setUser }), [user]);
<AuthContext.Provider value={value}>
`),
    ),
    p(
      'Memoising the value is necessary but not sufficient: a consumer that only needs `setUser` still re-renders when `user` changes, because they travel in the same object. Splitting them into two contexts is the standard fix — see context patterns.',
    ),
    ul(
      '`memo` on a consumer does not help. Context bypasses the props comparison entirely.',
      'A consumer re-rendering because its *parent* re-rendered is a different problem, and `memo` does help with that one.',
    ),

    h('Nesting and overriding'),
    p(
      '`useContext` finds the nearest provider above, so nesting a second provider overrides the first for that subtree. This is how a section of a page gets a different theme.',
    ),
    code(
      jsx(`
<ThemeContext.Provider value="dark">
  <Page />                        {/* dark */}
  <ThemeContext.Provider value="light">
    <Preview />                   {/* light */}
  </ThemeContext.Provider>
</ThemeContext.Provider>
`),
    ),

    h('Is context a state manager?'),
    p('No. What it gives you and what it does not:'),
    table(
      ['', 'Context', 'A store (Redux, Zustand, Jotai)'],
      [
        ['Passes a value down without drilling', 'Yes', 'Yes'],
        ['Holds the state', 'No — a component above does', 'Yes'],
        ['Subscribes to part of the value', 'No', 'Yes, via selectors'],
        ['Re-renders only what changed', 'No', 'Yes'],
        ['Devtools, middleware, time travel', 'No', 'Usually'],
      ],
    ),
    p(
      'Context plus `useReducer` is a perfectly good store for app-shaped state that changes rarely — session, theme, feature flags. For state that changes many times a second and is read in a hundred places, the lack of selectors is what eventually pushes people to a library.',
    ),
    warn(
      'Before adding a context, check whether composition solves it. Passing JSX down through a `children` or a named slot prop removes the intermediate layers entirely, costs nothing at runtime, and keeps the data flow visible. See lifting state.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Read a context', '`useContext(SomeContext)`'],
      ['Provide one', '`<SomeContext.Provider value={...}>` (React 19: `<SomeContext value={...}>`)'],
      ['Stop the value changing every render', '`useMemo` on the provider value'],
      ['Catch a missing provider', 'Default of `null` plus a `useX` hook that throws'],
      ['Stop unrelated consumers re-rendering', 'Split into two contexts'],
      ['Override for one subtree', 'Nest another provider'],
      ['A prop only two levels deep', 'Do not use context — pass it, or compose'],
    ]),

    links(
      reactDoc('reference/react/useContext', 'useContext'),
      reactDoc('reference/react/createContext', 'createContext'),
      reactDoc('learn/passing-data-deeply-with-context', 'Passing data deeply with context'),
      reactDoc('learn/scaling-up-with-reducer-and-context', 'Scaling up with reducer and context'),
    ),
  ],
};
