import { asked, cheat, code, h, js, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'CommonJS is Node\'s original module system: `require()` to bring code in, `module.exports` to send it out. New projects should use ES modules, but CommonJS is still what most of npm is published as and what most existing Node code you will read and maintain is written in — so you need to know how it actually works, not just its syntax.',
    ),

    h('The syntax'),
    code(
      js(`
// math.js
function add(a, b) { return a + b; }
const PI = 3.14159;

module.exports = { add, PI };
// or, one at a time:
// module.exports.add = add;

// index.js
const { add, PI } = require('./math.js');
const math = require('./math.js');       // the whole object
console.log(add(2, 3));
`),
    ),
    p('A single export, when the module *is* one thing:'),
    code(
      js(`
// logger.js
module.exports = function log(msg) { console.log(msg); };

// index.js
const log = require('./logger.js');
`),
    ),

    h('The wrapper function'),
    p(
      'Before running a CommonJS file, Node wraps its source in a function. That wrapper is the whole mechanism, and it explains four things at once.',
    ),
    code(
      js(`
(function (exports, require, module, __filename, __dirname) {
  // ...your file's entire source...
});
`),
    ),
    table(
      ['Explains', 'Because'],
      [
        ['Why top-level `const` does not leak', 'It is inside a function — a real scope, not the global one'],
        ['Why `require` exists without importing it', 'It is a parameter, injected per module'],
        ['Why `__dirname` exists in CJS but not ESM', 'Same — a wrapper parameter, not a global'],
        ['Why `this` is `module.exports` at the top', 'The wrapper is called with `module.exports` as its `this`'],
      ],
    ),

    h('exports vs module.exports'),
    p(
      '`exports` starts as an alias for `module.exports`. Adding properties to it works. **Reassigning it does not**, because you have only repointed a local variable — and `require` returns `module.exports`.',
    ),
    code(
      js(`
exports.add = add;              // works — mutates the shared object

exports = { add };              // does NOTHING — reassigns the local alias
module.exports = { add };       // works — this is the object require returns
`),
    ),
    tip(
      'The simplest rule: only ever write `module.exports`. Ignore that `exports` exists and this whole class of bug disappears.',
    ),

    h('The cache'),
    p(
      'A module\'s body runs **once**, the first time it is required. Every later `require` of the same resolved path returns the exact same exports object from `require.cache`, without re-running anything.',
    ),
    code(
      js(`
// counter.js
console.log('counter.js is running');
let count = 0;
module.exports = { increment: () => ++count, get: () => count };

// index.js
const a = require('./counter.js');   // logs 'counter.js is running'
const b = require('./counter.js');   // logs nothing — cached

a.increment();
console.log(b.get());                // 1  — a and b are the SAME object
console.log(a === b);                // true
`),
    ),
    p(
      'This is why a module exporting a database pool is a singleton without any singleton pattern: everyone requiring it gets the one instance. It is also why a test that mutates an imported module leaks into the next test file — the cache is per process, not per test.',
    ),
    code(
      js(`
// Rarely needed, occasionally essential in tests:
delete require.cache[require.resolve('./config.js')];
const fresh = require('./config.js');   // body runs again
`),
    ),
    warn(
      'The cache key is the **resolved absolute path**. `require("./math")` and `require("./math.js")` hit the same entry, but a package installed twice at different depths in `node_modules` is genuinely two modules with two separate states — the classic "instanceof fails across module instances" bug.',
    ),

    h('require is synchronous'),
    p(
      'It reads the file from disk and executes it, right now, blocking the event loop. That is fine at startup and a problem anywhere else.',
    ),
    code(
      js(`
// Fine — top of the file, at boot.
const express = require('express');

// A problem — a disk read inside a hot request path.
app.get('/report', (req, res) => {
  const heavy = require('./heavy-module.js');   // blocks on first call
});
`),
    ),
    note(
      'Being synchronous is also *why* CommonJS cannot work in a browser without a bundler, and why ESM was designed with an asynchronous, statically analysable loader instead.',
    ),

    h('Circular dependencies'),
    p(
      'A requires B, B requires A. Node does not error — it hands back a **partially filled** exports object, which is worse than an error because it fails later and somewhere else.',
    ),
    code(
      js(`
// a.js
exports.name = 'a';
const b = require('./b.js');
console.log('a sees b.name =', b.name);

// b.js
const a = require('./a.js');
console.log('b sees a.name =', a.name);   // 'a'   — set before the require
exports.name = 'b';

// $ node a.js
// b sees a.name = a
// a sees b.name = b
`),
    ),
    p(
      'It happens to work here only because `exports.name = "a"` runs before the `require`. Move that line down and `b` sees `undefined`. The fix is not clever ordering — it is extracting the shared piece into a third module that both depend on.',
    ),

    h('Interop with ESM'),
    table(
      ['From', 'To', 'Works?'],
      [
        ['ESM', 'CommonJS', 'Yes — `import cjs from "./x.cjs"` gives you `module.exports` as the default'],
        ['CommonJS', 'ESM', '`await import("./x.mjs")` always; plain `require()` only on Node 22+'],
        ['CommonJS', 'ESM top-level await', 'Never — `require` cannot wait'],
      ],
    ),
    code(
      js(`
// From CommonJS, on any version:
async function main() {
  const { helper } = await import('./helper.mjs');
}
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Export several things', '`module.exports = { a, b }`'],
      ['Export one thing', '`module.exports = fn`'],
      ['Never write', '`exports = ...`'],
      ['Get a module\'s absolute path', '`require.resolve("./x.js")`'],
      ['Force a re-run in a test', '`delete require.cache[require.resolve(p)]`'],
      ['Load an ES module from CJS', '`await import("./x.mjs")`'],
      ['Fix a circular dependency', 'Extract the shared part into a third module'],
    ]),

    h('Interview'),
    asked([
      ['How does `require` work?', 'Resolve the path, check the cache, wrap the source in a function, run it once, return `module.exports`.'],
      ['Why does my module body only run once?', 'Modules are cached by resolved path; later requires return the same exports object.'],
      ['`exports` vs `module.exports`?', '`exports` is an alias — mutate it freely, but reassigning it does nothing.'],
      ['Is `require` synchronous?', 'Yes, it blocks. That is why it belongs at the top of the file, not in a handler.'],
      ['What happens with a circular require?', 'Node returns a partially populated exports object rather than erroring.'],
      ['Can CommonJS import ESM?', 'Via dynamic `await import()`; synchronous `require()` of ESM only landed in Node 22.'],
    ]),

    links(
      nodeDoc('modules.html', 'CommonJS modules'),
      nodeDoc('modules.html#the-module-wrapper', 'The module wrapper'),
      nodeDoc('modules.html#cycles', 'Cycles'),
    ),
  ],
};
