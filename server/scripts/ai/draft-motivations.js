/**
 * Drafts candidate motivation lines with Gemini, for a human to curate.
 *
 *   npm run ai:draft -- --trigger weak_pattern --category grind --n 15
 *   npm run ai:draft -- --surface login --n 20 --brief "aim at first-year students"
 *
 * It writes to data/ai/motivation-drafts.json and touches the database not at
 * all. That separation is the point: the shipped corpus in
 * scripts/seed/motivation-lines.js is reviewed copy that lives in git, and a
 * seed step that called a model would produce different content on every run —
 * which is exactly what the idempotent upsert in seed/motivations.js exists to
 * prevent. Draft here, read them, move the good ones into the content file by
 * hand, give them keys.
 *
 * Requires GEMINI_API_KEY. Without it this exits with the same message the API
 * gives, rather than pretending to work.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATEGORIES,
  SURFACES,
  TRIGGERS,
  TRIGGER_KEYS,
} from '../../src/config/motivationTriggers.js';
import { aiEnabled, aiModel, generateJson } from '../../src/services/gemini.service.js';

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/ai/motivation-drafts.json',
);

/** `--flag value` pairs. Bare `--flag` is a boolean, which nothing here needs yet. */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 || !process.argv[i + 1] || process.argv[i + 1].startsWith('--')
    ? fallback
    : process.argv[i + 1];
}

const trigger = arg('trigger', 'always');
const category = arg('category', 'grind');
const surface = arg('surface', 'roadmap');
const count = Math.min(30, Math.max(1, Number(arg('n', 10)) || 10));
const brief = arg('brief', '');

const SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
  required: ['lines'],
};

const SYSTEM = `You write short motivational lines for a website where software engineers prepare for interviews by working through a curated roadmap of algorithm problems.

Rules, all of them hard:
- One sentence each. Under 22 words. No line breaks.
- Second person, plain and direct, a little dry. Write like a good mentor, not a poster.
- No emoji, no exclamation marks, no hashtags, no quotation marks.
- Never say "champion", "warrior", "crush it", "journey", "unlock", "let's" or "dream big".
- Never name the product, and never name a salary figure.
- Say something concrete about engineering, preparation or the work. Avoid anything that would fit equally well on a gym wall.
- Every line must be distinct from the others in the set.`;

/**
 * The tokens matter more than the prose. A line for `weak_pattern` that never
 * names the pattern is just another generic line — and one using a token its
 * trigger cannot fill is silently discarded by the picker, so the model is told
 * exactly which are on the table.
 */
const TOKENS = {
  weak_pattern: '{pattern}, {patternSolved}, {patternTotal}, {patternRemaining}',
  streak_reached: '{streak}, {maxStreak}',
  strong_day: '{today}, {solved}',
  first_of_day: '{today}, {solved}, {remaining}',
  hard_today: '{today}, {solved}',
  revision_due: '{due}, {solved}',
  lapsed: '{days}, {solved}',
  milestone_solved: '{solved}, {remaining}, {percent}, {total}',
  percent_reached: '{percent}, {solved}, {total}, {remaining}',
  attempted_stuck: '{attempted}, {solved}',
  nothing_today: '{solved}, {streak}, {remaining}',
  no_solves_ever: '{total}',
  always: '{solved}, {total}, {remaining}, {percent}, {streak}',
};

async function main() {
  if (!TRIGGER_KEYS.includes(trigger)) {
    console.error(`[ai:draft] unknown trigger "${trigger}". One of: ${TRIGGER_KEYS.join(', ')}`);
    process.exit(1);
  }
  if (!CATEGORIES.includes(category)) {
    console.error(`[ai:draft] unknown category "${category}". One of: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }
  if (!SURFACES.includes(surface)) {
    console.error(`[ai:draft] unknown surface "${surface}". One of: ${SURFACES.join(', ')}`);
    process.exit(1);
  }
  if (!aiEnabled()) {
    console.error('[ai:draft] GEMINI_API_KEY is not set — nothing to ask.');
    process.exit(1);
  }

  const spec = TRIGGERS[trigger];
  // The signed-out page gets no signals, so a token there can never resolve.
  const tokens = surface === 'login' ? '' : TOKENS[trigger];

  const prompt = [
    `Write ${count} lines.`,
    `They will be shown when: ${spec.label}.${spec.hint ? ` (${spec.hint})` : ''}`,
    `Theme: ${category}.`,
    `Shown on: the ${surface} page.`,
    tokens
      ? `You may use these placeholders, replaced with the reader's real numbers: ${tokens}. Use at least one in most lines, and no other placeholder.`
      : 'Do not use any {placeholder} tokens — nothing is known about the reader here.',
    brief ? `Extra direction: ${brief}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  console.log(`[ai:draft] ${count} lines · ${trigger} · ${category} · ${surface} · ${aiModel()}\n`);

  const result = await generateJson(prompt, { system: SYSTEM, schema: SCHEMA, temperature: 1.1 });

  const seen = new Set();
  const drafts = (result?.lines || [])
    .map((line) => String(line?.text || '').trim())
    .filter((text) => {
      if (!text) return false;
      if (text.length > 240) {
        console.warn(`  --   ${text.length} chars, too long: ${text.slice(0, 60)}...`);
        return false;
      }
      if (seen.has(text.toLowerCase())) {
        console.warn(`  --   duplicate: ${text.slice(0, 60)}`);
        return false;
      }
      seen.add(text.toLowerCase());
      return true;
    })
    .map((text) => {
      console.log(`  ok   ${text}`);
      return { text, category, surfaces: [surface], trigger, threshold: spec.threshold?.default ?? null, weight: 1 };
    });

  // Appended, not replaced: two runs at different triggers should accumulate
  // into one file to review, not quietly overwrite each other.
  const existing = await fs
    .readFile(OUT, 'utf8')
    .then((raw) => JSON.parse(raw))
    .catch(() => []);

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, `${JSON.stringify([...existing, ...drafts], null, 2)}\n`);

  console.log(
    `\n[ai:draft] ${drafts.length} kept, ${existing.length + drafts.length} total in ` +
      `${path.relative(process.cwd(), OUT)}`,
  );
  console.log('[ai:draft] review them, then move the keepers into scripts/seed/motivation-lines.js');
}

main().catch((err) => {
  console.error('[ai:draft] failed:', err.message);
  process.exit(1);
});
