/**
 * The competitive-programming ladder, in seven rungs.
 *
 * This is the spine of the Pro Coder module and the one thing four separate
 * pieces of code have to agree on: the curator deciding which band a problem
 * belongs to, the ladder endpoint grouping the response, the stats endpoint
 * bucketing coverage, and the AI coach telling someone whether a problem is a
 * stretch or a warm-up. Defined once, here.
 *
 * The bands are Codeforces' own rank thresholds, not invented ones. That matters
 * more than it looks: a learner's rating is a number Codeforces gives them, and
 * a ladder whose "Specialist" meant something different from Codeforces'
 * Specialist would be lying to the person using it. `cfRank` is the exact rank
 * name the site would show at that rating, so the tier rail and the profile
 * badge can never disagree.
 *
 * `max: null` on the last tier is deliberate — the ladder has a floor and no
 * ceiling, which is also true of the thing it models.
 *
 * `focus` is what the tier is *for*, in one line. It is what the tier header
 * renders and what the coach is told, so someone landing on Tier 3 knows why
 * they are there rather than only that the numbers went up.
 */
export const CP_TIERS = Object.freeze([
  {
    slug: 'newbie',
    label: 'Foundations',
    order: 0,
    min: 800,
    max: 1000,
    cfRank: 'Newbie',
    colour: 'grey',
    focus:
      'Read the statement, write the loop, print the answer. Speed and correctness on problems with no trick in them.',
  },
  {
    slug: 'pupil',
    label: 'Pupil',
    order: 1,
    min: 1100,
    max: 1300,
    cfRank: 'Pupil',
    colour: 'green',
    focus:
      'One observation stands between you and the answer. Greedy exchange, prefix sums, sorting, and the habit of proving the greedy before you code it.',
  },
  {
    slug: 'specialist',
    label: 'Specialist',
    order: 2,
    min: 1400,
    max: 1500,
    cfRank: 'Specialist',
    colour: 'cyan',
    focus:
      'The standard toolkit becomes automatic — binary search on the answer, DSU, BFS/DFS, basic DP. This is where most people stall, and where the ramp is widest.',
  },
  {
    slug: 'expert',
    label: 'Expert',
    order: 3,
    min: 1600,
    max: 1800,
    cfRank: 'Expert',
    colour: 'blue',
    focus:
      'Two ideas per problem instead of one. Segment trees, DP on trees, shortest paths with a twist, and constructive problems you have to invent rather than recall.',
  },
  {
    slug: 'candidate-master',
    label: 'Candidate Master',
    order: 4,
    min: 1900,
    max: 2100,
    cfRank: 'Candidate Master',
    colour: 'violet',
    focus:
      'Heavy machinery, used precisely. Bitmask and digit DP, lazy propagation, binary lifting, SCC, string hashing, offline queries.',
  },
  {
    slug: 'master',
    label: 'Master',
    order: 5,
    min: 2200,
    max: 2400,
    cfRank: 'Master',
    colour: 'orange',
    focus:
      'Flows, DP optimisations, polynomial techniques, tree decompositions. Problems where the technique is known and the reduction to it is the whole difficulty.',
  },
  {
    slug: 'advanced',
    label: 'Advanced',
    order: 6,
    min: 2500,
    max: null,
    cfRank: 'International Master +',
    colour: 'red',
    focus:
      'Geometry, persistence, randomisation, and the problems that do not fit a named technique at all. Past this point the ladder stops being a list and starts being a habit.',
  },
]);

export const CP_TIER_SLUGS = CP_TIERS.map((t) => t.slug);

const BY_SLUG = new Map(CP_TIERS.map((t) => [t.slug, t]));

export const tierBySlug = (slug) => BY_SLUG.get(slug) || null;

export const tierLabel = (slug) => BY_SLUG.get(slug)?.label || slug;

/**
 * Which rung a rating sits on.
 *
 * Bands are contiguous by construction — 1000 then 1100, 1300 then 1400 — but
 * Codeforces rounds problem ratings to hundreds while *user* ratings are exact,
 * so 1050 and 1350 are real inputs from a linked handle even though no problem
 * carries them. Comparing against `min` from the top down puts those in the tier
 * below rather than dropping them, which is the honest answer: 1350 is a Pupil
 * who is nearly a Specialist, not a Specialist.
 *
 * Under the floor answers the first tier rather than null. A 400-rated account
 * is at the start of the ladder, and a rail that renders nothing for them is a
 * worse answer than one that renders the first rung.
 */
export function tierForRating(rating) {
  if (!Number.isFinite(rating)) return null;
  for (let i = CP_TIERS.length - 1; i >= 0; i -= 1) {
    if (rating >= CP_TIERS[i].min) return CP_TIERS[i];
  }
  return CP_TIERS[0];
}

/**
 * Codeforces' rank names, by rating, for a *user*.
 *
 * Deliberately finer than the tier list: the ladder collapses Master and
 * International Grandmaster into one rung because the problems there are not
 * meaningfully different to a learner, while the badge next to someone's handle
 * has to say exactly what the site says. Two different questions, two lists.
 */
const CF_RANKS = Object.freeze([
  { min: 3000, name: 'Legendary Grandmaster', colour: 'lgm' },
  { min: 2600, name: 'International Grandmaster', colour: 'gm' },
  { min: 2400, name: 'Grandmaster', colour: 'gm' },
  { min: 2300, name: 'International Master', colour: 'im' },
  { min: 2200, name: 'Master', colour: 'master' },
  { min: 1900, name: 'Candidate Master', colour: 'cm' },
  { min: 1600, name: 'Expert', colour: 'expert' },
  { min: 1400, name: 'Specialist', colour: 'specialist' },
  { min: 1200, name: 'Pupil', colour: 'pupil' },
  { min: 0, name: 'Newbie', colour: 'newbie' },
]);

export const cfRank = (rating) =>
  Number.isFinite(rating) ? CF_RANKS.find((r) => rating >= r.min) : null;
