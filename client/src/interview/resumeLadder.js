/**
 * The Resume Ladder: what a software engineer's resume needs to prove at each
 * level, from a first job to company-wide influence.
 *
 * Plain data, shipped in the bundle like the Playbook's plan. Nobody's records
 * live here, so there is nothing to fetch.
 *
 * Levels and titles differ between companies. Treat this as a calibration
 * guide, not a promise of how any one company will level you.
 */

export const LEVELS = [
  {
    id: 'sde1',
    name: 'SDE I',
    years: '0–2 yrs',
    scope: 'Task → Feature',
    signal: 'How fast you learn, and how solid your fundamentals are.',
    hue: 'green',
    mustShow: [
      'Education near the top: college, degree, CGPA if it is strong, and the coursework that matches the role.',
      'One or two internships where you shipped something concrete. "Helped the team" says nothing.',
      'Two or three projects you built yourself from start to finish. Tutorial clones do not count.',
      'One or two languages you know well, not a long list of frameworks you used once.',
      'Optional: a competitive programming rating, but only if it is genuinely good.',
    ],
    example:
      'Built a URL shortener in Java + Spring Boot with Redis caching, serving 2k req/s in a load test; added rate limiting after the test exposed a hot-key problem.',
    bar: 'Do you write correct code, and do you learn fast enough to be handed vague problems soon?',
  },
  {
    id: 'sde2',
    name: 'SDE II',
    years: '2–5 yrs',
    scope: 'Feature → Service',
    signal: 'You own a feature yourself, from design to production.',
    hue: 'sky',
    mustShow: [
      'Work experience takes most of the page. Education drops to a single line.',
      'Bullets cover the whole arc (designed, shipped, measured), not just "worked on".',
      'Working with other teams, plus early mentoring of interns or new joiners.',
      'Numbers you personally moved: latency, uptime, error rates, user impact.',
    ],
    example:
      'Owned the refund flow end-to-end; moved retries to an idempotent queue, cutting duplicate refunds to zero and refund-related tickets by 28% across 1.5M monthly orders.',
    bar: 'Can you take a medium-sized project from design to production without close supervision?',
  },
  {
    id: 'sde3',
    name: 'SDE III / Senior',
    years: '5–8+ yrs',
    scope: 'Team → System',
    signal: 'Technical leadership, and designing systems that scale.',
    hue: 'violet',
    mustShow: [
      'Architecture choices and technical direction, not only what you executed.',
      'Influence beyond engineering: you shaped a roadmap with product, design or other teams.',
      'Mentoring you can count: design reviews you ran, how many engineers you guided.',
      'Scale in numbers: millions of users, requests per second, data volume.',
      'Optional: one process win, such as faster deploys or better team throughput.',
    ],
    example:
      'Split the order service out of the monolith into event-driven services, dropping p99 latency from 900ms to 350ms and letting 4 teams deploy on their own schedules.',
    bar: 'Can you design for scale, pick the right trade-offs, and make the engineers around you better?',
  },
  {
    id: 'staff',
    name: 'Staff',
    years: '8–12+ yrs',
    scope: 'Org → Multiple teams',
    signal: 'Technical strategy across several teams, not single projects.',
    hue: 'amber',
    mustShow: [
      'Bullets move from "I built X" to "I set the direction for X, and N teams followed it".',
      'Initiatives across the org: architecture decisions several teams had to adopt.',
      'Design docs or RFCs that became the standard way of building things.',
      'Impact in business terms (revenue, cost, risk), not only engineering metrics.',
      'Optional: conference talks, patents, leading an open-source project.',
    ],
    example:
      'Wrote the RFC for a shared observability stack adopted by 8 teams, cutting monitoring spend by $900K/yr and becoming the default for every new service.',
    bar: 'Do other senior engineers follow the direction you set, with results visible across the org?',
  },
  {
    id: 'principal',
    name: 'Principal',
    years: '12+ yrs',
    scope: 'Company → Industry',
    signal: 'Influence across the whole company, or the industry.',
    hue: 'red',
    mustShow: [
      'Reads like a technical biography: the systems that shaped how the company is built.',
      'Recognition outside the company: invited talks, patents, standards work, well-known writing.',
      'A few big bets. One initiative that reshaped the company beats a page of small ones.',
      'Hiring at this level rarely starts from a cold application; it is usually promotion or direct outreach.',
    ],
    example:
      'Designed the company-wide strategy for zero-downtime database migrations, used by 50+ services; keynote speaker at two industry conferences, 2 patents granted.',
    bar: 'Do staff and principal engineers follow your direction, at the scale of the whole company?',
  },
];

