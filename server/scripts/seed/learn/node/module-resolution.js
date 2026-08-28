import { asked, cheat, code, h, js, links, nodeDoc, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Resolution is how the string `"express"` becomes a file on disk. You only think about it when it goes wrong — a module not found, two copies of the same package, an import that works in development and fails in Docker — and at that point knowing the algorithm turns a mystery into a two-minute fix.',
    ),

    h('Three kinds of specifier'),
    table(
      ['Kind', 'Looks like', 'Resolved against'],
      [
        ['Relative', '`./math.js`, `../db/pool.js`', 'The importing file\'s directory'],
        ['Absolute / URL', '`/app/src/x.js`, `file:///…`', 'The filesystem root'],
        ['Bare', '`express`, `node:fs`, `@scope/pkg`', '`node:` built-ins first, then `node_modules`'],
      ],
    ),

    h('The node_modules walk'),
    p(
      'For a bare specifier, Node starts in the importing file\'s directory and walks **up** the tree, checking `node_modules` at every level, until it finds the package or reaches the filesystem root.',
    ),
    code(
      sh(`
# import 'express' from /app/src/routes/tasks.js
/app/src/routes/node_modules/express   ->  no
/app/src/node_modules/express          ->  no
/app/node_modules/express              ->  found
/node_modules/express                  ->  (never reached)
`),
    ),
    code(
      sh(`
node -e "console.log(require.resolve('express'))"   # which file won
npm ls express                                       # every copy, and who wants it
`),
    ),
    note(
      'npm flattens `node_modules` so shared dependencies live at the top level and are used by everyone. When two packages need incompatible versions, the second is **nested** inside its dependent — so both exist, and the walk finds whichever is closer.',
    ),
    warn(
      'Two copies of the same package are two separate modules, with separate caches and separate class identities. `err instanceof SomeLibError` returns false when the error came from the other copy. `npm ls <pkg>` showing two versions is the diagnosis.',
    ),

    h('Finding the file inside a package'),
    p(
      'Once the package directory is found, its `package.json` decides which file you actually get.',
    ),
    table(
      ['Field', 'Used by', 'Wins'],
      [
        ['`exports`', 'Modern Node, all bundlers', '**Everything else, if present**'],
        ['`main`', 'The historic fallback', 'When there is no `exports`'],
        ['`module`', 'Bundlers only — Node ignores it', 'Never, in Node'],
      ],
    ),
    code(
      js(`
{
  "name": "tasks-lib",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",     // when loaded with import
      "require": "./dist/index.cjs",    // when loaded with require
      "default": "./dist/index.mjs"
    },
    "./client": "./dist/client.js",     // a second public entry point
    "./package.json": "./package.json"
  }
}
`),
    ),
    p(
      'The important consequence: `exports` is an **allowlist**. Anything not listed is unreachable, so `import "tasks-lib/dist/internal.js"` throws `ERR_PACKAGE_PATH_NOT_EXPORTED` even though the file exists. That is deliberate — it is how a package keeps its internals private.',
    ),
    warn(
      'This is the most common "it broke when I upgraded" error. The library did not delete the file; it added an `exports` map and stopped publishing that path. Check the package\'s documented entry points.',
    ),

    h('CommonJS extension guessing'),
    p(
      '`require` tries a sequence of candidates. ESM does not — which is why ported code suddenly needs extensions.',
    ),
    code(
      sh(`
# require('./util')  tries, in order:
./util
./util.js
./util.json
./util.node
./util/package.json  (its "main")
./util/index.js

# import './util'    tries:
./util               ->  ERR_MODULE_NOT_FOUND
`),
    ),

    h('Subpath imports'),
    p(
      'The `#`-prefixed `imports` field gives you internal aliases without a bundler or a `../../../` chain. Node resolves them natively.',
    ),
    code(
      js(`
// package.json
{
  "imports": {
    "#db/*": "./src/db/*.js",
    "#config": "./src/config.js"
  }
}

// anywhere in the package
import { pool } from '#db/pool';
import { config } from '#config';
`),
    ),
    tip(
      'This is the Node-native answer to path aliases. It needs no TypeScript `paths`, no `tsconfig-paths` loader, and no build step — and unlike those, it works identically at runtime.',
    ),

    h('Case sensitivity'),
    warn(
      'macOS and Windows filesystems are case-insensitive; Linux is not. `import { pool } from "./DB/Pool.js"` when the directory is `db/pool.js` works on your laptop and fails in the container with `ERR_MODULE_NOT_FOUND`. It is the classic "works locally, breaks in CI" import bug.',
    ),

    h('Debugging resolution'),
    code(
      sh(`
node --trace-module-resolution src/index.js   # every attempt, in order
node -p "require.resolve('pg')"               # what a bare specifier becomes
npm ls pg                                      # every version in the tree
npm why pg                                     # who asked for it (npm 9+)
`),
    ),
    table(
      ['Error', 'Usually means'],
      [
        ['`ERR_MODULE_NOT_FOUND`', 'A missing extension, wrong case, or the package is genuinely not installed'],
        ['`ERR_PACKAGE_PATH_NOT_EXPORTED`', 'You imported a deep path the `exports` map does not list'],
        ['`ERR_REQUIRE_ESM`', '`require()` of an ES module on Node < 22'],
        ['`Cannot use import statement outside a module`', 'The file was parsed as CommonJS — check `"type"`'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['See which file a specifier resolves to', '`require.resolve(x)` or `import.meta.resolve(x)`'],
      ['Find duplicate packages', '`npm ls <pkg>`'],
      ['Find who pulled a package in', '`npm why <pkg>`'],
      ['Avoid `../../../`', 'The `imports` field with `#alias`'],
      ['Expose extra entry points from a package', 'The `exports` map'],
      ['Debug a resolution failure', '`node --trace-module-resolution`'],
      ['Avoid case bugs', 'Lowercase filenames, and build on Linux in CI'],
    ]),

    h('Interview'),
    asked([
      ['How does Node find a bare specifier?', 'Built-ins first, then walking up `node_modules` from the importing file to the root.'],
      ['What does the `exports` field do?', 'Declares a package\'s public entry points, and blocks every path it does not list.'],
      ['Why do two versions of a package exist?', 'Conflicting ranges — npm hoists one and nests the other, giving two independent module instances.'],
      ['Why does `instanceof` fail across module copies?', 'Each copy defines its own class, so the prototype chains differ.'],
      ['Why do ESM imports need extensions?', 'ESM resolution is spec-defined and does not probe candidate extensions the way `require` does.'],
      ['How do you alias import paths without a bundler?', 'The `imports` field in `package.json`, using `#`-prefixed specifiers.'],
    ]),

    links(
      nodeDoc('modules.html#all-together', 'require resolution algorithm'),
      nodeDoc('packages.html#package-entry-points', 'Package entry points'),
      nodeDoc('packages.html#subpath-imports', 'Subpath imports'),
    ),
  ],
};
