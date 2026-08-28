import { cheat, code, h, js, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`useMemo` caches the result of a calculation between renders. You give it a function and a dependency array; React calls the function on the first render and re-uses the stored result until one of the dependencies changes.',
    ),
    code(
      js(`
const value = useMemo(() => compute(a, b), [a, b]);
`),
    ),

    h('Signature'),
    sig([
      ['`calculateValue`', '`() => T`', 'Called during render. Must be pure and take no arguments — read what it needs from the closure.'],
      ['`dependencies`', '`array`', 'Every reactive value the calculation reads. Compared with `Object.is`.'],
      ['returns', '`T`', 'The cached value, or a fresh one if a dependency changed.'],
    ]),

    h('The two reasons to use it'),
    p('They are different, and the second is far more common in practice than people expect.'),
    ul(
      '**Skipping an expensive calculation.** Sorting ten thousand rows on every keystroke, parsing a large blob, running a heavy filter.',
      '**Keeping a reference stable.** An object or array that is passed to a `memo` child, or used as a dependency of an effect or another memo. Here the calculation is trivial; the point is that the *identity* does not change.',
    ),
    code(
      js(`
// Reason 1 — the work is expensive
const sorted = useMemo(
  () => [...rows].sort((a, b) => a.score - b.score),
  [rows],
);

// Reason 2 — the work is nothing, the identity is everything
const options = useMemo(() => ({ userId, include: 'profile' }), [userId]);

useEffect(() => {
  load(options).then(setData);
  // Without the memo, options is new every render and this loops forever
}, [options]);
`),
    ),
    tip(
      'For reason 2 there is usually a simpler fix: depend on the primitives instead. `[userId]` beats `[options]`, needs no memo, and cannot go stale.',
    ),

    h('It is a hint, not a guarantee'),
    warn(
      'React may discard a cached value — to free memory, or for internal reasons it does not document. Never write code whose *correctness* depends on the memo holding. It is an optimisation only.',
    ),
    p(
      'So `useMemo(() => new WebSocket(url), [url])` is wrong: if React drops the value, you get a second socket and no cleanup for the first. That is an effect with a cleanup, or a lazily initialised ref.',
    ),

    h('Is it actually helping?'),
    p(
      '`useMemo` is not free. It stores a value, stores the dependency array, and compares that array on every render. For a cheap calculation, all of that costs more than simply doing the calculation again.',
    ),
    code(
      js(`
// Slower than not memoising. Two array reads and a comparison to avoid an
// addition.
const total = useMemo(() => a + b, [a, b]);

// Almost certainly not worth it either
const label = useMemo(() => \`\${first} \${last}\`, [first, last]);
`),
    ),
    p('Measure before adding one. The honest procedure:'),
    ul(
      'Wrap the calculation in `console.time` / `console.timeEnd` and look at the number. Under about a millisecond, it is noise.',
      'Use the React DevTools Profiler on a **production** build — development renders twice under StrictMode and includes debug work that will not ship.',
      'Throttle the CPU in devtools. Your machine is faster than your users.',
      'Remove the memo and see whether anything measurably changed. Very often nothing does.',
    ),

    h('Common mistakes'),
    table(
      ['Mistake', 'What happens'],
      [
        ['Missing a dependency', 'The cached value is stale — the classic "why is it showing the old filter" bug'],
        ['An object or function in the deps that is rebuilt each render', 'The memo never hits; you pay the cost and get nothing'],
        ['Calling the function instead of passing it', '`useMemo(compute(a), [a])` runs it every render and caches the *result of calling it*'],
        ['A side effect inside', 'It runs during render, possibly twice, possibly discarded'],
        ['Memoising to fix a re-render loop', 'Fix the loop. A memo hiding a loop is a loop that will come back'],
      ],
    ),

    h('Where it genuinely pays'),
    code(
      js(`
// A derived list feeding a memoised child. Both halves are needed: without
// the memo the array is new every render, and memo on the child does nothing.
const visible = useMemo(
  () => topics.filter((t) => t.tags.includes(tag)),
  [topics, tag],
);

return <TopicList topics={visible} />;   // TopicList is wrapped in memo
`),
    ),
    note(
      'The React Compiler, shipping with React 19 tooling, memoises this automatically and makes most manual `useMemo` calls unnecessary. Until a project adopts it, the rules above still apply.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Expensive derived value', '`useMemo(() => work(), [deps])`'],
      ['Stable object for a `memo` child', '`useMemo(() => ({...}), [deps])`'],
      ['Stable function', '`useCallback` — the same thing, for functions'],
      ['Stop an effect looping', 'Depend on primitives; memo only if you cannot'],
      ['Create something once, with cleanup', 'An effect, or a lazily filled ref — not `useMemo`'],
      ['Cheap arithmetic or string joins', 'Do not memoise'],
    ]),

    links(
      reactDoc('reference/react/useMemo', 'useMemo'),
      reactDoc('reference/react/memo', 'memo'),
    ),
  ],
};
