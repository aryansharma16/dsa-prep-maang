import { asked, cheat, code, h, js, links, mdn, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Objects are how everything moves through a Node service: a request body, a row from Postgres, a config, a response. The syntax below is not sugar you can skip — reading modern Node source is mostly reading destructuring and spread, and half the bugs in this area come from one fact: **every copy you write is shallow unless you go out of your way**.',
    ),

    h('Reading properties out'),
    code(
      js(`
const task = { id: 7, title: 'Ship it', assignee: { name: 'Ada' }, tags: ['api'] };

// Destructuring — pull fields out by name.
const { id, title } = task;

// Rename, and default a missing one.
const { title: heading, status = 'open' } = task;

// Nested, and from an array.
const { assignee: { name } } = task;
const [firstTag] = task.tags;

// Rest — everything not already named.
const { id: taskId, ...withoutId } = task;
`),
    ),
    warn(
      'Destructuring a nested path throws if any level is missing. `const { assignee: { name } } = {}` is a TypeError, not `undefined`. Default the intermediate object — `{ assignee: { name } = {} }` — or use optional chaining instead.',
    ),
    p(
      'The place you will use it most is a function signature, because it names what the function actually needs instead of taking a `req` and rummaging.',
    ),
    code(
      js(`
// Express handler, destructured at the door.
app.post('/tasks', async (req, res) => {
  const { title, dueAt = null, tags = [] } = req.body;
  const { id: userId } = req.user;
  // ...
});
`),
    ),

    h('Building objects up'),
    code(
      js(`
const title = 'Ship it';
const status = 'open';

// Shorthand: { title: title, status: status }
const task = { title, status };

// Computed keys.
const field = 'status';
const filter = { [field]: 'open' };          // { status: 'open' }

// Spread: copy, then override. Later wins.
const updated = { ...task, status: 'done' };

// Conditionally include a key at all.
const query = {
  ...(status && { status }),
  ...(tag ? { tag } : {}),
};
`),
    ),
    tip(
      'That last pattern — `...(cond && { key })` — is how you build a filter object without a pile of `if` statements. When the condition is falsy you spread `false`, which contributes nothing.',
    ),

    h('Shallow copies'),
    p(
      '`{ ...obj }` and `Object.assign({}, obj)` copy one level. Nested objects and arrays are still shared with the original, so mutating them mutates both.',
    ),
    code(
      js(`
const original = { id: 1, meta: { views: 0 } };
const copy = { ...original };

copy.id = 2;
console.log(original.id);          // 1  — top level was copied

copy.meta.views = 99;
console.log(original.meta.views);  // 99 — the nested object was NOT
`),
    ),
    p(
      'When you genuinely need a deep copy, Node has `structuredClone` built in since v17 — no dependency, and unlike the `JSON.parse(JSON.stringify(x))` trick it handles `Date`, `Map`, `Set`, `BigInt` and circular references.',
    ),
    table(
      ['Approach', 'Depth', 'Loses'],
      [
        ['`{ ...obj }`', 'One level', 'Nothing, but nested values are shared'],
        ['`structuredClone(obj)`', 'All the way', 'Functions, DOM nodes, prototypes — throws on functions'],
        ['`JSON.parse(JSON.stringify(obj))`', 'All the way', '`Date` becomes a string, `undefined`/`Map`/`Set` vanish, throws on cycles'],
      ],
    ),
    note(
      'Most of the time you do not want a deep copy at all — you want to not mutate. Building a new object with spread at each level you change is cheaper and clearer than cloning the whole tree.',
    ),

    h('Optional chaining and nullish coalescing'),
    code(
      js(`
const city = user?.address?.city;          // undefined, not a TypeError
const first = list?.[0];                   // works on arrays too
const result = obj.maybeFn?.();            // only calls it if it exists

const limit = req.query.limit ?? 20;       // 0 survives; || would not
user.settings ??= {};                      // assign only if null/undefined
`),
    ),

    h('Iterating an object'),
    code(
      js(`
const counts = { open: 3, done: 12 };

Object.keys(counts);      // ['open', 'done']
Object.values(counts);    // [3, 12]
Object.entries(counts);   // [['open', 3], ['done', 12]]

for (const [status, n] of Object.entries(counts)) {
  console.log(status, n);
}

// Build an object back out of pairs — the other direction.
Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 5));
// { done: 12 }
`),
    ),
    tip(
      'For a lookup table with non-string keys, or one you add and delete from constantly, use a `Map`. It keeps insertion order, takes any key type, and has a real `.size`. Objects are for records with known shapes.',
    ),

    h('Freezing'),
    code(
      js(`
const config = Object.freeze({ port: 3000, env: 'production' });
config.port = 4000;        // silently ignored (throws in strict mode)
`),
    ),
    p(
      '`Object.freeze` is also shallow. It is worth doing on an exported config object so a stray assignment somewhere far away fails loudly rather than changing behaviour at runtime.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Pull named fields out of a body', '`const { title, tags = [] } = req.body`'],
      ['Copy and change one field', '`{ ...task, status: "done" }`'],
      ['Include a key only sometimes', '`...(cond && { key: value })`'],
      ['Deep copy', '`structuredClone(obj)`'],
      ['Default a value that could be 0', '`??`, never `||`'],
      ['Loop over an object', '`for (const [k, v] of Object.entries(obj))`'],
      ['Drop a field', '`const { password, ...safe } = user`'],
    ]),

    h('Interview'),
    asked([
      ['Is spread a deep copy?', 'No — one level. Nested objects stay shared with the original.'],
      ['How do you deep clone without a library?', '`structuredClone`. The JSON round-trip loses Dates, `undefined`, Maps and cycles.'],
      ['Spread vs `Object.assign`?', 'Spread creates a new object; `Object.assign` mutates its first argument. Both are shallow.'],
      ['How do you remove a field from an object safely?', 'Destructure it out with rest — `const { password, ...safe } = user` — rather than `delete`.'],
      ['When would you use a Map over an object?', 'Non-string keys, frequent add/delete, or when you need size and guaranteed insertion order.'],
    ]),

    links(
      mdn('Web/JavaScript/Reference/Operators/Destructuring_assignment', 'Destructuring assignment'),
      mdn('Web/JavaScript/Reference/Operators/Spread_syntax', 'Spread syntax'),
      mdn('Web/API/Window/structuredClone', 'structuredClone'),
    ),
  ],
};
