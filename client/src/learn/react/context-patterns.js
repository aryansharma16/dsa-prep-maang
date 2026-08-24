import { cheat, code, h, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Context has one performance characteristic that shapes every pattern on this page: **when the provider value changes, every consumer re-renders**. There is no selector, no partial subscription, and `memo` on a consumer does not help.',
    ),
    p(
      'Everything below is a way of making that acceptable — by changing the value less often, or by splitting it so fewer components care.',
    ),

    h('Memoise the value — always'),
    code(
      jsx(`
// A new object every render of the provider, so every consumer in the app
// re-renders whenever anything in AuthProvider changes
<AuthContext.Provider value={{ user, login, logout }}>

// Stable while its parts are stable
const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
<AuthContext.Provider value={value}>
`),
    ),
    warn(
      'The memo is only as stable as its dependencies. If `login` is an inline arrow, it is new every render and the `useMemo` never hits — wrap the functions in `useCallback` too, or the memo is decoration.',
    ),

    h('Split state from dispatch'),
    p(
      'The most effective single change. Components that only *cause* changes do not need to re-render when the state changes — and `dispatch` and `useState` setters never change identity, so their provider never invalidates.',
    ),
    code(
      jsx(`
const TasksContext = createContext(null);
const TasksDispatchContext = createContext(null);

export function TasksProvider({ children }) {
  const [tasks, dispatch] = useReducer(reducer, []);

  return (
    <TasksContext.Provider value={tasks}>
      {/* dispatch is stable, so this provider never causes a re-render */}
      <TasksDispatchContext.Provider value={dispatch}>
        {children}
      </TasksDispatchContext.Provider>
    </TasksContext.Provider>
  );
}

export const useTasks = () => useContext(TasksContext);
export const useTasksDispatch = () => useContext(TasksDispatchContext);
`),
    ),
    p(
      'An "Add task" button now calls `useTasksDispatch()` only, and never re-renders when the list changes. With one combined context it would re-render on every keystroke in every task.',
    ),

    h('Split by rate of change'),
    p(
      'Generalise the same idea: values that change at wildly different rates should not share a context. The theme changes twice a day; a live timer changes every second. Together, every theme consumer re-renders every second.',
    ),
    table(
      ['Change rate', 'Examples', 'Put it in'],
      [
        ['Almost never', 'Theme, locale, feature flags, the session user', 'Its own context — cheap, and consumers can be many'],
        ['Occasionally', 'Route, open modal, selected item', 'Its own context'],
        ['Constantly', 'A timer, a drag position, form keystrokes', 'Local state, or a store with selectors — not context'],
      ],
    ),
    note(
      'This app splits along exactly these lines: `AuthContext`, `AppearanceContext`, `ToastContext`, `RoadmapContext`, `ChatContext` and `TasksContext` are six providers rather than one, and each changes on its own schedule.',
    ),

    h('Keep the provider high and the children out of it'),
    p(
      'A provider whose own state changes re-renders its children as children, not just as consumers. Taking `children` as a prop fixes that: the element tree was created by the parent, so it is the same object and React skips re-rendering it.',
    ),
    code(
      jsx(`
// The children element is created once by App and passed in. When
// ThemeProvider re-renders, {children} is the same element, so React does
// not re-render that subtree — only the actual consumers.
function App() {
  return (
    <ThemeProvider>
      <Layout />
    </ThemeProvider>
  );
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
`),
    ),
    tip(
      'This works for any component with heavy children and frequently changing state, not just providers. Passing a subtree as `children` is the cheapest memoisation there is.',
    ),

    h('Export a hook, never the context'),
    code(
      jsx(`
const AuthContext = createContext(null);   // not exported

export function useAuth() {
  const value = useContext(AuthContext);
  // A default of null plus this check turns "forgot the provider" from a
  // silent wrong value into an immediate, named error.
  if (value === null) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
`),
    ),
    ul(
      'Consumers import one thing, and the shape of the context stays yours to change.',
      'It gives you somewhere to put derived values, a selector, or a deprecation warning later.',
      'It is the pattern every context in this codebase follows.',
    ),

    h('Mount the provider where it should die'),
    p(
      'A provider unmounts with its subtree, taking its state with it. That is a security property, not just tidiness.',
    ),
    code(
      jsx(`
// ChatProvider sits inside the signed-in branch. When user goes null this
// whole tree unmounts and the conversation goes with it, so one account's
// messages cannot survive a sign-out on a shared machine.
if (!user) return <Routes>{/* login */}</Routes>;

return (
  <RoadmapProvider>
    <ChatProvider>
      <Routes>...</Routes>
    </ChatProvider>
  </RoadmapProvider>
);
`),
    ),

    h('When context is the wrong tool'),
    ul(
      '**Two or three levels of drilling.** Pass the prop, or pass JSX — composition removes the middle layer at no runtime cost. See lifting state.',
      '**High-frequency state.** No selectors means every consumer wakes on every change. Reach for a store built on `useSyncExternalStore`.',
      '**Server data.** Caching, deduping and revalidation are a data layer job. Context is a transport, not a cache.',
      '**One consumer.** If only one component reads it, it is that component state.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Stop the value changing every render', '`useMemo` it, and `useCallback` its functions'],
      ['Stop dispatch-only components re-rendering', 'Two contexts: state and dispatch'],
      ['Stop slow values dragging fast ones', 'Split by rate of change'],
      ['Stop the provider re-rendering its subtree', 'Take `children` as a prop'],
      ['Catch a missing provider', 'Default `null` + a `useX` that throws'],
      ['Scope state to a session', 'Mount the provider inside the branch that unmounts'],
      ['Subscribe to part of a value', 'Not context — a store with selectors'],
    ]),

    links(
      reactDoc('learn/scaling-up-with-reducer-and-context', 'Scaling up with reducer and context'),
      reactDoc('reference/react/useContext', 'useContext'),
      reactDoc('reference/react/memo', 'memo'),
    ),
  ],
};
