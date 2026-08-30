import { PATTERNS } from './patterns.js';

/**
 * The AI-recommended sheet — 300 of the 517, chosen for coverage per hour.
 *
 * The other four sheets in this curriculum are imported: Striver's SDE list,
 * NeetCode 150, Blind 75 and whatever was reported asked in 2025-26. This one
 * is computed here, from the curated rows themselves, and it answers a question
 * none of the others do — *if you only have time for three hundred, which three
 * hundred?*
 *
 * ---------------------------------------------------------------------------
 * The idea it is built on
 *
 * Marginal value, not absolute value. The eleventh sliding-window problem is
 * not worth what the second one is, because by then you own the template and
 * are only re-typing it. So a problem is worth picking when it is either the
 * best representative of a technique nobody has covered yet, or so heavily
 * asked that skipping it is a risk on its own.
 *
 * That is implemented as a greedy pass with diminishing returns: every pick
 * multiplies the score of everything sharing its technique by REPEAT, so the
 * third problem in a cluster has to be roughly three times as good as the
 * first one in an untouched cluster to beat it. It is what stops the list
 * being 44 array problems and 8 graph problems.
 *
 * ---------------------------------------------------------------------------
 * What the score is made of, and why each part is there
 *
 *   canon    Being on a list that survived someone else's curation is the
 *            strongest single signal available, and the three lists are not
 *            equal. Blind 75 is the tightest — 69 problems that have stayed
 *            useful for a decade. NeetCode 150 is next and is weighted above
 *            Striver's 191 for this sheet specifically, because it is the one
 *            organised around *patterns* rather than days, which is the same
 *            axis this sheet is selecting on.
 *
 *   demand   How many companies ask it, and how many asked it recently. Both,
 *            not either: breadth says the problem is a standard, recency says
 *            it has not fallen out of rotation. Recency is capped so a problem
 *            reported at eleven companies does not outweigh a whole technique.
 *
 *   quality  LeetCode's like ratio, as a proxy for "is this problem well posed
 *            or is it a trick". A 45%-liked problem usually has an ambiguous
 *            statement or one unguessable insight, and neither teaches a
 *            pattern. Neutral rather than negative when unknown — the 61 GFG
 *            rows carry no votes and should not be punished for it twice.
 *
 *   shape    Mediums are what interviews are made of. Easies earn a little,
 *            because a pattern needs an on-ramp and they are cheap. Hards earn
 *            nothing here — they are three times the time of a medium, so a
 *            Hard has to justify itself through demand or through being the
 *            only representative of its technique.
 *
 * ---------------------------------------------------------------------------
 * The budgets are hand-set, and that is the point
 *
 * A proportional split would hand arrays-hashing 26 slots because the roadmap
 * happens to hold 44 of them, and tries 8 because it holds 13. But tries is
 * four techniques and arrays-hashing is closer to twelve, and neither number
 * has anything to do with how many rows were curated. So the quota below is a
 * judgement about how many problems it takes to *own* a pattern, checked
 * against how much of an interview loop that pattern actually decides.
 *
 * They sum to exactly the target. Change one and change another.
 */

