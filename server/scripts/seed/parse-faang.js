/**
 * Reads the FAANG interview-questions repo into a per-problem company signal.
 *
 * The other three sources answer "is this problem on a respected list". This one
 * answers a question none of them do: *is it still being asked, and by whom, in
 * 2025-26*. The company CSVs behind `companies[]` are a frequency dump with no
 * date on it — a problem Google stopped asking in 2019 scores identically to one
 * they asked last month. This repo is maintained against recent reports, so a
 * mention here is a recency claim, and that is why it is kept in its own field
 * rather than folded into the frequencies it cannot be compared against.
 *
 * Three files, two shapes:
 *  - README.md              `## Google` … a markdown table per company
 *  - FAANG-Recent-Questions `## Meta (formerly Facebook)` then `### Meta Trees…`
 *  - TopLeetCodeProblems.md `## Array` … topic sections, no company at all
 *
 * In every one of them the only thing extracted is a LeetCode URL inside a table
 * row, and the company is whatever `##` heading it sits under. Deliberately not
 * a markdown parser: the interesting content is a link in a pipe table, and the
 * prose around it changes shape every time the repo is updated.
 */

/**
 * Headings, normalised to the company names the rest of the app already uses.
 *
 * `companies[]` is seeded from per-company CSV files named for these exact
 * strings, and the roadmap's company filter matches on them — so 'ByteDance /
 * TikTok' has to arrive as 'TikTok' or it becomes a second, unfilterable name
 * for a company already in the list. The AI labs below have no CSV and no logo;
 * they are new names that only ever appear in `askedRecently`.
 */
const COMPANY_ALIASES = {
  google: 'Google',
  'meta (facebook)': 'Meta',
  'meta (formerly facebook)': 'Meta',
  meta: 'Meta',
  'meta superintelligence labs': 'Meta',
  amazon: 'Amazon',
  apple: 'Apple',
  netflix: 'Netflix',
  microsoft: 'Microsoft',
  linkedin: 'LinkedIn',
  nvidia: 'Nvidia',
  uber: 'Uber',
  'bytedance / tiktok': 'TikTok',
  bytedance: 'TikTok',
  tiktok: 'TikTok',
  flipkart: 'Flipkart',
  // No company CSV and no logo — askedRecently only.
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  palantir: 'Palantir',
  databricks: 'Databricks',
  stripe: 'Stripe',
  tesla: 'Tesla',
  airbnb: 'Airbnb',
  doordash: 'DoorDash',
  anduril: 'Anduril',
  figma: 'Figma',
  ramp: 'Ramp',
};

/**
 * The repo's own cross-company list, which is a curated set rather than a
 * company section. Tracked separately so it can become the sheet's group label
 * for a problem no single company section claims.
 */
const MUST_DO_HEADING = 'faang must do problems';

/** Sections that are prose, navigation or licence — never problem listings. */
const IGNORED = new Set([
  'essential resources',
  'table of contents',
  'quick start guide',
  'what changed in 2026',
  'about this repository',
  'contributing',
  'license',
  'the single biggest change in 2026: ai-assisted rounds',
]);

const LC_LINK = /leetcode\.com\/problems\/([a-z0-9-]+)/g;

/** A pipe-table row, or a `- [ ]` / `- [x]` checklist row. See the use below. */
const ROW = /^\s*(\||[-*]\s*\[[ xX]\])/;

const normalise = (heading) =>
  String(heading)
    .replace(/[#*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * The company a `##` heading names, or null when it names something else.
 *
 * Exact match only. An earlier draft matched on prefix so that '### Amazon
 * Design' would resolve without its parent, and 'Amazon Web Services' in a
 * sentence resolved to Amazon too — a company signal that fires on prose is
 * worse than no signal, because nothing downstream can tell the two apart.
 */
export const companyFromHeading = (heading) => COMPANY_ALIASES[normalise(heading)] || null;

/**
 * @param {{name: string, text: string}[]} files
 * @returns {Map<string, {companies: string[], topics: string[], mustDo: boolean}>}
 */
export function parseFaang(files) {
  const bySlug = new Map();

  for (const file of files) {
    // `##` sets the company; `###` only refines the topic under it. Anything
    // else (a `#` title) resets both, so a link can never inherit a company
    // from a section that has already ended.
    let company = null;
    let mustDo = false;
    let topic = '';

    for (const line of String(file.text).split('\n')) {
      const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (heading) {
        const [, hashes, text] = heading;
        if (hashes.length <= 2) {
          const key = normalise(text);
          company = companyFromHeading(text);
          mustDo = key === MUST_DO_HEADING;
          topic = company || IGNORED.has(key) ? '' : text.trim();
        } else {
          /*
            '### Amazon Trees and Graphs' under '## Amazon' — strip the company
            it repeats so the topic reads as a topic. Left as-is when the file
            has no company sections at all, which is how TopLeetCodeProblems'
            '## Array' survives.
          */
          topic = company
            ? text.replace(new RegExp(`^${company}\\s+`, 'i'), '').trim()
            : text.trim();
        }
        continue;
      }

      /*
        Two row shapes carry problems, and nothing else does.

        A pipe table is how every company section lists them, and a `- [ ]`
        checklist is how TopLeetCodeProblems does. Prose is excluded on purpose:
        the repo names problems mid-sentence to make a point about a round's
        format, and "Meta's loop leans on Valid Parentheses" is a remark, not a
        listing. Bare `- [text](link)` bullets are excluded for the same reason —
        that is the shape of the Essential Resources nav at the top of the file.
      */
      if (!ROW.test(line)) continue;

      for (const match of line.matchAll(LC_LINK)) {
        const slug = match[1];
        if (!bySlug.has(slug)) {
          bySlug.set(slug, { companies: new Set(), topics: new Set(), mustDo: false });
        }
        const entry = bySlug.get(slug);
        if (company) entry.companies.add(company);
        if (topic) entry.topics.add(topic);
        if (mustDo) entry.mustDo = true;
      }
    }
  }

  return new Map(
    [...bySlug].map(([slug, entry]) => [
      slug,
      {
        companies: [...entry.companies].sort(),
        topics: [...entry.topics],
        mustDo: entry.mustDo,
      },
    ]),
  );
}

/**
 * The sheet group a problem is filed under.
 *
 * One string, not one entry per company: the roadmap's sheet badge renders the
 * first match and the sheet filter is a single-select, so several rows of the
 * same sheet would add nothing a reader can see. The company breadth lives in
 * `askedRecently`, which is a list because it is meant to be.
 */
export function faangGroup(entry) {
  if (entry.mustDo) return 'FAANG Must Do';
  if (entry.companies.length > 1) return `${entry.companies.length} companies`;
  return entry.companies[0] || 'Recent';
}
