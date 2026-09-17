// Regenerates client/src/components/docs/designGlossary.generated.js from the
// "Component glossary" section of docs/design.md.
//
//   cd client && node scripts/build-docs-glossary.mjs
//
// docs/design.md stays the single source for what every component *is* (rule 16
// there: a new library entry gets a glossary entry in the same change). This
// script lifts that section into data the /docs page can render, so the prose is
// written once and cannot drift between the repo and the app. The generated file
// is imported by a lazy chunk — ~60KB of reference text has no business in the
// main bundle, and Docs.jsx is imported eagerly.
//
// It fails loudly if a technology in the component library has no glossary entry,
// which is the rule that keeps the panel and this reference in step.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { TECH } from '../src/design/library/tech.js';

const SOURCE = new URL('../../docs/design.md', import.meta.url);
const OUT = new URL('../src/components/docs/designGlossary.generated.js', import.meta.url);

/* ---------------------------------------------------------------- the slice */

const md = readFileSync(SOURCE, 'utf8');
const start = md.indexOf('\n## Component glossary\n');
if (start < 0) {
  console.error('No "## Component glossary" heading in docs/design.md.');
  process.exit(1);
}
const after = md.indexOf('\n## ', start + 1);
const section = md.slice(start + 1, after < 0 ? md.length : after);

/* -------------------------------------------------------------------- parse
   Blocks are either a bullet (an entry, its wrapped lines indented by two
   spaces) or a paragraph (a note that belongs to the category it sits in, such
   as "Kafka or RabbitMQ?"). Headings open a category. */

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const categories = [];
const intro = [];
let category = null;
let buffer = null;

const target = () => (category ? category.items : intro);

const flush = () => {
  if (!buffer) return;
  const text = buffer.text.replace(/\s+/g, ' ').trim();
  if (text) target().push(buffer.kind === 'entry' ? entry(text) : { note: text });
  buffer = null;
};

/** `**[Name](url)** — body`, with an optional qualifier before the dash. */
function entry(text) {
  const head = /^\*\*(.+?)\*\*(.*)$/.exec(text);
  if (!head) {
    console.error(`Bullet does not start with a bold name: ${text.slice(0, 70)}…`);
    process.exit(1);
  }
  const [, name, rest] = head;
  const link = /^\[(.+)\]\((.+)\)$/.exec(name);
  const dash = rest.indexOf('—');
  const lead = dash < 0 ? '' : rest.slice(0, dash).trim();
  const body = (dash < 0 ? rest : rest.slice(dash + 1)).trim();

  // A long "qualifier" means the first em dash was inside the body rather than
  // the separator, so the entry would render with half its text as a label.
  if (lead.length > 32) console.warn(`Suspicious lead on "${name}": ${lead}`);

  return {
    name: link ? link[1] : name,
    href: link ? link[2] : '',
    ...(lead ? { lead } : {}),
    body,
  };
}

for (const line of section.split('\n')) {
  const heading = /^### (.+)$/.exec(line);
  if (heading) {
    flush();
    category = { id: slug(heading[1]), title: heading[1].trim(), items: [] };
    categories.push(category);
    continue;
  }
  if (/^## /.test(line)) {
    flush();
    continue;
  }
  if (!line.trim()) {
    flush();
    continue;
  }
  if (/^- /.test(line)) {
    flush();
    buffer = { kind: 'entry', text: line.slice(2) };
    continue;
  }
  if (buffer) buffer.text += ` ${line.trim()}`;
  else buffer = { kind: 'note', text: line.trim() };
}
flush();

/* ------------------------------------------------------------- the two asides
   The section's own opening paragraphs: one says where the definitions come
   from, one lists the books to go on with. The page renders the second. */

const further = intro.find((block) => block.note?.startsWith('**Going deeper**'))?.note || '';

/* ----------------------------------------------------------------- the check */

const named = new Set(categories.flatMap((c) => c.items.filter((i) => i.name).map((i) => i.name)));
const missing = TECH.filter((t) => !named.has(t.name)).map((t) => t.name);
if (missing.length) {
  console.error(
    `${missing.length} component(s) in the library have no glossary entry in docs/design.md:\n  ${missing.join('\n  ')}`,
  );
  process.exit(1);
}

/* ----------------------------------------------------------------- the write */

const entries = categories.reduce((n, c) => n + c.items.filter((i) => i.name).length, 0);

// The button that opens the reference says how many entries are behind it, and
// it cannot read the count without pulling in the chunk it exists to defer.
// So the number is written by hand there, and checked here.
const page = new URL('../src/pages/Docs.jsx', import.meta.url);
const promised = /<span>(\d+) entries<\/span>/.exec(readFileSync(page, 'utf8'));
if (promised && Number(promised[1]) !== entries) {
  console.error(`Docs.jsx offers "${promised[1]} entries"; this glossary has ${entries}. Update it.`);
  process.exit(1);
}
const body = categories
  .map(
    (c) =>
      `  {\n    id: ${JSON.stringify(c.id)},\n    title: ${JSON.stringify(c.title)},\n    items: [\n` +
      c.items.map((item) => `      ${JSON.stringify(item)},`).join('\n') +
      '\n    ],\n  },',
  )
  .join('\n');

mkdirSync(new URL('.', OUT), { recursive: true });
writeFileSync(
  OUT,
  '// Generated by scripts/build-docs-glossary.mjs from the "Component glossary"\n' +
    '// section of docs/design.md. Do not edit — edit that section and re-run it.\n' +
    '//\n' +
    '// `body`, `note` and FURTHER_READING carry inline markdown (bold, code, links);\n' +
    '// DesignGlossary.jsx renders it with the chat renderer\'s INLINE pattern.\n' +
    `export const GLOSSARY_COUNT = ${entries};\n\n` +
    `export const FURTHER_READING = ${JSON.stringify(further)};\n\n` +
    `export const GLOSSARY = [\n${body}\n];\n`,
);
console.log(
  `Wrote ${entries} entries in ${categories.length} categories (${TECH.length} library components all covered).`,
);
