import { asked, cheat, code, h, js, links, mdn, note, p, sig, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Array methods replace loops with a word that says what the loop was for. `map` is "same length, different values". `filter` is "same values, fewer of them". `reduce` is "many values, one result". Once you read them that way you stop writing `for` loops over data almost entirely.',
    ),
    p(
      'Every method below takes a callback receiving `(element, index, array)`. You almost always use only the first argument.',
    ),

    h('The eight worth knowing cold'),
    table(
      ['Method', 'Returns', 'Use when'],
      [
        ['`map`', 'A new array, same length', 'Transforming every item'],
        ['`filter`', 'A new array, shorter or equal', 'Keeping the items that match'],
        ['`reduce`', 'Anything you like', 'Collapsing a list into one value or shape'],
        ['`find`', 'The first match, or `undefined`', 'Looking one item up'],
        ['`some`', '`boolean`', '"Is there at least one that…"'],
        ['`every`', '`boolean`', '"Are they all…"'],
        ['`sort`', 'The **same** array, reordered', 'Ordering — always with a comparator'],
        ['`flat` / `flatMap`', 'A new, flattened array', 'One item became several'],
      ],
    ),

    h('map'),
    code(
      js(`
const tasks = [
  { id: 1, title: 'Ship it', done: false },
  { id: 2, title: 'Write tests', done: true },
];

// The loop it replaces:
const titles = [];
for (const t of tasks) titles.push(t.title);

// The same thing:
const titles2 = tasks.map(t => t.title);           // ['Ship it', 'Write tests']

// Reshaping — the API-response case you will write constantly.
const dto = tasks.map(({ id, title }) => ({ id, title }));
`),
    ),
    warn(
      '`map` always returns an array of the same length. If you find yourself returning `null` from a `map` and filtering afterwards, you wanted `flatMap` — return `[]` to drop an item and `[value]` to keep it, in one pass.',
    ),

    h('filter'),
    code(
      js(`
const open = tasks.filter(t => !t.done);
const mine = tasks.filter(t => t.assigneeId === userId);

// Chained — reads top to bottom as a sentence.
const openTitles = tasks
  .filter(t => !t.done)
  .map(t => t.title);

// Drop nullish entries and keep the rest.
const clean = list.filter(Boolean);
`),
    ),

    h('reduce'),
    sig([
      ['`callback`', '`(acc, item, i, arr) => acc`', 'Returns the new accumulator. Whatever you return is the `acc` on the next call.'],
      ['`initialValue`', 'any', '**Pass it.** Without it, `acc` starts as the first element and an empty array throws.'],
    ]),
    code(
      js(`
// Sum — the textbook case.
const total = items.reduce((sum, i) => sum + i.price, 0);

// Group by a key — the case you will actually reach for.
const byStatus = tasks.reduce((groups, task) => {
  (groups[task.status] ||= []).push(task);
  return groups;
}, {});
// { open: [...], done: [...] }

// Build a lookup table from an array of rows.
const byId = rows.reduce((map, row) => map.set(row.id, row), new Map());
`),
    ),
    tip(
      'Node 21 and above have `Object.groupBy(tasks, t => t.status)` and `Map.groupBy` built in, which is what that second example was working around. Use them when your runtime allows.',
    ),
    note(
      'If a `reduce` is more than about four lines, a plain `for...of` loop is usually clearer. `reduce` earns its place when the accumulator is the point, not when it is a loop in disguise.',
    ),

    h('find, some, every'),
    code(
      js(`
tasks.find(t => t.id === 7);          // the object, or undefined
tasks.findIndex(t => t.id === 7);     // the index, or -1
tasks.findLast(t => !t.done);         // from the end

tasks.some(t => !t.done);             // true if any are open
tasks.every(t => t.done);             // true if all are done — and true for []

tasks.includes(task);                 // reference equality, for primitives mostly
`),
    ),
    warn(
      '`every` on an empty array is `true`. `some` on an empty array is `false`. Both are mathematically right and both have surprised someone validating an empty list.',
    ),

    h('sort'),
    p(
      '`sort` mutates the array it is called on and returns that same array. Without a comparator it converts everything to strings, which is why `[10, 9, 1].sort()` gives `[1, 10, 9]`.',
    ),
    code(
      js(`
// Never sort without a comparator.
[10, 9, 1].sort();                     // [1, 10, 9]   <- string order
[10, 9, 1].sort((a, b) => a - b);      // [1, 9, 10]

// Copy first, so you do not reorder someone else's array.
const newest = [...tasks].sort((a, b) => b.createdAt - a.createdAt);

// Strings, locale-aware.
[...names].sort((a, b) => a.localeCompare(b));

// Node 20+: a non-mutating sort, no spread needed.
const sorted = tasks.toSorted((a, b) => a.id - b.id);
`),
    ),
    tip(
      'The mutating methods are `sort`, `reverse`, `splice`, `push`, `pop`, `shift`, `unshift` and `fill`. Node 20 added `toSorted`, `toReversed`, `toSpliced` and `with` as non-mutating twins.',
    ),

    h('flat and flatMap'),
    code(
      js(`
[[1, 2], [3], []].flat();              // [1, 2, 3]
[[[1]], [2]].flat(2);                  // [1, 2]

// One task, many tags — flatten in the same pass.
tasks.flatMap(t => t.tags);            // every tag, one array

// Map and filter together: [] drops, [x] keeps.
tasks.flatMap(t => t.done ? [] : [t.title]);
`),
    ),

    h('Async in a loop'),
    warn(
      'None of these methods await anything. `items.map(async x => ...)` returns an array of **promises**, not results, and `items.forEach(async ...)` silently discards them along with any error they throw.',
    ),
    code(
      js(`
// Wrong — 'results' is an array of pending promises.
const results = items.map(async (i) => fetchOne(i));

// Right, in parallel:
const results2 = await Promise.all(items.map(i => fetchOne(i)));

// Right, one at a time (when order or rate limits matter):
const results3 = [];
for (const i of items) results3.push(await fetchOne(i));
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Transform every item', '`map`'],
      ['Keep some items', '`filter`'],
      ['Transform and drop in one pass', '`flatMap`, returning `[]` to drop'],
      ['One value out of many', '`reduce` with an initial value'],
      ['Group rows by a field', '`Object.groupBy`, or `reduce` into an object'],
      ['Look one item up', '`find` — not `filter(...)[0]`'],
      ['Sort without wrecking the original', '`toSorted(cmp)`, or `[...arr].sort(cmp)`'],
      ['Run an async job per item', '`await Promise.all(items.map(fn))`'],
    ]),

    h('Interview'),
    asked([
      ['`map` vs `forEach`?', '`map` returns a new array; `forEach` returns `undefined` and exists only for side effects.'],
      ['When would you use `reduce`?', 'When the output is not an array — a sum, a grouping, a lookup Map.'],
      ['Does `sort` mutate?', 'Yes, and it sorts as strings by default. Always pass a comparator; use `toSorted` to avoid mutating.'],
      ['Why does `map` with an async callback not work?', 'It returns promises; you have to `await Promise.all(...)` around it.'],
      ['How do you break out of a `map`?', 'You cannot — use `for...of`, `some`, or `find` if you need early exit.'],
      ['`find` vs `filter`?', '`find` stops at the first match and returns the item; `filter` scans everything and returns an array.'],
    ]),

    links(
      mdn('Web/JavaScript/Reference/Global_Objects/Array', 'Array reference'),
      mdn('Web/JavaScript/Reference/Global_Objects/Array/reduce', 'Array.prototype.reduce'),
      mdn('Web/JavaScript/Reference/Global_Objects/Object/groupBy', 'Object.groupBy'),
    ),
  ],
};
