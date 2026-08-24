import { cheat, code, h, js, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useEffect` lets a component **synchronise with a system outside React** — a subscription, a socket, a browser API, a third-party widget, an animation library. It runs after the render is committed to the DOM and the browser has painted.',
    ),
    p(
      'The official framing is worth taking literally. An effect is not "code that runs after render", and it is not a lifecycle hook. It is a description of a relationship you want kept true: *while these values are what they are, this external thing should be in this state*. React runs it, and re-runs it, to keep that relationship true.',
    ),
    code(
      js(`
useEffect(setup, dependencies?);
`),
    ),

    h('Signature'),
    sig([
      [
        '`setup`',
        '`() => (void | cleanup)`',
        'Runs after commit. May return a cleanup function, which React calls before the next run and once on unmount.',
      ],
      [
        '`dependencies`',
        '`array` or omitted',
        'Values from the component the setup reads. React compares each with `Object.is` and re-runs only when one changed. Omit entirely to run after every render.',
      ],
      ['returns', '`undefined`', 'Nothing. An effect is not something you read a value from.'],
    ]),

    h('The three dependency forms'),
    table(
      ['Written as', 'Runs'],
      [
        ['`useEffect(fn)`', 'After every render, without exception. Almost always a mistake.'],
        ['`useEffect(fn, [])`', 'Once after mount, cleanup once on unmount.'],
        ['`useEffect(fn, [a, b])`', 'After mount, and after any render where `a` or `b` changed.'],
      ],
    ),
    warn(
      'The array is not a list of "when to run this". It is a list of *what the effect reads*. Getting that backwards — trimming a dependency to stop an effect firing — is the root of most effect bugs.',
    ),

    h('Exactly when it runs'),
    p('For one update, in order:'),
    ul(
      '1. React calls your component. **Nothing from the effect happens here.**',
      '2. React commits the changes to the DOM.',
      '3. Layout effects (`useLayoutEffect`) run, synchronously, and the browser is blocked until they finish.',
      '4. **The browser paints.** The user sees the new frame.',
      '5. The previous run of this effect has its cleanup called — if the dependencies changed.',
      '6. The new setup runs.',
    ),
    p(
      'Step 5 before step 6 is the part people miss. On a dependency change React does not run the new setup and leave the old one running; it tears the old one down first, so at no point are two subscriptions live.',
    ),
    code(
      js(`
function Chat({ roomId }) {
  useEffect(() => {
    const conn = connect(roomId);
    conn.open();
    return () => conn.close();
  }, [roomId]);
}

// Mount with roomId="general"
//   open("general")
// roomId changes to "random"
//   close("general")     <- cleanup of the previous run, with its own roomId
//   open("random")
// Unmount
//   close("random")
`),
    ),
    tip(
      'Each cleanup closes over the values from *its own* render. The cleanup above disconnects from `"general"` because that is what `roomId` was when that setup ran — not what it is now. That is a feature, and it is what makes the teardown correct.',
    ),

    h('Cleanup is not optional'),
    p(
      'Ask of every effect: if this ran twice in a row, would the second run be harmless? If not, the cleanup is missing. StrictMode asks exactly this question in development by mounting, unmounting and remounting your component on purpose.',
    ),
    code(
      js(`
// Subscription
useEffect(() => {
  const onResize = () => setWidth(window.innerWidth);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, []);

// Timer
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);

// Fetch — abort, so a slow response for an old id cannot overwrite a new one
useEffect(() => {
  const controller = new AbortController();
  fetch(\`/api/users/\${userId}\`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((err) => {
      if (err.name !== 'AbortError') setError(err);
    });
  return () => controller.abort();
}, [userId]);

// Third-party widget
useEffect(() => {
  const map = new MapWidget(nodeRef.current);
  return () => map.destroy();
}, []);
`),
    ),
    warn(
      'Without the abort, switching from user 1 to user 2 leaves two requests in flight, and whichever resolves last wins. That is a race condition that shows the wrong user on a slow connection, and it is the single most common bug in hand-written data fetching.',
    ),
    p(
      'The `live` flag is the lighter alternative when there is nothing to cancel — it does not stop the work, it stops the result being used:',
    ),
    code(
      js(`
useEffect(() => {
  let live = true;
  loadThing(id).then((data) => {
    if (live) setThing(data);
  });
  return () => {
    live = false;
  };
}, [id]);
`),
    ),
    note(
      'This is the pattern used throughout this codebase — `useGuide.js` and `ChatContext.jsx` both do it, for exactly this reason.',
    ),

    h('The dependency array, honestly'),
    p(
      'Every reactive value the setup reads goes in: props, state, context, and anything derived from them during render. Values that cannot change are exempt — `useState` and `useReducer` setters, refs themselves, and anything declared outside the component.',
    ),
    code(
      js(`
function Search({ query, pageSize }) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    search(query, page, pageSize).then(setResults);
    // reads query, page, pageSize -> all three are dependencies
  }, [query, page, pageSize]);
}
`),
    ),
    p(
      'When the linter asks for a dependency you do not want to react to, that is a signal about the effect, not about the linter. There are three real fixes, and suppressing the rule is not one of them.',
    ),
    table(
      ['The problem', 'The fix'],
      [
        [
          'The value is only *read*, never reacted to',
          'Move it out of the effect: use a ref, or the updater form of a setter, so the effect stops reading it at all.',
        ],
        [
          'The dependency is an object or function created during render',
          'Move it inside the effect, or outside the component, or memoise it — see below.',
        ],
        [
          'It is not really synchronisation, it is a response to an event',
          'It does not belong in an effect. Move it to the event handler.',
        ],
      ],
    ),
    code(
      js(`
// The effect only needs to ADD to count, not react to it
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000); // needs count
  return () => clearInterval(id);
}, [count]); // so the interval is torn down and rebuilt every second

// Updater form — the effect no longer reads count at all
useEffect(() => {
  const id = setInterval(() => setCount((prev) => prev + 1), 1000);
  return () => clearInterval(id);
}, []);
`),
    ),

    h('The infinite loop'),
    p(
      'Objects, arrays and functions created during render are a new value every render, and `Object.is` on two structurally identical objects is `false`. An effect that sets state and depends on such a value re-runs forever.',
    ),
    code(
      js(`
// options is a new object every render -> effect runs -> setState -> render
// -> new object -> effect runs -> ...
function Panel({ userId }) {
  const options = { userId, include: 'profile' };
  useEffect(() => {
    load(options).then(setData);
  }, [options]);
}

// Fix 1 — build it inside the effect, and depend on the primitives
useEffect(() => {
  load({ userId, include: 'profile' }).then(setData);
}, [userId]);

// Fix 2 — if it must be shared, memoise it
const options = useMemo(() => ({ userId, include: 'profile' }), [userId]);
`),
    ),
    tip(
      'Primitives compare by value, so `[userId, page]` is always safer than `[options]`. Prefer depending on the pieces rather than on the container.',
    ),

    h('When you should not use an effect'),
    p(
      'This is the part of the API most often misused. An effect is for synchronising with something *outside React*. If nothing outside React is involved, there is usually a better tool.',
    ),
    table(
      ['Instead of an effect that...', 'Do this'],
      [
        ['Computes a value from props or state and stores it in state', 'Calculate it during render. `const visible = items.filter(...)`'],
        ['Recomputes something expensive on every render', '`useMemo`, not an effect plus state'],
        ['Resets state when a prop changes', 'A `key` on the component'],
        ['POSTs when a button was clicked', 'Do it in the click handler — the click, not the render, is the cause'],
        ['Notifies a parent after state changes', 'Call the parent callback in the same handler that set the state'],
        ['Chains: effect sets A, another effect reacts to A and sets B', 'Compute both in the one handler'],
        ['Fetches data for the page', 'A data library, a router loader, or a framework that caches it'],
      ],
    ),
    code(
      js(`
// Unnecessary: two renders, and fullName is briefly stale
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(first + ' ' + last);
}, [first, last]);

// Just compute it
const fullName = first + ' ' + last;
`),
    ),
    warn(
      'A useful test: "what external system is this keeping in sync?" If the answer is "none, I just want this to happen after something changed", the code almost certainly belongs in the event handler that caused the change.',
    ),

    h('Effects and the ref escape hatch'),
    p(
      'When an effect needs the *latest* value of something without re-running when it changes — a callback prop, an option object — keep it in a ref that a separate effect updates.',
    ),
    code(
      js(`
function useInterval(callback, delay) {
  const saved = useRef(callback);

  // Keep the ref current, without disturbing the interval below.
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay == null) return undefined;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
`),
    ),
    note(
      'React has a planned API for this — `useEffectEvent` — which is still experimental. Until it lands, the ref pattern above is the accepted version of it.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Run once on mount', '`useEffect(fn, [])` — and write the cleanup anyway'],
      ['Re-run when something changes', 'Put it in the array'],
      ['Undo what setup did', 'Return a cleanup function'],
      ['Cancel a request', '`AbortController`, aborted in the cleanup'],
      ['Ignore a stale response', 'A `live` flag set false in the cleanup'],
      ['Stop an infinite loop', 'Depend on primitives, not on objects built during render'],
      ['Use a value without reacting to it', 'A ref updated by its own effect'],
      ['Derive a value from state', 'Do not use an effect — compute it during render'],
      ['Do something because of a click', 'Do not use an effect — do it in the handler'],
      ['Run before paint', '`useLayoutEffect`'],
    ]),

    links(
      reactDoc('reference/react/useEffect', 'useEffect'),
      reactDoc('learn/synchronizing-with-effects', 'Synchronizing with effects'),
      reactDoc('learn/you-might-not-need-an-effect', 'You might not need an effect'),
      reactDoc('learn/lifecycle-of-reactive-effects', 'Lifecycle of reactive effects'),
      reactDoc('learn/removing-effect-dependencies', 'Removing effect dependencies'),
    ),
  ],
};
