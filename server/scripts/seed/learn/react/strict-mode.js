import { cheat, code, h, js, jsx, links, note, p, reactDoc, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`<StrictMode>` is a development-only wrapper that turns latent bugs into visible ones. It renders nothing and does nothing in a production build — the component is a no-op there, and none of the behaviour below happens.',
    ),
    p(
      'It works by doing things twice. React is allowed to call your components more than once per update, to discard a render, and to mount, unmount and remount a component while keeping its state. Code that assumes otherwise is broken; StrictMode simply makes it break now rather than the first time a concurrent feature reorders something.',
    ),

    h('What it double-invokes'),
    table(
      ['Called twice in development', 'The bug it exposes'],
      [
        ['Your component function body', 'Rendering is not pure — it mutates something outside itself, pushes to an array, or increments a counter.'],
        ['State updater functions', 'An updater that is not pure — `setX((prev) => { prev.push(1); return prev; })`.'],
        ['`useState`, `useMemo`, `useReducer` initialisers', 'An initialiser doing work it should not, such as writing to storage.'],
        ['Ref callbacks', 'A ref callback that appends rather than replaces.'],
      ],
    ),

    h('The effect remount'),
    p(
      'This is the one that surprises everybody. On mount in development, StrictMode runs the effect, immediately runs its cleanup, then runs the effect again — simulating a component being unmounted and remounted with its state intact.',
    ),
    code(
      js(`
useEffect(() => {
  console.log('connect');
  return () => console.log('disconnect');
}, []);

// Development, inside StrictMode:  connect  disconnect  connect
// Production, or outside it:       connect
`),
    ),
    p(
      'Your effect is not being called twice by mistake. It is being told: prove that running you twice is the same as running you once. An effect that can survive that is an effect with a correct cleanup, and an effect with a correct cleanup is one that will not leak when the component really does unmount.',
    ),
    warn(
      'The fix is never to suppress the second run with a ref or a module-level flag. That hides the symptom and keeps the leak. Write the cleanup — abort the request, close the socket, clear the interval, unsubscribe the listener.',
    ),
    code(
      js(`
// Wrong — the guard makes the double-run go away and the leak stay
const started = useRef(false);
useEffect(() => {
  if (started.current) return;
  started.current = true;
  connect();
}, []);

// Right — the second run is harmless because the first one undid itself
useEffect(() => {
  const connection = connect();
  return () => connection.close();
}, []);
`),
    ),
    tip(
      'The common "my data fetches twice" complaint is the same thing. Abort the first request in the cleanup with an `AbortController`, or move the fetch to a data library that dedupes it. Both are things you wanted anyway.',
    ),

    h('Where to put it'),
    code(
      jsx(`
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`),
    ),
    p(
      'Usually the whole app, at the root. It can also wrap one subtree, which is the practical way to adopt it in a large codebase that is not clean yet — turn it on for the part you are working on and widen it as you go.',
    ),
    note(
      'React 19 also uses StrictMode to warn about deprecated APIs and, in development, to re-run refs and effects with a slightly wider net than 18 did. The principle is unchanged.',
    ),

    h('Should it stay on?'),
    ul(
      'Yes. It costs nothing in production, because it does nothing in production.',
      'The double render can make development-only profiling numbers look about twice as bad as reality — profile a production build when the number matters.',
      'If a third-party library breaks under it, that library is doing something React explicitly allows itself to do. Worth knowing before you ship it.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Understand a double log in dev', 'StrictMode. It does not happen in production.'],
      ['Stop an effect running twice', 'Write the cleanup, do not add a guard'],
      ['Stop a fetch running twice', '`AbortController` in the cleanup, or a caching data layer'],
      ['Measure real render cost', 'Profile a production build, without StrictMode'],
    ]),

    links(
      reactDoc('reference/react/StrictMode', 'StrictMode'),
      reactDoc('learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development', 'Handling the effect firing twice'),
    ),
  ],
};
