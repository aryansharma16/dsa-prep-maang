import { asked, cheat, code, h, js, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A path is a string, which is exactly why people get it wrong: string concatenation produces something that looks right on your machine and breaks in the container. The `path` module knows the separator, collapses `..`, and is the only correct way to build one.',
    ),

    h('Building paths'),
    code(
      js(`
import path from 'node:path';

path.join('uploads', 'user', 'avatar.png');   // 'uploads/user/avatar.png'
path.join('a/', '/b');                         // 'a/b'  — the double slash is fixed
path.join('a', '..', 'b');                     // 'b'    — '..' is collapsed

path.resolve('uploads', 'a.png');              // '/current/cwd/uploads/a.png'
path.resolve('/var', 'log', 'app.log');        // '/var/log/app.log'
`),
    ),
    table(
      ['', '`join`', '`resolve`'],
      [
        ['Does', 'Concatenates and normalises', 'Produces an **absolute** path'],
        ['Starts from', 'Nothing — the result can be relative', '`process.cwd()`, unless a segment is absolute'],
        ['Use for', 'Building a relative fragment', 'Anything you will actually open'],
      ],
    ),
    warn(
      'Never write `"./uploads/" + filename`. On Windows the separator is wrong, a leading slash in the filename silently makes it absolute, and `../..` in it escapes your directory entirely.',
    ),

    h('Reading a path apart'),
    code(
      js(`
const p = '/app/uploads/report.final.pdf';

path.dirname(p);            // '/app/uploads'
path.basename(p);           // 'report.final.pdf'
path.basename(p, '.pdf');   // 'report.final'
path.extname(p);            // '.pdf'   — the LAST dot onwards

path.parse(p);
// { root: '/', dir: '/app/uploads', base: 'report.final.pdf',
//   ext: '.pdf', name: 'report.final' }

path.isAbsolute(p);         // true
path.relative('/app', p);   // 'uploads/report.final.pdf'
`),
    ),
    tip(
      'Never trust `extname` as a file-type check. A user can name a shell script `photo.png`. Validate uploads by their actual content — the magic bytes — which is the file-upload topic in the next pass.',
    ),

    h('Relative to what?'),
    p(
      'The bug that bites everyone once: a relative path resolves against the **current working directory**, not the file it is written in. The same code works when run from the project root and fails from anywhere else, including from a systemd unit or a cron job.',
    ),
    code(
      js(`
// Fragile — depends on where the process was started.
await readFile('./templates/email.html', 'utf8');

// Correct — anchored to this module's own directory.
const here = import.meta.dirname;                        // ESM, Node 20.11+
await readFile(path.join(here, 'templates', 'email.html'), 'utf8');

// Reading a file next to this module, without path at all:
await readFile(new URL('./templates/email.html', import.meta.url), 'utf8');
`),
    ),
    note(
      '`process.cwd()` is still the right anchor for things a *user* named — a CLI argument, a config path passed on the command line. `import.meta.dirname` is the right anchor for things that ship with your code.',
    ),

    h('Directories'),
    code(
      js(`
import { mkdir, readdir, rm, stat } from 'node:fs/promises';

await mkdir('./uploads/2026/08', { recursive: true });   // makes every level;
                                                          // no error if it exists
const names = await readdir('./uploads');                 // ['a.png', 'sub']

// withFileTypes avoids a stat() call per entry.
const entries = await readdir('./uploads', { withFileTypes: true });
for (const e of entries) {
  console.log(e.name, e.isDirectory() ? 'dir' : 'file');
}

await rm('./tmp', { recursive: true, force: true });
`),
    ),

    h('Walking a tree'),
    code(
      js(`
// The built-in way, since Node 20 — no recursion to write.
const all = await readdir('./src', { recursive: true });

// Or a generator, when you need to filter or stop early.
import { opendir } from 'node:fs/promises';

async function* walk(dir) {
  for await (const entry of await opendir(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

for await (const file of walk('./src')) {
  if (file.endsWith('.test.js')) console.log(file);
}
`),
    ),
    tip(
      'The generator uses constant memory whatever the tree size, and lets you `break` out early. `readdir({ recursive: true })` builds the whole array first — fine for a source tree, not for a media library.',
    ),
    code(
      js(`
// Node 22+ has glob built in, which covers most of what you would write above.
import { glob } from 'node:fs/promises';

for await (const file of glob('src/**/*.test.js')) console.log(file);
`),
    ),

    h('Temporary files'),
    code(
      js(`
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';

const dir = await mkdtemp(path.join(os.tmpdir(), 'export-'));
try {
  await writeFile(path.join(dir, 'out.csv'), csv);
  // ...
} finally {
  await rm(dir, { recursive: true, force: true });
}
`),
    ),
    warn(
      'Do not build a temp path yourself from a timestamp or a random number in a shared directory like `/tmp`. `mkdtemp` creates the directory atomically with a unique name, which is what stops another process predicting it and pre-creating a symlink there.',
    ),

    h('Platform differences'),
    table(
      ['', 'Linux / macOS', 'Windows'],
      [
        ['Separator', '`/`', '`\\` — `path.sep`'],
        ['Case', 'Sensitive on Linux', 'Insensitive'],
        ['Absolute looks like', '`/app/src`', '`C:\\app\\src`'],
      ],
    ),
    p(
      'The case difference is the one that costs a build: `./Utils/Index.js` works on macOS and fails in a Linux container. Lowercase filenames, and let CI on Linux be the arbiter.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Build a path', '`path.join(...)` — never `+`'],
      ['Make it absolute', '`path.resolve(...)`'],
      ['Anchor to this file', '`import.meta.dirname`'],
      ['Anchor to the user\'s directory', '`process.cwd()`'],
      ['Create nested directories', '`mkdir(p, { recursive: true })`'],
      ['List with types, cheaply', '`readdir(p, { withFileTypes: true })`'],
      ['Walk a big tree', 'An `opendir` generator, or `fs.glob`'],
      ['Make a temp directory', '`mkdtemp(path.join(os.tmpdir(), "prefix-"))`'],
    ]),

    h('Interview'),
    asked([
      ['Why use `path.join` over string concatenation?', 'It fixes separators, collapses `..` and normalises doubles — concatenation does none of that.'],
      ['`path.join` vs `path.resolve`?', '`join` merges segments; `resolve` always returns an absolute path, anchored at the cwd.'],
      ['What does a relative path resolve against?', '`process.cwd()` — not the file it appears in.'],
      ['How do you read a file that ships next to your module?', '`import.meta.dirname`, or `new URL("./x", import.meta.url)`.'],
      ['How do you create nested directories?', '`mkdir(path, { recursive: true })` — it is also idempotent.'],
      ['Why did it work locally and fail in Docker?', 'Usually filename case: macOS is case-insensitive, Linux is not.'],
    ]),

    links(
      nodeDoc('path.html', 'path'),
      nodeDoc('fs.html#fspromisesreaddirpath-options', 'fsPromises.readdir'),
      nodeDoc('fs.html#fspromisesglobpattern-options', 'fsPromises.glob'),
    ),
  ],
};
