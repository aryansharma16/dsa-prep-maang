import { asked, cheat, code, h, js, links, nodeDoc, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The `fs` module reads and writes the filesystem. It ships in three flavours — promises, callbacks and synchronous — and picking the wrong one is one of the easiest ways to block the event loop, so start with which is which.',
    ),

    h('Three APIs, one job'),
    table(
      ['Import', 'Style', 'Use it'],
      [
        ['`node:fs/promises`', '`await readFile(p)`', '**Almost always.** Non-blocking, reads like normal code.'],
        ['`node:fs`', '`readFile(p, cb)`', 'Callback style. Non-blocking. Older code, and streams live here.'],
        ['`node:fs` `*Sync`', '`readFileSync(p)`', 'Blocks the thread. Startup, CLI scripts and build tools only.'],
      ],
    ),
    code(
      js(`
// run: node read.js
import { readFile, writeFile } from 'node:fs/promises';

const raw = await readFile('./config.json', 'utf8');
const config = JSON.parse(raw);

await writeFile('./out.json', JSON.stringify(config, null, 2));
`),
    ),
    warn(
      'A `*Sync` call inside a request handler stops the entire server for the duration of the disk read. It is acceptable exactly once — reading config at boot, before you start listening — and nowhere else.',
    ),

    h('Reading'),
    code(
      js(`
import { readFile } from 'node:fs/promises';

await readFile('./a.txt', 'utf8');    // a string
await readFile('./a.png');            // a Buffer — no encoding given
await readFile('./a.txt', { encoding: 'utf8', signal: ac.signal });
`),
    ),
    p(
      'The encoding argument is the whole difference between getting text and getting bytes. Omit it for images, PDFs and anything binary; pass `utf8` for text you intend to parse.',
    ),
    warn(
      '`readFile` loads the **entire** file into memory. A 2 GB log file is a 2 GB allocation, and Node will throw `ERR_FS_FILE_TOO_LARGE` past roughly 2 GB regardless. For anything that could be large, use a stream — the `streams` topic.',
    ),

    h('Writing'),
    code(
      js(`
import { writeFile, appendFile } from 'node:fs/promises';

await writeFile('./out.txt', 'hello');                    // creates or TRUNCATES
await appendFile('./app.log', line + '\\n');               // adds to the end
await writeFile('./once.txt', data, { flag: 'wx' });      // fails if it exists
`),
    ),
    table(
      ['Flag', 'Means'],
      [
        ['`w`', 'Write. Create, or truncate an existing file. **The default.**'],
        ['`a`', 'Append. Create if missing.'],
        ['`wx`', 'Write, but fail with `EEXIST` if the file already exists.'],
        ['`r`', 'Read only. Fails if missing.'],
        ['`r+`', 'Read and write, without truncating.'],
      ],
    ),
    tip(
      'To replace a file safely, write to a temporary name and then `rename` it. `rename` is atomic within a filesystem, so a reader either sees the old file or the complete new one — never a half-written one. A crash mid-`writeFile` leaves a truncated file forever.',
    ),
    code(
      js(`
import { writeFile, rename } from 'node:fs/promises';

await writeFile(target + '.tmp', data);
await rename(target + '.tmp', target);      // atomic swap
`),
    ),

    h('Does it exist?'),
    code(
      js(`
// Do NOT do this — the file can vanish between the check and the open.
if (existsSync(path)) { await readFile(path); }

// Just try, and handle the error. One syscall, no race.
try {
  return await readFile(path, 'utf8');
} catch (err) {
  if (err.code === 'ENOENT') return null;
  throw err;
}
`),
    ),
    note(
      'This is the TOCTOU pattern — time of check, time of use. `fs.exists` is deprecated for exactly this reason. When you genuinely need a check without a read, `fs.access(path)` throws or resolves, but the race is still there.',
    ),

    h('Copy, move, delete'),
    code(
      js(`
import { copyFile, rename, rm, cp } from 'node:fs/promises';

await copyFile('a.txt', 'b.txt');
await rename('a.txt', 'archive/a.txt');            // move, same filesystem
await rm('a.txt');                                  // one file
await rm('a.txt', { force: true });                 // no error if missing
await rm('./build', { recursive: true, force: true });   // replaces rimraf
await cp('./src', './backup', { recursive: true });      // copy a tree
`),
    ),

    h('Metadata'),
    code(
      js(`
import { stat } from 'node:fs/promises';

const s = await stat('./upload.pdf');
s.size;              // bytes
s.isFile();
s.isDirectory();
s.mtime;             // last modified, a Date
s.birthtime;         // created
`),
    ),
    code(
      js(`
// A size guard before you read something into memory.
const { size } = await stat(path);
if (size > 10 * 1024 * 1024) throw new AppError('File too large', 413);
const data = await readFile(path);
`),
    ),

    h('Path traversal'),
    warn(
      'Never build a path from user input without normalising it. `../../etc/passwd` in a filename parameter reads whatever the process can read. This is the single most common file-related vulnerability in a Node API.',
    ),
    code(
      js(`
import path from 'node:path';

const UPLOADS = path.resolve('./uploads');

function safePath(userInput) {
  const full = path.resolve(UPLOADS, userInput);   // resolve collapses '..'
  if (!full.startsWith(UPLOADS + path.sep)) {
    throw new AppError('Invalid path', 400);
  }
  return full;
}
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Read a text file', '`await readFile(p, "utf8")`'],
      ['Read a binary file', '`await readFile(p)` — no encoding'],
      ['Read something large', 'A stream, never `readFile`'],
      ['Write safely', 'Write to `.tmp`, then `rename`'],
      ['Add a log line', '`appendFile`'],
      ['Handle a missing file', 'Catch and check `err.code === "ENOENT"`'],
      ['Delete a directory tree', '`rm(p, { recursive: true, force: true })`'],
      ['Accept a filename from a user', '`path.resolve` and check the prefix'],
    ]),

    h('Interview'),
    asked([
      ['`readFile` vs `readFileSync`?', 'The sync version blocks the event loop, so it is only acceptable at startup or in a CLI.'],
      ['Why prefer `fs/promises`?', 'Non-blocking, and it composes with `async`/`await` and `try/catch`.'],
      ['When should you not use `readFile` at all?', 'When the file could be large — it loads everything into memory. Stream instead.'],
      ['How do you check whether a file exists?', 'Do not — attempt the operation and handle `ENOENT`, to avoid a check/use race.'],
      ['How do you write a file atomically?', 'Write a temp file and `rename` it over the target.'],
      ['How do you prevent path traversal?', '`path.resolve` against a fixed base and verify the result is still inside it.'],
    ]),

    links(
      nodeDoc('fs.html#promises-api', 'fs Promises API'),
      nodeDoc('fs.html#file-system-flags', 'File system flags'),
      nodeDoc('fs.html#class-fsstats', 'fs.Stats'),
    ),
  ],
};
