import { asked, cheat, code, h, js, links, mdn, note, p, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A **closure** is a function together with the variables that were in scope where it was defined. When you return a function out of another function, the inner one keeps working — it still sees the outer variables, long after the outer function has returned.',
    ),
    p(
      'This is the single idea most Node code is built on. Every middleware factory, every route handler that reads a `db` from the module above it, every `setTimeout` callback that still knows which request it belongs to — all closures. It is also the most-asked JavaScript interview question, and the answer people give is usually the definition without the mechanism.',
    ),

    h('Scope, first'),
    p(
      'Scope is where a name is visible. JavaScript has three kinds, and they nest: a lookup walks outward until it finds the name or runs out of scopes.',
    ),
    table(
      ['Scope', 'Created by', 'Declared with'],
      [
        ['Global', 'The module or the runtime', 'A top-level `const` / `let`'],
        ['Function', 'Every function call', '`var`, parameters, anything inside'],
        ['Block', 'Every `{ }` — `if`, `for`, a bare block', '`let` and `const` only. **Not `var`**'],
      ],
    ),
    code(
      js(`
const app = 'api';                 // module scope

function handle(req) {             // function scope
  const id = req.params.id;

  if (id) {                        // block scope
    let attempts = 0;
    var legacy = 'visible below';  // var ignores the block
  }

  console.log(legacy);             // 'visible below'  — var leaked out
  console.log(attempts);           // ReferenceError   — let did not
}
`),
    ),
    tip(
      'Use `const` by default, `let` when you must reassign, and `var` never. That is not stylistic advice — `var` is function-scoped and hoisted as `undefined`, which produces bugs `let` makes impossible.',
    ),

    h('Hoisting and the TDZ'),
    p(
      'Declarations are processed before any code in a scope runs. `var` declarations are hoisted **and initialised to `undefined`**; `let` and `const` are hoisted but *not* initialised — the span between the top of the block and the declaration line is the **temporal dead zone**, and touching the name there throws.',
    ),
    code(
      js(`
console.log(a);   // undefined       — hoisted, initialised to undefined
var a = 1;

console.log(b);   // ReferenceError  — hoisted, but in the TDZ
let b = 1;

greet();          // 'hi'            — function declarations hoist entirely
function greet() { console.log('hi'); }
`),
    ),
    note(
      'The TDZ is a feature. `undefined` from a `var` you have not reached yet is a bug that shows up three functions later; a `ReferenceError` on the line that did it is a bug you fix in ten seconds.',
    ),

    h('The closure itself'),
    p(
      'When a function is created, it keeps a reference to the scope it was created in. That scope survives as long as the function does — the garbage collector cannot reclaim it, because something still points at it.',
    ),
    code(
      js(`
// run: node counter.js
function makeCounter() {
  let count = 0;                 // lives in makeCounter's scope

  return {
    increment: () => ++count,    // both arrows close over the same 'count'
    current: () => count,
  };
}

const a = makeCounter();
const b = makeCounter();         // an entirely separate 'count'

a.increment();
a.increment();
console.log(a.current());        // 2
console.log(b.current());        // 0
`),
    ),
    p(
      'Three things to notice, because they are what the interview is checking. `count` is **not copied** — the arrows share one variable, so `increment` changes what `current` sees. It is **not reachable** from outside; there is no way to set it to 500. And each call to `makeCounter` creates a **fresh** scope, so `a` and `b` do not interfere.',
    ),

    h('The loop bug'),
    p(
      'The classic. It looks like a `setTimeout` problem and is actually a scope problem.',
    ),
    code(
      js(`
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 3, 3, 3
`),
    ),
    p(
      'There is one `i`, because `var` is function-scoped — the loop does not create a new one per iteration. All three callbacks close over that same variable, and by the time the timers fire the loop has finished and `i` is `3`.',
    ),
    code(
      js(`
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 0, 1, 2
`),
    ),
    p(
      '`let` in a `for` header is special-cased by the language: a fresh binding is created for each iteration and copied forward. Three iterations, three `i` variables, three closures over three different values. Before `let` existed, people wrote an IIFE to get the same effect by hand.',
    ),
    code(
      js(`
// The pre-2015 fix, for when you meet it in old code:
for (var i = 0; i < 3; i++) {
  (function (captured) {
    setTimeout(() => console.log(captured), 0);
  })(i);
}
`),
    ),

    h('Where you will actually use it'),
    ul(
      '**Middleware factories** — `requireRole("admin")` returns a handler that still knows the role on every future request.',
      '**Private state** — a module that returns methods over variables nobody outside can touch, which is how most Node clients hide a socket or a pool.',
      '**Memoisation** — a cache object living in a closure instead of a global.',
      '**Per-request context** — a handler defined inside a request scope keeps that request\'s data without threading it through every call.',
    ),
    code(
      js(`
// Memoise an expensive call. The Map is private and survives every call.
function memoize(fn) {
  const cache = new Map();
  return (arg) => {
    if (cache.has(arg)) return cache.get(arg);
    const result = fn(arg);
    cache.set(arg, result);
    return result;
  };
}
`),
    ),

    h('The leak'),
    warn(
      'A closure keeps its entire enclosing scope alive, not only the variables it reads. If a long-lived callback is created inside a function that also loaded a 50 MB buffer, engines will usually — but not always — collect the buffer. Registering closures on a long-lived emitter and never removing them is the reliable way to leak: the listener stays, so its scope stays.',
    ),
    code(
      js(`
// Leaks: one listener per request, never removed.
app.get('/tasks', (req, res) => {
  bus.on('update', () => res.write('...'));
});

// Fixed: remove it when the request ends.
app.get('/tasks', (req, res) => {
  const onUpdate = () => res.write('...');
  bus.on('update', onUpdate);
  res.on('close', () => bus.off('update', onUpdate));
});
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Keep private state', 'A `let` in an outer function, returned methods that close over it'],
      ['Fix "all my callbacks see the last value"', 'Change `var` to `let` in the loop header'],
      ['Configure a handler ahead of time', 'A factory function that returns the handler'],
      ['Cache results between calls', 'A `Map` in a closure'],
      ['Avoid a listener leak', 'Name the callback and `off()` it when the owner ends'],
      ['Debug a stale value', 'Ask which scope the variable lives in, and how many exist'],
    ]),

    h('Interview'),
    asked([
      ['What is a closure?', 'A function plus the scope it was defined in, which stays alive as long as the function does.'],
      ['Why does the `var` loop print 3, 3, 3?', 'One function-scoped `i` shared by all three closures; the loop finished before any timer fired.'],
      ['How does `let` fix it?', 'A `for` header with `let` creates a new binding per iteration, so each closure captures a different variable.'],
      ['Give a real use for closures.', 'Middleware factories, memoisation caches, and private state in a module.'],
      ['Can closures cause memory leaks?', 'Yes — the captured scope cannot be collected while the function is reachable, which is how listener leaks happen.'],
      ['What is the temporal dead zone?', 'The region from the top of a block to a `let`/`const` declaration, where reading the name throws.'],
    ]),

    links(
      mdn('Web/JavaScript/Guide/Closures', 'Closures'),
      mdn('Web/JavaScript/Reference/Statements/let', 'let'),
      mdn('Web/JavaScript/Reference/Statements/var', 'var and hoisting'),
    ),
  ],
};
