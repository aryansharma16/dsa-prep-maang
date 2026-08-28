import { asked, cheat, code, h, js, links, mdn, note, p, sig, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`this` is not decided by where a function is written. It is decided by **how the function is called** — and there are exactly four rules, checked in order. Once you know the order, every "why is `this` undefined" question answers itself.',
    ),

    h('The four rules, in priority order'),
    table(
      ['Rule', 'Call looks like', '`this` is'],
      [
        ['1. `new`', '`new Thing()`', 'The brand-new object being constructed'],
        ['2. Explicit', '`f.call(obj)`, `f.apply(obj)`, `f.bind(obj)`', '`obj`'],
        ['3. Method', '`obj.f()`', '`obj` — whatever is left of the dot'],
        ['4. Plain', '`f()`', '`undefined` in strict mode and in ES modules; `globalThis` otherwise'],
      ],
    ),
    note(
      'Arrow functions sit outside this table entirely. They have no `this` of their own, so the four rules never run — they use whatever `this` was in the scope where they were written, and `bind` cannot change it.',
    ),
    code(
      js(`
// run: node this.js
const user = {
  name: 'Ada',
  greet() { return \`Hi, \${this.name}\`; },
};

user.greet();                 // 'Hi, Ada'      — rule 3, 'user' is left of the dot

const loose = user.greet;
loose();                      // TypeError      — rule 4, this is undefined

loose.call(user);             // 'Hi, Ada'      — rule 2
loose.call({ name: 'Grace' });// 'Hi, Grace'    — the object need not be the original
`),
    ),
    p(
      'That third line is the whole problem in one statement. Pulling a method off its object does not carry the object with it — the binding lives in the call, not in the function.',
    ),

    h('The callback trap'),
    p(
      'This is where it bites in real code: you pass a method somewhere that will call it later, and by then it is a plain call.',
    ),
    code(
      js(`
class TaskService {
  constructor(db) { this.db = db; }

  async findById(id) {
    return this.db.query('select * from tasks where id = $1', [id]);
  }
}

const service = new TaskService(db);

app.get('/tasks/:id', service.findById);        // breaks — this is undefined
app.get('/tasks/:id', (req, res) => service.findById(req.params.id)); // fine
`),
    ),
    p('Three ways to fix it, in rough order of how often you should reach for them:'),
    code(
      js(`
// 1. Wrap it in an arrow at the call site. Clearest, no cleverness.
app.get('/tasks/:id', (req, res) => service.findById(req, res));

// 2. Bind at the call site.
app.get('/tasks/:id', service.findById.bind(service));

// 3. Make the method an arrow field, bound once at construction.
class TaskService {
  findById = async (id) => this.db.query(/* ... */);  // 'this' is the instance, always
}
`),
    ),

    h('call, apply and bind'),
    sig([
      ['`f.call(thisArg, a, b)`', '`any, ...args`', 'Calls `f` right now with `this` set and arguments listed one by one.'],
      ['`f.apply(thisArg, [a, b])`', '`any, array`', 'The same, but arguments in an array. Spread has made this mostly redundant.'],
      ['`f.bind(thisArg, a)`', '`any, ...args` → `function`', 'Returns a **new** function with `this` — and any arguments you pass — permanently fixed. Does not call anything.'],
    ]),
    code(
      js(`
function describe(role, team) { return \`\${this.name}: \${role} on \${team}\`; }

describe.call({ name: 'Ada' }, 'lead', 'api');       // calls now
describe.apply({ name: 'Ada' }, ['lead', 'api']);    // calls now, array args

const forAda = describe.bind({ name: 'Ada' }, 'lead');
forAda('api');                                        // calls later, 'lead' baked in
`),
    ),
    warn(
      '`bind` returns a *new function object every time*. `emitter.off("x", handler.bind(this))` never removes anything, because the bound function you are removing is not the one you added. Bind once, keep the reference.',
    ),

    h('Arrows and this'),
    p(
      'An arrow closes over `this` the same way it closes over any other variable. That makes it exactly right inside a method — and exactly wrong as a method.',
    ),
    code(
      js(`
class Poller {
  constructor() { this.count = 0; }

  start() {
    // Correct: the arrow inherits 'this' from start(), which is the instance.
    setInterval(() => { this.count++; }, 1000);

    // Wrong: a plain function gets rule 4 — 'this' is undefined.
    setInterval(function () { this.count++; }, 1000);
  }
}

const obj = {
  name: 'Ada',
  greet: () => \`Hi, \${this.name}\`,   // wrong — 'this' is the module scope, not obj
};
`),
    ),
    tip(
      'The rule that covers 95% of cases: **arrow for every callback, method shorthand for every method, never an arrow as an object literal method.**',
    ),

    h('this in Node modules'),
    p(
      'At the top level of a CommonJS file, `this` is `module.exports` — an empty object. At the top level of an ES module it is `undefined`. Inside any ordinary function called plainly, it is `undefined` because module code is always strict. None of these are useful, which is the point: in modern Node you should only ever see `this` inside a class.',
    ),
    code(
      js(`
// index.cjs
console.log(this);            // {}         — module.exports

// index.mjs
console.log(this);            // undefined
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Callback inside a method', 'An arrow — it inherits `this`'],
      ['Pass a method as a callback', 'Wrap it: `(...a) => obj.method(...a)`'],
      ['Fix `this` permanently on a method', 'A class field arrow, or `bind` once in the constructor'],
      ['Borrow a method for another object', '`f.call(other, ...args)`'],
      ['Pre-fill arguments as well as `this`', '`f.bind(obj, first)`'],
      ['Remove a bound listener later', 'Store the bound function in a variable first'],
    ]),

    h('Interview'),
    asked([
      ['What decides the value of `this`?', 'The call site — `new`, explicit binding, a method call, or a plain call, in that priority order.'],
      ['Why is `this` undefined in my callback?', 'It was invoked as a plain function; the object was lost when the method was passed by reference.'],
      ['`call` vs `apply` vs `bind`?', '`call` and `apply` invoke immediately (args listed vs args in an array); `bind` returns a new permanently bound function.'],
      ['Can you `bind` an arrow function?', 'No — arrows have no own `this`, so `bind` and `call` cannot change it.'],
      ['What is `this` at the top of a Node module?', '`module.exports` in CommonJS, `undefined` in an ES module.'],
    ]),

    links(
      mdn('Web/JavaScript/Reference/Operators/this', 'this'),
      mdn('Web/JavaScript/Reference/Global_Objects/Function/bind', 'Function.prototype.bind'),
      mdn('Web/JavaScript/Reference/Functions/Arrow_functions', 'Arrow functions and this'),
    ),
  ],
};
