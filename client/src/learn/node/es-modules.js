import { asked, cheat, code, h, js, links, nodeDoc, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'ES modules are the standard module system for JavaScript — the same one browsers use. `import` and `export` are syntax, not function calls, which means the dependency graph is known before any code runs. That single difference is where every other difference from CommonJS comes from.',
    ),

    h('Turning them on'),
    p('Three ways, in order of how often you should use them:'),
    table(
      ['How', 'Effect'],
      [
        ['`"type": "module"` in `package.json`', 'Every `.js` file in the package is an ES module. **Do this.**'],
        ['`.mjs` extension', 'That one file is an ES module, whatever the package says'],
        ['`.cjs` extension', 'That one file is CommonJS, inside an ESM package'],
      ],
    ),
    code(
      sh(`
npm pkg set type=module
`),
    ),
    warn(
      '`SyntaxError: Cannot use import statement outside a module` means Node parsed the file as CommonJS. Either `"type": "module"` is missing, or the file is `.cjs`, or you are on a Node old enough not to matter any more.',
    ),

    h('The syntax'),
    code(
      js(`
// math.js
export function add(a, b) { return a + b; }
export const PI = 3.14159;
export default class Calculator {}

// or collect them at the bottom, which reads well in a big file:
// export { add, PI };

// index.js
import Calculator, { add, PI } from './math.js';   // default + named
import * as math from './math.js';                  // everything as a namespace
import { add as sum } from './math.js';             // renamed

export { add } from './math.js';                    // re-export, no local binding
`),
    ),
    warn(
      'The **file extension is mandatory**. `import { add } from "./math"` throws `ERR_MODULE_NOT_FOUND` in Node ESM, even though CommonJS allowed it and bundlers still do. Write `./math.js`.',
    ),
    tip(
      'Prefer named exports over a default. They are greppable, they survive renaming refactors, and an importer misspelling a named export gets an error instead of `undefined`.',
    ),

    h('Static, and what that buys'),
    p(
      '`import` declarations are hoisted and resolved before any of your code executes. You cannot put one inside an `if`, and the path cannot be a variable.',
    ),
    code(
      js(`
// All illegal:
if (isProd) import './debug.js';
const name = './' + mod + '.js';
import x from name;

// The legal way to load conditionally — dynamic import, which returns a promise:
if (isProd) {
  const { setup } = await import('./telemetry.js');
  setup();
}
`),
    ),
    p(
      'The payoff is that tools can see the whole graph without running anything: tree-shaking, bundling for the browser, and errors for a missing export at load time instead of at call time.',
    ),

    h('Live bindings'),
    p(
      'A CommonJS import copies a value. An ESM import is a **live view** of the exporting module\'s binding — if the exporter reassigns it, the importer sees the new value.',
    ),
    code(
      js(`
// counter.js
export let count = 0;
export const bump = () => { count++; };

// index.js
import { count, bump } from './counter.js';
console.log(count);   // 0
bump();
console.log(count);   // 1  — CommonJS would still print 0

count = 5;            // TypeError: Assignment to constant variable
`),
    ),
    note(
      'Imported bindings are read-only from the importing side. Only the module that declared it can change it — which is a genuine improvement over CommonJS, where anyone could reassign a property on someone else\'s exports object.',
    ),

    h('Top-level await'),
    code(
      js(`
// config.js — legal in ESM, impossible in CommonJS
import { readFile } from 'node:fs/promises';

const raw = await readFile(new URL('./config.json', import.meta.url), 'utf8');
export const config = JSON.parse(raw);
`),
    ),
    warn(
      'Every module importing this one waits for that await. Perfect for reading a config at boot; dangerous for a network call, because a hang means your process never finishes starting and never says why.',
    ),

    h('What is missing, and the replacements'),
    table(
      ['CommonJS', 'ES module'],
      [
        ['`__dirname`', '`import.meta.dirname` (Node 20.11+)'],
        ['`__filename`', '`import.meta.filename`'],
        ['`require(x)`', '`import` / `await import(x)`'],
        ['`require.resolve(x)`', '`import.meta.resolve(x)`'],
        ['`require.main === module`', '`import.meta.main` (Node 24+), or compare `import.meta.url` to `process.argv[1]`'],
        ['`module.exports`', '`export` / `export default`'],
      ],
    ),
    code(
      js(`
import { fileURLToPath } from 'node:url';

// "Was this file run directly, or imported?" — the ESM version.
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
`),
    ),

    h('Importing JSON'),
    code(
      js(`
// Node 20.10+ — the attribute is required
import pkg from './package.json' with { type: 'json' };

// The version that works everywhere:
const pkg2 = JSON.parse(
  await readFile(new URL('./package.json', import.meta.url), 'utf8'),
);
`),
    ),

    h('Interop'),
    code(
      js(`
// Importing CommonJS from ESM — module.exports arrives as the default.
import express from 'express';                 // fine, express is CJS
import pkg from 'some-cjs-lib';
const { helper } = pkg;                        // named imports may not be detected

// Importing ESM from CommonJS:
const { helper } = await import('./helper.mjs');   // any Node version
const helper2 = require('./helper.mjs');           // Node 22+, and not if it
                                                   // uses top-level await
`),
    ),
    tip(
      'Node statically analyses CommonJS files to guess their named exports, and it is usually right. When it is not, you get `SyntaxError: does not provide an export named X` — import the default and destructure from it.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Use ESM in a project', '`"type": "module"` in `package.json`'],
      ['Import a local file', 'With the `.js` extension — always'],
      ['Import conditionally', '`await import(path)`'],
      ['Get the current directory', '`import.meta.dirname`'],
      ['Read a file next to this module', '`new URL("./x.json", import.meta.url)`'],
      ['Import JSON', '`import data from "./x.json" with { type: "json" }`'],
      ['One CommonJS file in an ESM project', 'Name it `.cjs`'],
      ['Detect "run directly"', 'Compare `process.argv[1]` to `fileURLToPath(import.meta.url)`'],
    ]),

    h('Interview'),
    asked([
      ['CommonJS vs ES modules?', 'CJS is dynamic, synchronous and cached-by-value; ESM is static, asynchronous, live-bound and tree-shakeable.'],
      ['Why must ESM imports include the file extension?', 'Resolution is spec-defined and does not guess extensions the way `require` did.'],
      ['What are live bindings?', 'Importers see the exporter\'s current value, not a copy taken at import time.'],
      ['Can you `require` an ES module?', 'Only on Node 22+, and never one using top-level await. `await import()` always works.'],
      ['How do you import conditionally in ESM?', 'Dynamic `import()`, which returns a promise — static imports cannot be conditional.'],
      ['Why does `__dirname` not exist in ESM?', 'It was a CommonJS wrapper parameter; ESM has `import.meta.dirname` instead.'],
    ]),

    links(
      nodeDoc('esm.html', 'ECMAScript modules'),
      nodeDoc('esm.html#interoperability-with-commonjs', 'Interoperability with CommonJS'),
      nodeDoc('packages.html#type', 'The "type" field'),
    ),
  ],
};
