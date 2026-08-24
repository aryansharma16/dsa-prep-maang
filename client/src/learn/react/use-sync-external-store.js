import { cheat, code, h, js, jsx, links, note, p, reactDoc, sig, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useSyncExternalStore` subscribes a component to a data source that lives outside React — a store, a browser API, a module-level variable — and re-renders when it changes. It is the supported way to read mutable external state, and the reason it exists is **tearing**.',
    ),
    code(
      js(`
const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot?);
`),
    ),

    h('Signature'),
    sig([
      [
        '`subscribe`',
        '`(onChange) => cleanup`',
        'Registers a callback the store calls whenever it changes, and returns a function to unregister. Must be stable — a new function on every render re-subscribes every render.',
      ],
      [
        '`getSnapshot`',
        '`() => value`',
        'Reads the current value. Must return a **cached** value — an identical result for identical store state, compared with `Object.is`.',
      ],
      ['`getServerSnapshot`', '`() => value`', 'Optional. Used during server rendering and the initial hydration.'],
      ['returns', 'the value', 'The current snapshot.'],
    ]),

    h('What tearing is'),
    p(
      'React 18 can pause a render halfway, let the browser do something, and resume. If an external value changes during that pause, components rendered before the change show the old value and components rendered after show the new one — in the same committed frame. Two parts of one screen disagree. That is tearing.',
    ),
    p(
      'A plain `useState` + `useEffect` subscription cannot prevent it, because the effect only runs after the render is already committed. `useSyncExternalStore` can: React re-reads the snapshot at the end of the render and, if it changed, throws the render away and starts again.',
    ),
    warn(
      'This is why a hand-rolled `useState` + subscribe hook is not equivalent, even though it usually looks like it works. It works right up until a concurrent feature — a transition, a deferred value, Suspense — introduces the pause that lets the tear happen.',
    ),

    h('Browser APIs'),
    code(
      js(`
// Online status
const subscribe = (onChange) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,   // client snapshot
    () => true,               // server snapshot — assume online
  );
}
`),
    ),
    code(
      js(`
// A media query — subscribe must be stable, so it is built once per query
export function useMediaQuery(query) {
  const [subscribe, getSnapshot] = useMemo(() => {
    const list = window.matchMedia(query);
    return [
      (onChange) => {
        list.addEventListener('change', onChange);
        return () => list.removeEventListener('change', onChange);
      },
      () => list.matches,
    ];
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
`),
    ),
    tip(
      'Note the `useMemo`. `subscribe` being recreated on every render makes React unsubscribe and re-subscribe on every render — functional, wasteful, and easy to miss.',
    ),

    h('A small store'),
    code(
      jsx(`
// The store — plain JavaScript, no React
function createStore(initial) {
  let state = initial;
  const listeners = new Set();

  return {
    getState: () => state,
    setState(next) {
      state = typeof next === 'function' ? next(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const themeStore = createStore({ theme: 'dark' });

// The hook
export function useTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.getState);
}
`),
    ),
    p(
      'That is the whole mechanism every modern store library is built on. Zustand, Jotai, Redux and Valtio all bottom out in this hook.',
    ),

    h('The snapshot must be cached'),
    warn(
      'Returning a new object from `getSnapshot` on every call makes React think the store changed every time it checks, and it will re-render in an infinite loop — React throws "The result of getSnapshot should be cached to avoid an infinite loop".',
    ),
    code(
      js(`
// Wrong — a new array every call
() => store.items.filter((i) => i.done)

// Wrong — a new object every call
() => ({ user: store.user, theme: store.theme })

// Right — return the stored reference, and derive afterwards
const items = useSyncExternalStore(subscribe, () => store.items);
const done = useMemo(() => items.filter((i) => i.done), [items]);

// Right — return one primitive
const theme = useSyncExternalStore(subscribe, () => store.theme);
`),
    ),
    ul(
      'Return the reference the store holds, or a primitive. Never build something new inside `getSnapshot`.',
      'For a selector that must derive, cache the result in the store, or use `useSyncExternalStoreWithSelector` from `use-sync-external-store/shim/with-selector`.',
    ),

    h('When you need it'),
    ul(
      'Reading a browser API that changes over time — `navigator.onLine`, `matchMedia`, `window.location`, `document.visibilityState`, scroll position.',
      'Subscribing to a store outside React — your own, or a non-React library.',
      'Integrating a third-party event emitter that owns state.',
    ),
    p(
      'And when you do not: state that lives in React already. `useState`, `useReducer` and context are not external, and this hook adds nothing for them.',
    ),
    note(
      'This app has no use for it today — its state is all context and server data. It is worth recognising because it is the hook every state library you might add is implemented with.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Subscribe to a browser API', '`useSyncExternalStore(subscribe, getSnapshot)`'],
      ['Support server rendering', 'Pass the third argument'],
      ['Stop re-subscribing every render', 'Define `subscribe` outside, or `useMemo` it'],
      ['Infinite loop', '`getSnapshot` is returning a new object — return a stored reference'],
      ['Select part of a store', 'Cache in the store, or use the with-selector shim'],
      ['State that lives in React', 'Not this hook — `useState` or context'],
    ]),

    links(
      reactDoc('reference/react/useSyncExternalStore', 'useSyncExternalStore'),
      reactDoc('reference/react/useState', 'useState'),
    ),
  ],
};