/** Years of experience → the level to aim at. Cut-offs follow the `years` ranges above. */
export const levelForYears = (years) => {
  if (years < 2) return LEVELS[0].id;
  if (years < 5) return LEVELS[1].id;
  if (years < 8) return LEVELS[2].id;
  if (years < 12) return LEVELS[3].id;
  return LEVELS[4].id;
};

/** What every generated rewrite prompt insists on, shown beside the prompt. */
export const PROMPT_RULES = [
  { label: 'No made-up numbers', rule: 'A missing metric becomes a [placeholder], with a note on what to measure.' },
  { label: 'Claims fit the level', rule: 'Nothing bigger than the level allows, and no real ownership watered down.' },
  { label: 'Outcome first', rule: 'Every bullet: result, number, then how you did it.' },
  { label: 'Honest verbs', rule: '"Led", "owned" and "designed" only where they are true.' },
  { label: 'ATS-safe', rule: 'One page, single column, newest first.' },
  { label: 'Job-post keywords', rule: 'Mirrors the posting’s terms if you paste one in.' },
];

/**
 * A prompt to paste into Claude or ChatGPT, followed by the resume text.
 * Built from the level's own data so the two never drift apart.
 */
export const buildRewritePrompt = (level) =>
  [
    `Act as a senior engineering hiring manager editing my resume for a ${level.name} role (${level.years} of experience, scope ${level.scope}).`,
    '',
    'WHAT THIS LEVEL HAS TO PROVE',
    `Main signal: ${level.signal}`,
    'The resume should show:',
    ...level.mustShow.map((item) => `- ${item}`),
    `The question a reviewer is really asking: ${level.bar}`,
    '',
    'HOW TO REWRITE',
    '1. Rewrite every bullet under Experience and every Project as: result, then the number that proves it, then what I did to get there. Drop any bullet that only lists a duty.',
    '2. Do not invent numbers. Where I have none, put a placeholder like [X%] or [N users]. At the end, list each placeholder under "NUMBERS TO FIND" with what I should measure to fill it.',
    `3. Keep claims inside ${level.name} scope (${level.scope}). Do not inflate, and do not weaken real ownership into "helped with" or "assisted".`,
    '4. Use strong ownership verbs (led, owned, designed, shipped, debugged) only where my original text supports them. If unsure, ask me.',
    '5. Format: one page (two only past ~10 years), single column, newest first, no tables, icons or photos.',
    '6. If I include a job description, reuse its keywords and tech stack wherever they are true for me.',
    '7. Return the full rewritten resume, then the "NUMBERS TO FIND" list, then the three weakest bullets left and why.',
    '',
    'JOB DESCRIPTION (optional, paste here or delete this section):',
    '',
    '',
    'MY RESUME (paste below):',
    '',
  ].join('\n');

/** The rules that do not change with level. */
export const FORMAT_RULES = [
  { label: 'Length', rule: 'One page. Go to two only after about ten years of experience.' },
  { label: 'File', rule: 'Send a PDF with a plain name, like FirstName_LastName_Resume.pdf.' },
  {
    label: 'Layout',
    rule: 'Single column. No tables, icons or photos: ATS parsers read top to bottom and trip on them.',
  },
  {
    label: 'Bullet formula',
    rule: 'Did X, measured by Y, by doing Z. Every line needs an outcome and a number.',
  },
  { label: 'Order', rule: 'Newest first, with the same date format everywhere.' },
  {
    label: 'Keywords',
    rule: 'Use the words from the job posting. Both the parser and the recruiter look for them.',
  },
];
