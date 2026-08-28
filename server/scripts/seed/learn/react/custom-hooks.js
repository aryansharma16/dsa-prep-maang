import { cheat, code, h, js, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A custom hook is a function whose name starts with `use` and that calls other hooks. There is no special API — it is an ordinary function, and the only thing that makes it a hook is the naming convention and the rules that come with it.',
    ),
    p(
      'What it shares is **logic**, not state. Two components calling the same custom hook get completely separate state, because the hooks inside it occupy slots in whichever component is rendering. This is the single most misunderstood thing about them.',
    ),
    code(
      js(`
function Sidebar() {
  const [open, setOpen] = useLocalState('sidebar-open', true);  // its own state
}
function Panel() {
  const [open, setOpen] = useLocalState('panel-open', false);   // separate state
}
`),
    ),
    warn(
      'To share the *value* between components you need context or a store. A custom hook called in two places is two independent copies, no matter what is inside it.',
    ),

    h('Writing one'),
    p(
      'Extract when the same sequence of hooks appears twice, or when a component is doing two unrelated jobs and one of them has a name.',
    ),
    code(
      js(`
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

// Used anywhere
function StatusBar() {
  const online = useOnlineStatus();
  return <span>{online ? 'Online' : 'Offline'}</span>;
}
`),
    ),

    h('What to return'),
    table(
      ['Shape', 'When'],
      [
        ['A single value', 'The hook answers one question — `useOnlineStatus()`'],
        ['A tuple `[value, setValue]`', 'Two things, and the caller will want to rename them — mirrors `useState`'],
        ['An object', 'Three or more things, or the set may grow — `{ data, loading, error }`'],
      ],
    ),
    tip(
      'Tuples for two, objects for three or more. An object also lets a caller destructure only what it needs, which reads better once there are five fields.',
    ),

    h('The rules still apply inside'),
    ul(
      'Hooks in a custom hook must be at the top level of that hook — the call order rule is transitive.',
      'A custom hook must be called unconditionally by its caller, for the same reason.',
      'Name it `useSomething`. That is how the lint rule knows to check it, and how a reader knows it cannot be moved into an `if`.',
      'A function with no hook calls inside is not a hook. Do not prefix it — `formatBytes`, not `useFormatBytes`.',
    ),

    h('Stabilise what you return'),
    warn(
      'Everything a hook returns is rebuilt on every render unless you say otherwise. That is invisible in the component you wrote it for, and it matters the moment a caller puts the value in a dependency array or passes it to a `memo` child — and you cannot see those call sites from inside the hook.',
    ),
    code(
      js(`
export function useSavedFilters(scope) {
  const [filters, setFilters] = useState(null);

  // Stable, so a caller can safely depend on it
  const save = useCallback((next) => {
    setFilters(next);
    viewsApi.save(scope, next);
  }, [scope]);

  // Stable object, so { filters, save } is not new every render
  return useMemo(() => ({ filters, save }), [filters, save]);
}
`),
    ),
    p(
      'This is the one place where memoising by default is defensible: a hook is a public interface, and you are not the one who decides how carefully its result is used.',
    ),

    h('Composing hooks'),
    code(
      js(`
// Small, single-purpose hooks compose into larger ones
function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export function useSearch(initial = '') {
  const [query, setQuery] = useState(initial);
  const debounced = useDebounced(query, 250);
  const { data, loading } = useFetch(\`/api/search?q=\${debounced}\`);
  return { query, setQuery, results: data, loading, stale: query !== debounced };
}
`),
    ),

    h('When not to extract'),
    ul(
      'It is used once and will stay used once. A named function inside the component is often clearer than a file in a hooks folder.',
      'It is a pure calculation with no hooks in it — that is a plain function, and it does not need to be inside React at all.',
      'The extraction takes seven parameters to work in both call sites. The two cases were not really the same.',
      'It wraps `useEffect` so thinly that the caller still has to understand the effect. That hides the dependencies without simplifying anything.',
    ),
    note(
      'This codebase has three: `useLocalState` (JSON-serialising state persisted to localStorage), `useGuide` (a module-scope cache around one fetch) and `useLearnDoc` (the same shape around a dynamic import). Each hides a real mechanism, not a single hook call.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Same hook sequence in two components', 'Extract a custom hook'],
      ['Share a value, not just logic', 'Context or a store — a hook will not do it'],
      ['Return two things', 'A tuple, like `useState`'],
      ['Return three or more', 'An object'],
      ['Caller may memoise', '`useCallback` the functions, `useMemo` the object'],
      ['No hooks inside', 'A plain function, no `use` prefix'],
      ['Reuse across components', 'Hooks share logic; components share UI'],
    ]),

    links(
      reactDoc('learn/reusing-logic-with-custom-hooks', 'Reusing logic with custom hooks'),
      reactDoc('reference/rules/rules-of-hooks', 'Rules of hooks'),
    ),
  ],
};
