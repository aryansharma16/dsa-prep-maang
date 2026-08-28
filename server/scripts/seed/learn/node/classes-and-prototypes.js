import { asked, cheat, code, h, js, links, mdn, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'JavaScript has no classes underneath. It has **prototypes**: every object holds a hidden link to another object, and a property lookup that misses walks that link until it finds the name or reaches `null`. `class` is syntax over exactly that, and knowing the mechanism is what the interview is checking.',
    ),

    h('The prototype chain'),
    code(
      js(`
// run: node proto.js
const arr = [1, 2, 3];

arr.map;                                    // found on Array.prototype
Object.getPrototypeOf(arr) === Array.prototype;            // true
Object.getPrototypeOf(Array.prototype) === Object.prototype; // true
Object.getPrototypeOf(Object.prototype);                   // null — chain ends

arr.toString;   // not on arr, not on Array.prototype... found on Object.prototype
arr.nope;       // walked the whole chain, found nothing -> undefined
`),
    ),
    p(
      'That walk is why every array has `map` without storing a copy of it, and why adding a method to `Array.prototype` would make it appear on arrays that already exist. It is one shared object, not a copy per instance.',
    ),
    warn(
      'Never add to a built-in prototype. Two libraries doing it pick different semantics for the same name, and the loser is whoever loaded second. This is what "do not monkey-patch" means.',
    ),

    h('class'),
    code(
      js(`
class Task {
  static count = 0;              // on the class itself
  #secret = 'private';           // truly private — not reachable from outside

  constructor(title) {
    this.title = title;          // an own property, one per instance
    this.done = false;
    Task.count++;
  }

  complete() {                   // on Task.prototype — one, shared
    this.done = true;
    return this;
  }

  get summary() {                // a getter, called without parens
    return \`\${this.title} (\${this.done ? 'done' : 'open'})\`;
  }

  static fromRow(row) {          // a static factory
    return new Task(row.title);
  }
}

const t = new Task('Ship it');
t.complete().summary;            // 'Ship it (done)'
Object.getPrototypeOf(t) === Task.prototype;   // true
`),
    ),
    table(
      ['Written as', 'Lives on', 'One per'],
      [
        ['`this.title = ...` in the constructor', 'The instance', 'Instance'],
        ['`complete() {}`', '`Task.prototype`', 'Class — shared by every instance'],
        ['`static count`', 'The `Task` class object', 'Class'],
        ['`#secret`', 'The instance, truly private', 'Instance'],
        ['`complete = () => {}` (field)', 'The instance', 'Instance — which is why `this` is bound'],
      ],
    ),
    note(
      'A method written as a class **field** with an arrow (`complete = () => {}`) is created per instance and closes over `this`, so it survives being passed as a callback. A normal method does not. That is the trade: one function per instance, in exchange for never writing `.bind(this)`.',
    ),

    h('What class desugars to'),
    p(
      'Almost exactly the pre-2015 constructor-function pattern. Knowing this is what lets you read older Node source.',
    ),
    code(
      js(`
// class Task { constructor(title) { this.title = title } complete() { ... } }
// is, near enough:

function Task(title) {
  this.title = title;
}
Task.prototype.complete = function () { this.done = true; return this; };

const t = new Task('Ship it');
`),
    ),
    p(
      'The differences that matter: a `class` is not hoisted, throws if you call it without `new`, always runs in strict mode, and its methods are non-enumerable so they do not show up in `for...in`.',
    ),

    h('Inheritance'),
    code(
      js(`
// The pattern you will actually use in Node: a custom error type.
class AppError extends Error {
  constructor(message, status = 500) {
    super(message);              // must come before any use of 'this'
    this.name = this.constructor.name;
    this.status = status;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(what) { super(\`\${what} not found\`, 404); }
}

const err = new NotFoundError('Task');
err instanceof NotFoundError;   // true
err instanceof AppError;        // true
err instanceof Error;           // true — the whole chain
err.status;                     // 404
`),
    ),
    warn(
      'Calling `super()` is not optional in a subclass constructor — `this` does not exist until it has run. And `Error.captureStackTrace` is Node-specific (V8); the `?.` keeps the class working anywhere else.',
    ),
    p(
      '`instanceof` is just a walk of the prototype chain, asking whether `Constructor.prototype` appears anywhere on it. That is why the three checks above are all true at once.',
    ),

    h('When to use a class in Node'),
    p(
      'Less often than the syntax suggests. A class earns its place when there is real per-instance state and a set of methods that all operate on it — a database client, a queue worker, a service holding a connection pool, an error type. For a module that is just a bag of functions, plain exported functions are simpler and easier to test.',
    ),
    code(
      js(`
// Reasonable: state + behaviour that belong together.
class TaskService {
  constructor(pool) { this.pool = pool; }
  findById = async (id) => (await this.pool.query('select * from tasks where id=$1', [id])).rows[0];
}

// Also reasonable, and simpler: closure over the dependency.
export const makeTaskService = (pool) => ({
  findById: async (id) => (await pool.query('select * from tasks where id=$1', [id])).rows[0],
});
`),
    ),
    tip(
      'Both of those inject the pool rather than importing it. That is the point of either shape: the service can be tested with a fake pool, and nothing reaches for a module-level singleton.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Define a custom error', '`class AppError extends Error`, and `super(message)` first'],
      ['Check a type at runtime', '`err instanceof AppError`'],
      ['Share a method across instances', 'A normal method — it lives on the prototype'],
      ['Keep `this` when passing a method', 'A class field arrow, or bind in the constructor'],
      ['Hide internal state', 'A `#private` field'],
      ['Find an object\'s prototype', '`Object.getPrototypeOf(obj)`'],
      ['Create an object with no prototype', '`Object.create(null)` — a clean map, no inherited keys'],
    ]),

    h('Interview'),
    asked([
      ['What is the prototype chain?', 'A hidden link from each object to another; property lookups walk it until they hit the name or `null`.'],
      ['Is `class` real inheritance?', 'It is syntax over prototypal inheritance — no classes exist at runtime, only objects linked to objects.'],
      ['How does `instanceof` work?', 'It checks whether the constructor\'s `prototype` appears anywhere on the object\'s prototype chain.'],
      ['Prototype method vs class field?', 'A prototype method is shared and unbound; a field is created per instance and, if an arrow, has `this` bound.'],
      ['Why extend `Error` for custom errors?', 'You keep the stack trace and `instanceof` checks while adding fields like `status` for the error middleware.'],
      ['What does `super()` do?', 'Runs the parent constructor — mandatory before touching `this` in a subclass.'],
    ]),

    links(
      mdn('Web/JavaScript/Guide/Inheritance_and_the_prototype_chain', 'Inheritance and the prototype chain'),
      mdn('Web/JavaScript/Reference/Classes', 'Classes'),
      mdn('Web/JavaScript/Reference/Classes/Private_properties', 'Private properties'),
    ),
  ],
};