/** Slots per pattern. Sums to 300. */
const BUDGET = {
  // The on-ramp, and the pattern with the most genuinely distinct tricks:
  // frequency maps, set membership, sorting-as-a-tool, index maps, matrix work.
  'arrays-hashing': 24,
  // The heaviest single pattern in an interview loop, and the one with the most
  // real sub-techniques: traversal orders, construction from traversals, path
  // sums, LCA, views, serialisation. Depth here pays for itself.
  trees: 27,
  // Two budgets because they are two skills. 1-D is state design; 2-D is
  // deciding what the second axis even is.
  'dp-1d': 20,
  'dp-2d': 17,
  // BFS, DFS, union-find, topological sort, grids-as-graphs — and grids are
  // where most interviews actually start.
  graphs: 20,
  // Dijkstra, Bellman-Ford, Floyd-Warshall, MST, advanced topo. One or two
  // each; nobody needs a fourth shortest-path problem.
  'advanced-graphs': 13,
  // The template, the on-answer variant, rotated arrays, 2-D, and the
  // partition trick. Off-by-ones are learned by repetition, so this runs a
  // little richer than its technique count suggests.
  'binary-search': 17,
  // Monotonic stack is one idea with many faces, plus parens, expression
  // evaluation and the design-flavoured ones.
  stack: 17,
  // Top-K, merge-K, running median, scheduling. Four ideas, and the rest are
  // re-runs of them.
  heap: 13,
  // One skeleton — choose, recurse, un-choose — over subsets, permutations,
  // combinations, grids and constraint boards. Budgeted for the shapes, not
  // for the skeleton.
  backtracking: 13,
  // Pointer surgery does not generalise from reading it, only from doing it:
  // reverse, cycle, merge, reorder, deep copy, and the design ones.
  'linked-list': 15,
  greedy: 12,
  'sliding-window': 12,
  'two-pointers': 12,
  /*
    Nine, not the fourteen its 19 rows would suggest. The string problems that
    matter are filed elsewhere — Valid Anagram and Group Anagrams under
    arrays-hashing, every window problem under sliding-window — and what is
    left here is parsing and trivia. Two of those slots went to dp-2d.
  */
  strings: 9,
  'prefix-sum': 11,
  bst: 10,
  // Real but low yield per hour: matrix mechanics and a little number theory.
  'math-geometry': 9,
  'bit-manipulation': 9,
  tries: 8,
  intervals: 8,
  /*
    Four, and it is the one budget cut for a reason outside the pattern: the
    design problems worth doing are filed under the structure they are built
    from. LRU and LFU are linked-list, Min Stack is stack, Median from Data
    Stream is heap, Insert Delete GetRandom is arrays-hashing. What is left
    under this slug is genuinely marginal, so it keeps four and the other three
    went where they buy more.
  */
  design: 4,
  /*
    Zero, deliberately. Six problems asked in a dedicated round at two companies
    that are not on most target lists, and not an algorithm pattern — the same
    call the Playbook makes about it. They stay on the roadmap; they are not
    part of anybody's shortest path.
  */
  concurrency: 0,
};

const SHEET = 'ai-300';

/**
 * Problems the score gets wrong, in both directions.
 *
 * A scoring pass over 517 rows is right most of the time and confidently wrong
 * in two places, so both are corrected by hand rather than by tuning weights
 * until the exceptions disappear — tuning to fix six rows moves three hundred.
 *
 * ALWAYS is for problems whose importance is not in the data. The five named
 * graph algorithms exist here only as Striver's bare implementation exercises:
 * no LeetCode id, no votes, no company tags, so they score near the floor while
 * being the entire point of the pattern they sit in. Same for 0-1 Knapsack and
 * Matrix Chain Multiplication, which are the two DP shapes every other 2-D DP
 * problem is a variation of. The rest are canon that the redundancy penalty
 * squeezed out because a neighbour got there first — the traversal bucket eats
 * Inorder, the level-order bucket eats Right Side View, and both are asked far
 * more often than what displaced them.
 *
 * NEVER is for rows that are not really problems (`striver-bfs` and
 * `striver-dfs` are topic stubs, not exercises), rows filed under the wrong
 * pattern by the classifier (Populating Next Right Pointers is a tree problem
 * sitting in binary-search), and exact re-runs of a template already covered —
 * Sqrt(x), Valid Perfect Square and The N-th Root of an Integer are one problem
 * written three times, and one slot is the honest price for it.
 *
 * Both are checked against the curated rows at build time, so a slug that stops
 * existing is a failed seed and not a silent no-op.
 */
