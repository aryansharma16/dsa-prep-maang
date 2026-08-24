import { asked, cheat, code, h, js, link, links, nodeDoc, note, p, sh, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Everything from here on assumes you can run a file. This topic is the commands to get there — install, check, run, inspect — in the order you need them.',
    ),

    h('Install'),
    p(
      'Install through a version manager, not the OS package manager. You will need to switch versions between projects sooner than you think, and a global Node installed by `apt` or `brew` makes that painful.',
    ),
    code(
      sh(`
# nvm — the usual choice on macOS and Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

nvm install --lts          # newest long-term-support release
nvm install 22             # a specific major
nvm use 22
nvm alias default 22       # what a new terminal gets
nvm ls                     # what you have installed
`),
    ),
    code(
      sh(`
node -v          # v22.11.0
npm -v           # 10.9.0
which node       # where it resolved from
`),
    ),
    tip(
      'Drop a `.nvmrc` file containing just `22` in a project root, then `nvm use` in that directory picks it up with no arguments. Some shells run it automatically on `cd`.',
    ),

    h('Run a file'),
    code(
      js(`
// hello.js
const name = process.argv[2] ?? 'world';
console.log(\`Hello, \${name}\`);
`),
    ),
    code(
      sh(`
node hello.js              # Hello, world
node hello.js Ada          # Hello, Ada
node hello                 # the .js is optional for a plain file
`),
    ),
    p(
      'Note there is no build step, no compiler and no entry-point convention. `node <file>` runs that file. Anything it imports is loaded on demand.',
    ),

    h('Watch mode'),
    p(
      'Since Node 18 the runtime restarts itself on file changes. You no longer need `nodemon` for this.',
    ),
    code(
      sh(`
node --watch server.js               # restart on change
node --watch-path=./src server.js    # only watch a directory
`),
    ),

    h('The REPL'),
    p(
      'Running `node` with no arguments gives you an interactive prompt. Useful for checking what a function actually returns before you write it into a file.',
    ),
    code(
      sh(`
$ node
Welcome to Node.js v22.11.0.
> [1,2,3].map(n => n * 2)
[ 2, 4, 6 ]
> await import('node:os').then(os => os.platform())
'linux'
> .help          # REPL commands
> .exit          # or Ctrl-D
`),
    ),
    code(
      sh(`
node -e "console.log(process.version)"        # run one expression
node -p "1 + 1"                               # run and print the result
node --check server.js                        # parse only, report syntax errors
`),
    ),

    h('The node: prefix'),
    p(
      'Built-in modules can be imported with or without a `node:` prefix. Use the prefix. It says unambiguously that you mean the built-in, so an npm package called `path` or `events` cannot shadow it, and it is required for a few newer modules like `node:test`.',
    ),
    code(
      js(`
import fs from 'node:fs/promises';     // unambiguous, preferred
import fs from 'fs/promises';          // works, but resolvable from node_modules

import test from 'node:test';          // the prefix is mandatory here
`),
    ),

    h('A project from nothing'),
    code(
      sh(`
mkdir tasks-api && cd tasks-api
npm init -y                       # writes package.json
npm pkg set type=module           # use import/export, not require
mkdir src && touch src/index.js
node src/index.js
`),
    ),
    note(
      '`npm pkg set type=module` is the one line that decides which module system the whole project uses. Setting it now avoids the "Cannot use import statement outside a module" error later — see the `es-modules` topic.',
    ),

    h('Flags worth knowing'),
    table(
      ['Flag', 'Does'],
      [
        ['`--watch`', 'Restart on file change'],
        ['`--env-file=.env`', 'Load a `.env` file with no dependency (Node 20+)'],
        ['`--inspect`', 'Open a debugger port; attach from Chrome DevTools or VS Code'],
        ['`--inspect-brk`', 'The same, but pause before the first line'],
        ['`--test`', 'Run the built-in test runner (Node 18+)'],
        ['`--trace-warnings`', 'Show a stack trace for warnings instead of just the message'],
        ['`--max-old-space-size=4096`', 'Raise V8\'s heap limit, in MB'],
      ],
    ),
    code(
      sh(`
node --env-file=.env --watch src/index.js
node --inspect-brk src/index.js      # then open chrome://inspect
`),
    ),

    h('Debugging'),
    p(
      '`console.log` is fine and everyone uses it. When it is not enough, `--inspect` gives you a real debugger with breakpoints, and in VS Code the "Attach to Node Process" command hooks onto an already-running process.',
    ),
    code(
      js(`
console.table(rows);                          // arrays of objects, as a grid
console.dir(obj, { depth: null });            // no truncation on nested objects
console.time('query'); /* ... */ console.timeEnd('query');   // query: 42.1ms
`),
    ),
    warn(
      '`console.log(obj)` truncates past two levels of nesting and prints `[Object]`. That is not your object being empty — it is the default depth. Use `console.dir(obj, { depth: null })`.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Install and switch Node versions', '`nvm install --lts`, `nvm use 22`'],
      ['Run a file', '`node src/index.js`'],
      ['Restart on change', '`node --watch src/index.js`'],
      ['Try one expression', '`node -p "expr"`, or the REPL'],
      ['Load a .env with no dependency', '`node --env-file=.env`'],
      ['Start a project', '`npm init -y && npm pkg set type=module`'],
      ['Debug with breakpoints', '`node --inspect-brk`, then attach'],
      ['See a fully nested object', '`console.dir(obj, { depth: null })`'],
    ]),

    h('Interview'),
    asked([
      ['How do you manage Node versions?', 'A version manager like nvm, plus an `.nvmrc` and an `engines` field so the project pins its own.'],
      ['What does the `node:` prefix do?', 'Forces resolution to the built-in module, so an npm package cannot shadow it.'],
      ['Do you still need nodemon?', 'No — `node --watch` has been built in since Node 18.'],
      ['How do you debug a running Node process?', '`--inspect` (or attach to the PID) and use Chrome DevTools or the VS Code debugger.'],
      ['How do you load environment variables?', '`--env-file` on Node 20+, or `dotenv` on older versions.'],
    ]),

    links(
      nodeDoc('cli.html', 'Command-line options'),
      nodeDoc('repl.html', 'REPL'),
      link('Download and install Node.js', 'https://nodejs.org/en/download'),
    ),
  ],
};
