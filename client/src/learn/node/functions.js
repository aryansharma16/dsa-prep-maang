import { asked, cheat, code, h, js, links, mdn, note, p, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A function in JavaScript is a value. It can be stored in a variable, put in an array, passed to another function and returned from one. That is what "first class" means, and it is the reason callbacks, middleware, `map` and every Node API you are about to meet look the way they do.',
    ),
    code(
      js(`
// A function stored in a variable, passed to another function,
// and returned from a third — all ordinary JavaScript.
const double = (n) => n * 2;
[1, 2, 3].map(double);              // [2, 4, 6]
const twice = (f) => (x) => f(f(x));
twice(double)(5);                   // 20
`),
    ),

    h('Three ways to write one'),
    table(
      ['Form', 'Syntax', 'Hoisted?', '`this`'],
      [
        ['Declaration', '`function add(a, b) { ... }`', 'Yes — callable above its definition', 'Set by the call site'],
        ['Expression', '`const add = function (a, b) { ... }`', 'No — the `const` is in the TDZ', 'Set by the call site'],
        ['Arrow', '`const add = (a, b) => a + b`', 'No', 'Inherited from the enclosing scope'],
      ],
    ),
    code(
      js(`
sayHi();                       // works — declarations are hoisted whole
function sayHi() { console.log('hi'); }

sayBye();                      // ReferenceError: Cannot access before initialization
const sayBye = () => console.log('bye');
`),
    ),

    h('Arrow functions'),
    p(
      'An arrow is not just shorter. It has no `this` of its own, no `arguments`, and cannot be called with `new`. In practice you reach for an arrow for every callback and a `function` for anything that needs its own `this` — which, outside of classes and older library APIs, is almost nothing.',
    ),
    code(
      js(`
const nums = [1, 2, 3];

nums.map(n => n * 2);              // implicit return
nums.map(n => { return n * 2; });  // explicit return, same thing
nums.map(n => ({ value: n }));     // returning an object needs the parens
`),
    ),
    warn(
      'Returning an object literal from an arrow without parentheses does not return an object — `n => { value: n }` is a function body containing a label. It returns `undefined`. This one is silent and costs an afternoon.',
    ),

    h('Parameters'),
    sig([
      ['default', '`function f(a = 1)`', 'Used when the argument is `undefined`. Not when it is `null` or `0`.'],
      ['rest', '`function f(...args)`', 'Collects the remaining arguments into a real array.'],
      ['destructured', '`function f({ id, name })`', 'Pulls fields out of an object argument by name.'],
    ]),
    code(
      js(`
// The named-options pattern you will write constantly in Node.
function createUser({ name, role = 'user', active = true } = {}) {
  return { name, role, active };
}

createUser({ name: 'Ada' });               // role and active default
createUser({ name: 'Ada', role: 'admin' }); // order does not matter

// Rest, when the count is genuinely variable:
const sum = (...nums) => nums.reduce((total, n) => total + n, 0);
sum(1, 2, 3);   // 6
`),
    ),
    tip(
      'The trailing `= {}` in `({ ... } = {})` is what lets you call `createUser()` with no argument at all. Without it, destructuring `undefined` throws.',
    ),
    p(
      'JavaScript never checks argument counts. Extra arguments are ignored, missing ones are `undefined`. Nothing warns you — which is why every incoming request gets validated at the edge later in this track.',
    ),

    h('Higher-order functions'),
    p(
      'A function that takes or returns a function. You will not usually call it that, but you will write them all day: an Express middleware factory is exactly this shape.',
    ),
    code(
      js(`
// Takes config, returns the middleware Express will call.
const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).json({ error: 'Forbidden' });
  next();
};

app.delete('/tasks/:id', requireRole('admin'), deleteTask);
`),
    ),
    note(
      'The inner function still sees `role` when it runs, minutes later, on a request. That is a closure — the next topic, and the single most important idea in this section.',
    ),

    h('Pure functions'),
    p(
      'A pure function depends only on its arguments and changes nothing outside itself. It is not a style rule for its own sake: pure functions are the ones you can test without a database and reason about without reading the rest of the file.',
    ),
    ul(
      '**Pure** — `const total = (items) => items.reduce((s, i) => s + i.price, 0)`. Same input, same output, always.',
      '**Impure but necessary** — anything touching the network, the disk, the clock or a random number. Push these to the edges: a service layer that computes, a controller that does I/O.',
      '**Impure by accident** — a function that sorts the array you handed it. `sort` mutates. `[...items].sort()` does not.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Write a callback', 'An arrow — `items.map(i => i.id)`'],
      ['Return an object from an arrow', 'Wrap it: `i => ({ id: i.id })`'],
      ['Accept many optional settings', 'One destructured object parameter with defaults'],
      ['Accept a variable number of values', 'Rest — `(...args)`'],
      ['Configure a middleware', 'A function that returns the middleware'],
      ['Keep a function testable', 'No I/O inside it; take data, return data'],
    ]),

    h('Interview'),
    asked([
      ['Difference between an arrow and a normal function?', 'Arrows have no own `this`, no `arguments`, cannot be `new`-ed, and are never hoisted.'],
      ['What does "functions are first class" mean?', 'A function is a value — assignable, passable, returnable.'],
      ['What is a higher-order function?', 'One that takes a function as an argument or returns one. `map` and Express middleware factories are both.'],
      ['When does a default parameter apply?', 'Only when the argument is `undefined` — `null` and `0` are passed through.'],
      ['Function declaration vs expression?', 'Declarations are hoisted and callable early; expressions are not initialised until the line runs.'],
    ]),

    links(
      mdn('Web/JavaScript/Guide/Functions', 'Functions guide'),
      mdn('Web/JavaScript/Reference/Functions/Arrow_functions', 'Arrow function expressions'),
      mdn('Web/JavaScript/Reference/Functions/Default_parameters', 'Default parameters'),
    ),
  ],
};