const ALWAYS = new Set([
  /*
    Canon displaced by its own neighbours. Invert Binary Tree is the one Blind
    75 problem the greedy pass drops every time — Same Tree and Subtree of
    Another Tree reach the same-shape bucket first — and it is both the most
    famous easy tree problem there is and a genuinely different idea from
    either. Inorder loses to Preorder for iterative traversal and is the one
    that matters, because it is the link to every BST problem.
  */
  'invert-binary-tree',
  'binary-tree-inorder-traversal',
  'binary-tree-right-side-view',
  'binary-tree-zigzag-level-order-traversal',
  // The canonical BFS-shortest-path on a grid.
  'shortest-path-in-binary-matrix',
  // Lower/upper bound — the binary-search template every other variant is built
  // on — and the one problem that teaches search without a sorted array.
  'binary-search',
  'find-first-and-last-position-of-element-in-sorted-array',
  'find-peak-element',
  // Write these once from an empty file. The applied LeetCode versions in this
  // pattern (Network Delay Time, Min Cost to Connect All Points, Cheapest
  // Flights) hide the algorithm inside a story; these two do not, and no
  // applied problem in the picks covers all-pairs at all.
  'striver-dijkstra-s-algorithm',
  'striver-floyd-warshall-algorithm',
  // The two shapes the rest of 2-D DP is a variation of.
  'striver-0-1-knapsack',
  'striver-matrix-chain-multiplication',
  'longest-palindromic-subsequence',
  // Pointer surgery that no amount of reading substitutes for.
  'reverse-nodes-in-k-group',
]);

const NEVER = new Set([
  // Topic stubs rather than exercises — the pattern already teaches both.
  'striver-bfs',
  'striver-dfs',
  // One template, written three times. Sqrt(x) keeps the slot.
  'valid-perfect-square',
  'striver-the-n-th-root-of-an-integer',
  // Filed under binary-search by the classifier; it is a tree problem.
  'populating-next-right-pointers-in-each-node',
  // Not binary trees, and not techniques anything else builds on.
  'flatten-nested-list-iterator',
  'maximum-binary-tree',
  'construct-quad-tree',
  // Third merge-sort-counting problem in one pattern, after Reverse Pairs and
  // Count of Smaller Numbers After Self. The third one is re-typing.
  'count-of-range-sum',
  // Preorder and Inorder cover iterative traversal. A third is re-typing.
  'binary-tree-postorder-traversal',
  // Trivial, and neither is a stack question — they are array questions.
  'striver-implement-stack-using-arrays',
  'striver-implement-queue-using-arrays',
  // Subsets is the same exercise with a judge attached.
  'striver-power-set-this-is-very-important',
  // A riddle about what you are not given, not a linked-list technique.
  'delete-node-in-a-linked-list',
]);

/** What each curated sheet is worth as evidence. See the header. */
const CANON = { 'blind-75': 12, 'neetcode-150': 8, 'striver-sde': 4.5, 'faang-2026': 1 };

/** Mediums are the currency; a Hard has to earn its slot some other way. */
const SHAPE = { Medium: 1.5, Easy: 0.6, Hard: 0 };

/** Score multiplier for each pick already taken from the same technique. */
const REPEAT = 0.55;

/** A tag this common inside a pattern says nothing about which technique it is. */
const UBIQUITOUS = 0.45;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * What this problem *teaches*, as a key, so two problems that teach the same
 * thing can be recognised as the same thing.
 *
 * Derived from the LeetCode topic tags with the pattern's own dominant tags
 * removed: inside `sliding-window`, "Sliding Window" is on nearly every row and
 * separates nothing, while "Monotonic Queue" or "Prefix Sum" is exactly the
 * distinction worth spending a slot on. Rows with no tags at all — the GFG
 * entries carry none — collapse into one bucket, which is the right default:
 * they are Striver's list, they are not independently evidenced, and the second
 * one is worth much less than the first.
 */
function techniqueKeys(problems) {
  const seen = new Map();
  for (const p of problems) for (const tag of p.topicTags || []) seen.set(tag, (seen.get(tag) || 0) + 1);
  const common = new Set(
    [...seen.entries()].filter(([, n]) => n / problems.length >= UBIQUITOUS).map(([tag]) => tag),
  );
  const keys = new Map();
  for (const p of problems) {
    const rest = (p.topicTags || []).filter((t) => !common.has(t)).sort();
    keys.set(p.slug, rest.length ? rest.join('|') : 'core');
  }
  return keys;
}

/** How much this problem is worth before any redundancy is taken off. */
function score(p) {
  const canon = (p.sheets || []).reduce((n, s) => n + (CANON[s.sheet] || 0), 0);
  const demand =
    0.3 * Math.min((p.companies || []).length, 20) +
    0.6 * Math.min((p.askedRecently || []).length, 6);
  // Unknown ratio is 0 in the data, which must read as "no evidence" and not as
  // "universally disliked" — the GFG rows would all be scored at the floor.
  const quality = p.likeRatio ? clamp((p.likeRatio - 72) / 9, -3, 3) : 0;
  return canon + demand + quality + (SHAPE[p.difficulty] || 0);
}

