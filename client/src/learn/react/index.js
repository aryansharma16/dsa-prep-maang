/**
 * The React track's table of contents.
 *
 * Metadata only — no prose. Every topic's body sits in its own module behind
 * `load`, so this file stays small enough to ship with the track page: the topic
 * list, the search box that filters it, and prev/next all need the titles and
 * nothing else. Opening a topic is what pulls the words down.
 *
 * Section order is reading order. `flatTopics` in ../tracks.js walks it, so
 * moving a topic here moves it everywhere.
 *
 * `ask` is what the Ask-AI buttons offer on that topic. Three at most: they are
 * a nudge past the blank composer, not a FAQ. Written as the question someone
 * stuck on this page would actually type.
 */

export const title = 'React';

export const summary =
  'The mental model first, then every API. Each topic is a definition, why it exists, the smallest example that shows it, and what goes wrong.';

export const sections = [
  {
    key: 'foundations',
    title: 'Foundations',
    blurb: 'What React is doing between your state update and the pixels.',
    topics: [
      {
        slug: 'how-react-works',
        title: 'How React works',
        summary: 'Render, reconcile, commit — and where the virtual DOM actually fits.',
        tags: ['core', 'rendering', 'virtual dom'],
        ask: [
          'What is the difference between the render phase and the commit phase in React?',
          'Is the virtual DOM actually faster than touching the DOM directly?',
        ],
        load: () => import('./how-react-works.js'),
      },
      {
        slug: 'jsx',
        title: 'JSX',
        summary: 'Syntax sugar over function calls, and the rules that fall out of that.',
        tags: ['core', 'syntax'],
        ask: [
          'What does JSX compile to in React 19?',
          'Why do I need a key on elements inside .map()?',
        ],
        load: () => import('./jsx.js'),
      },
      {
        slug: 'reactdom-and-roots',
        title: 'ReactDOM and roots',
        summary: 'createRoot, render, hydrateRoot, flushSync — the boundary between React and the page.',
        tags: ['core', 'react-dom', 'ssr'],
        ask: [
          'What is the difference between createRoot and hydrateRoot?',
          'When would I ever need flushSync?',
        ],
        load: () => import('./reactdom-and-roots.js'),
      },
      {
        slug: 'strict-mode',
        title: 'StrictMode',
        summary: 'Why your component renders twice in development, on purpose.',
        tags: ['core', 'debugging'],
        ask: [
          'Why does my useEffect run twice in development but not in production?',
          'Should I keep StrictMode on in a real app?',
        ],
        load: () => import('./strict-mode.js'),
      },
    ],
  },
  {
    key: 'components',
    title: 'Components and state',
    blurb: 'The data flowing down, and the state that makes it change.',
    topics: [
      {
        slug: 'components-and-props',
        title: 'Components and props',
        summary: 'Functions that take props and return UI, and what "read-only" really means.',
        tags: ['core', 'props'],
        ask: [
          'Why are props read-only in React?',
          'What is the children prop and when should I use it?',
        ],
        load: () => import('./components-and-props.js'),
      },
      {
        slug: 'state',
        title: 'State',
        summary: 'Snapshots, batching, the updater form, and why you never mutate.',
        tags: ['core', 'state'],
        ask: [
          'Why does my state look stale right after I call setState?',
          'When do I need the updater function form of setState?',
        ],
        load: () => import('./state.js'),
      },
      {
        slug: 'lists-and-keys',
        title: 'Lists and keys',
        summary: 'What a key is for, and the damage an index does.',
        tags: ['core', 'lists', 'keys'],
        ask: [
          'Why is using the array index as a key a bug?',
          'How does React use keys during reconciliation?',
        ],
        load: () => import('./lists-and-keys.js'),
      },
      {
        slug: 'conditional-rendering',
        title: 'Conditional rendering',
        summary: 'Branching in JSX, and the falsy values that leak onto the page.',
        tags: ['core', 'rendering'],
        ask: [
          'Why does a 0 show up on my page when I use && to render conditionally?',
          'Does React unmount a component when I render it conditionally?',
        ],
        load: () => import('./conditional-rendering.js'),
      },
      {
        slug: 'forms',
        title: 'Forms and controlled inputs',
        summary: 'Controlled vs uncontrolled, and which one you actually want.',
        tags: ['core', 'forms'],
        ask: [
          'What is the difference between a controlled and an uncontrolled input?',
          'Why does React warn about switching an input from uncontrolled to controlled?',
        ],
        load: () => import('./forms.js'),
      },
      {
        slug: 'lifting-state',
        title: 'Lifting state and composition',
        summary: 'Where state belongs, and passing JSX instead of props.',
        tags: ['core', 'patterns'],
        ask: [
          'How do I decide which component should own a piece of state?',
          'What is composition as an alternative to prop drilling?',
        ],
        load: () => import('./lifting-state.js'),
      },
    ],
  },
  {
    key: 'hooks',
    title: 'Hooks',
    blurb: 'Every built-in hook: what it returns, when it runs, what it costs.',
    topics: [
      {
        slug: 'rules-of-hooks',
        title: 'Rules of hooks',
        summary: 'Top level, same order, every render — and the reason behind it.',
        tags: ['hook', 'rules'],
        ask: [
          'Why can I not call a hook inside an if statement?',
          'How does React know which useState call is which?',
        ],
        load: () => import('./rules-of-hooks.js'),
      },
      {
        slug: 'use-state',
        title: 'useState',
        summary: 'A value that survives re-renders, and a function that schedules one.',
        tags: ['hook', 'state'],
        ask: [
          'What is a lazy initialiser in useState and when do I need one?',
          'Why does calling setState twice with the same value only render once?',
        ],
        load: () => import('./use-state.js'),
      },
      {
        slug: 'use-effect',
        title: 'useEffect',
        summary: 'Synchronise with something outside React — and clean up after yourself.',
        tags: ['hook', 'effects', 'lifecycle'],
        ask: [
          'Walk me through exactly when useEffect runs and when its cleanup runs.',
          'Why does my effect loop forever when I put an object in the dependency array?',
          'When should I NOT use useEffect?',
        ],
        load: () => import('./use-effect.js'),
      },
      {
        slug: 'use-layout-effect',
        title: 'useLayoutEffect',
        summary: 'The effect that runs before the browser paints, and its price.',
        tags: ['hook', 'effects', 'layout'],
        ask: [
          'When do I need useLayoutEffect instead of useEffect?',
          'Why does useLayoutEffect warn during server rendering?',
        ],
        load: () => import('./use-layout-effect.js'),
      },
      {
        slug: 'use-ref',
        title: 'useRef',
        summary: 'A mutable box that does not trigger a re-render.',
        tags: ['hook', 'refs', 'dom'],
        ask: [
          'What is the difference between useRef and useState?',
          'Why is my ref null on the first render?',
        ],
        load: () => import('./use-ref.js'),
      },
      {
        slug: 'use-context',
        title: 'useContext',
        summary: 'Read a value from the nearest provider above you.',
        tags: ['hook', 'context'],
        ask: [
          'Why does every consumer re-render when my context value changes?',
          'Is context a state management library?',
        ],
        load: () => import('./use-context.js'),
      },
      {
        slug: 'use-reducer',
        title: 'useReducer',
        summary: 'State transitions as data, for when useState stops scaling.',
        tags: ['hook', 'state'],
        ask: [
          'When should I switch from useState to useReducer?',
          'Show me useReducer with a real example beyond a counter.',
        ],
        load: () => import('./use-reducer.js'),
      },
      {
        slug: 'use-memo',
        title: 'useMemo',
        summary: 'Cache a computed value between renders — when it is actually worth it.',
        tags: ['hook', 'performance'],
        ask: [
          'How do I know whether a useMemo is actually helping?',
          'Does useMemo guarantee the value is cached?',
        ],
        load: () => import('./use-memo.js'),
      },
      {
        slug: 'use-callback',
        title: 'useCallback',
        summary: 'useMemo for functions, and why a stable identity matters.',
        tags: ['hook', 'performance'],
        ask: [
          'What is the difference between useMemo and useCallback?',
          'Do I need useCallback if the child is not wrapped in memo?',
        ],
        load: () => import('./use-callback.js'),
      },
      {
        slug: 'use-transition',
        title: 'useTransition',
        summary: 'Mark an update as interruptible so typing stays smooth.',
        tags: ['hook', 'concurrency', 'performance'],
        ask: [
          'What does it mean for React to interrupt a render?',
          'When do I use useTransition instead of debouncing?',
        ],
        load: () => import('./use-transition.js'),
      },
      {
        slug: 'use-deferred-value',
        title: 'useDeferredValue',
        summary: 'Let one value lag behind so the rest of the UI keeps up.',
        tags: ['hook', 'concurrency', 'performance'],
        ask: [
          'What is the difference between useDeferredValue and useTransition?',
          'Is useDeferredValue the same as debouncing?',
        ],
        load: () => import('./use-deferred-value.js'),
      },
      {
        slug: 'use-id',
        title: 'useId',
        summary: 'A unique id that matches between server and client.',
        tags: ['hook', 'accessibility', 'ssr'],
        ask: [
          'Why can I not use Math.random() for form field ids in React?',
          'Can I use useId for keys in a list?',
        ],
        load: () => import('./use-id.js'),
      },
      {
        slug: 'use-sync-external-store',
        title: 'useSyncExternalStore',
        summary: 'Subscribe to something outside React without tearing.',
        tags: ['hook', 'advanced', 'state'],
        ask: [
          'What is tearing in React and how does useSyncExternalStore prevent it?',
          'Show me useSyncExternalStore subscribing to window size or matchMedia.',
        ],
        load: () => import('./use-sync-external-store.js'),
      },
      {
        slug: 'custom-hooks',
        title: 'Custom hooks',
        summary: 'Sharing logic, not state — and what "use" actually buys you.',
        tags: ['hook', 'patterns'],
        ask: [
          'Do two components calling the same custom hook share state?',
          'When should I extract a custom hook?',
        ],
        load: () => import('./custom-hooks.js'),
      },
    ],
  },
  {
    key: 'advanced',
    title: 'Advanced',
    blurb: 'The APIs you reach for once the basics are not the problem any more.',
    topics: [
      {
        slug: 'context-patterns',
        title: 'Context patterns',
        summary: 'Splitting providers, memoising the value, and when not to bother.',
        tags: ['context', 'patterns', 'performance'],
        ask: [
          'How do I stop a context update from re-rendering the whole tree?',
          'Should I split state and dispatch into two contexts?',
        ],
        load: () => import('./context-patterns.js'),
      },
      {
        slug: 'memo-and-performance',
        title: 'memo and performance',
        summary: 'What memo compares, when it pays, and how to find the real cost.',
        tags: ['performance', 'memo'],
        ask: [
          'Why is my memo component still re-rendering?',
          'How do I profile a slow React page?',
        ],
        load: () => import('./memo-and-performance.js'),
      },
      {
        slug: 'error-boundaries',
        title: 'Error boundaries',
        summary: 'Catching a render crash before it blanks the page.',
        tags: ['errors', 'advanced'],
        ask: [
          'Why do error boundaries have to be class components?',
          'What errors do error boundaries NOT catch?',
        ],
        load: () => import('./error-boundaries.js'),
      },
      {
        slug: 'portals',
        title: 'Portals',
        summary: 'Render somewhere else in the DOM, stay where you are in the tree.',
        tags: ['react-dom', 'advanced'],
        ask: [
          'Do events bubble through a React portal?',
          'When do I need a portal for a modal instead of just CSS?',
        ],
        load: () => import('./portals.js'),
      },
      {
        slug: 'lazy-and-suspense',
        title: 'lazy and Suspense',
        summary: 'Code splitting, and a boundary that shows a fallback while you wait.',
        tags: ['suspense', 'performance', 'advanced'],
        ask: [
          'How does Suspense know when to show the fallback?',
          'Why does my lazy component flash the fallback on every navigation?',
        ],
        load: () => import('./lazy-and-suspense.js'),
      },
      {
        slug: 'refs-and-imperative-handle',
        title: 'Refs to components',
        summary: 'forwardRef, useImperativeHandle, and ref-as-a-prop in React 19.',
        tags: ['refs', 'advanced'],
        ask: [
          'Do I still need forwardRef in React 19?',
          'When is useImperativeHandle the right call?',
        ],
        load: () => import('./refs-and-imperative-handle.js'),
      },
    ],
  },
  {
    key: 'react19',
    title: 'React 19',
    blurb: 'What changed, and what it replaced. This app runs React 18, so read these as "what is next".',
    topics: [
      {
        slug: 'react-19-actions',
        title: 'Actions and form hooks',
        summary: 'useActionState and useFormStatus — pending, error and result, handled for you.',
        tags: ['react-19', 'forms'],
        ask: [
          'What problem do React 19 Actions solve that useState did not?',
          'Show me useActionState replacing a manual loading/error form.',
        ],
        load: () => import('./react-19-actions.js'),
      },
      {
        slug: 'use-optimistic',
        title: 'useOptimistic',
        summary: 'Show the result before the server confirms it, and roll back if it fails.',
        tags: ['react-19', 'ux'],
        ask: [
          'How does useOptimistic roll back a failed update?',
          'Can I use useOptimistic outside a form action?',
        ],
        load: () => import('./use-optimistic.js'),
      },
      {
        slug: 'use-api',
        title: 'The use API',
        summary: 'Read a promise or a context during render — and it is not a hook.',
        tags: ['react-19', 'suspense'],
        ask: [
          'Why can use() be called conditionally when hooks cannot?',
          'Can I create the promise inside the component I call use() in?',
        ],
        load: () => import('./use-api.js'),
      },
      {
        slug: 'react-19-changes',
        title: 'Other React 19 changes',
        summary: 'ref as a prop, <Context> as a provider, ref cleanup, document metadata.',
        tags: ['react-19', 'migration'],
        ask: [
          'What is the full list of breaking changes in React 19?',
          'Is forwardRef deprecated in React 19?',
        ],
        load: () => import('./react-19-changes.js'),
      },
    ],
  },
  {
    key: 'pitfalls',
    title: 'Pitfalls',
    blurb: 'The bugs that are not bugs — the ones that come from the model, not the code.',
    topics: [
      {
        slug: 'common-pitfalls',
        title: 'Common pitfalls',
        summary: 'Stale closures, derived state, effect abuse, unstable deps.',
        tags: ['debugging', 'patterns'],
        ask: [
          'What is a stale closure in React and how do I spot one?',
          'Why is copying props into state an anti-pattern?',
        ],
        load: () => import('./common-pitfalls.js'),
      },
    ],
  },
];