/**
 * Pick one pattern's share.
 *
 * Greedy rather than "sort and take the top N", because the ranking changes as
 * you pick: taking Longest Substring Without Repeating Characters should make
 * the next hash-map window problem cheaper to skip, and sorting once cannot
 * express that.
 */
function pickPattern(all, budget) {
  if (budget <= 0) return [];
  const problems = all.filter((p) => !NEVER.has(p.slug));
  const keys = techniqueKeys(problems);
  const base = new Map(problems.map((p) => [p.slug, score(p)]));
  const taken = new Map();
  const chosen = [];

  /*
    Forced picks go in first and pay for themselves out of the same budget —
    they are not extras on top of it. Their technique keys are marked taken, so
    forcing Inorder Traversal in correctly makes the next traversal problem
    cheaper to skip rather than leaving the greedy pass to pick it anyway.
  */
  const pool = problems.filter((p) => !ALWAYS.has(p.slug));
  for (const p of problems.filter((x) => ALWAYS.has(x.slug)).sort((a, b) => score(b) - score(a))) {
    if (chosen.length >= budget) break;
    chosen.push(p);
    taken.set(keys.get(p.slug), (taken.get(keys.get(p.slug)) || 0) + 1);
  }

  while (chosen.length < budget && pool.length) {
    let best = null;
    let bestValue = -Infinity;
    for (const p of pool) {
      const value = base.get(p.slug) * REPEAT ** (taken.get(keys.get(p.slug)) || 0);
      if (value > bestValue) {
        bestValue = value;
        best = p;
      }
    }
    chosen.push(best);
    taken.set(keys.get(best.slug), (taken.get(keys.get(best.slug)) || 0) + 1);
    pool.splice(pool.indexOf(best), 1);
  }
  return chosen;
}

/**
 * Stamp the sheet onto the curated list, in place, and hand back a summary.
 *
 * Additive by contract: it only ever pushes onto `sheets`, so a problem's
 * membership of the four imported sheets is untouched and nothing is removed
 * from the roadmap. `order` is the rank inside its pattern, which is what makes
 * the sheet readable as a sequence rather than a set.
 */
export function assignAiSheet(problems) {
  /*
    A hand-listed slug that no longer exists is a silent no-op otherwise: the
    sheet quietly loses a problem it was written to contain, and nothing says
    so until somebody counts. Curation renames slugs often enough for this to
    be worth a hard failure.
  */
  const known = new Set(problems.map((p) => p.slug));
  const missing = [...ALWAYS, ...NEVER].filter((slug) => !known.has(slug));
  if (missing.length) {
    throw new Error(`[ai-sheet] unknown slugs in ALWAYS/NEVER: ${missing.join(', ')}`);
  }

  /* Idempotent, because it mutates: curate.js calls it once on a freshly built
     list, but a second call on the same array would otherwise stamp every pick
     twice and leave the roadmap claiming 600 memberships. */
  for (const p of problems) p.sheets = p.sheets.filter((s) => s.sheet !== SHEET);

  const byPattern = new Map();
  for (const p of problems) {
    if (!byPattern.has(p.patternSlug)) byPattern.set(p.patternSlug, []);
    byPattern.get(p.patternSlug).push(p);
  }

  /* The sheet is organised by pattern, so the group is the pattern's display
     name — the same kind of label Striver's days and NeetCode's sections carry
     in this field, rather than the raw slug the Sheet-section column would
     otherwise print. */
  const names = new Map(PATTERNS.map((x) => [x.slug, x.name]));

  const summary = [];
  for (const [pattern, rows] of byPattern) {
    const budget = BUDGET[pattern] ?? 0;
    const chosen = pickPattern(rows, budget);
    chosen.forEach((p, i) => {
      p.sheets.push({ sheet: SHEET, group: names.get(pattern) || pattern, order: i });
    });
    summary.push({ pattern, budget, picked: chosen.length, of: rows.length, chosen });
  }
  return summary;
}

export const AI_SHEET = SHEET;
export const AI_BUDGET = BUDGET;
