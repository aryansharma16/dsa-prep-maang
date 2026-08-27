import { CPProblem } from '../../models/CPProblem.js';
import { CPProfile } from '../../models/CPProfile.js';
import { CPProgress } from '../../models/CPProgress.js';
import { tierBySlug, tierForRating } from '../../config/cpTiers.js';

/**
 * The competitive-programming coach.
 *
 * A separate persona from the interview assistant rather than a paragraph
 * appended to it, because the two are asked genuinely different questions.
 * Someone on the roadmap wants to know what a monotonic stack is. Someone on the
 * ladder knows what one is, is staring at a 1600 they cannot crack, and wants
 * the observation — not the algorithm name, and not the code.
 *
 * That difference is why the spoiler rule here is stricter than the roadmap's.
 * On an interview problem, handing over the solution costs a practice rep. On a
 * rated problem somebody is actively working, it costs the thing they came for:
 * the experience of finding it. So the default is one nudge, and going further
 * takes being asked.
 *
 * Terseness is asked for here and enforced elsewhere — max_tokens, temperature
 * and thinking budget are set in the chat service. Prompts leak; limits do not.
 */
export const CP_SYSTEM = `You are the competitive-programming coach inside a CP training app. The person you are talking to is working through a rated problem ladder on Codeforces and CodeChef, trying to climb from Newbie towards Expert and beyond.

You cover: algorithmic observations, invariants, complexity budgets, C++ and Java implementation detail, contest strategy, and how to practise. You assume they can already code — they are stuck on the idea, not the syntax.

How you answer:
- Short. Two to six sentences, or one code block with a one-line explanation.
- Answer first. No preamble, no restating the question, no "great question".
- Talk in observations and invariants, not in the names of techniques. "The array is sorted, so the leftmost valid index only moves right" beats "use two pointers".
- Complexity as plain text — O(n log n), never LaTeX or dollar delimiters. There is no maths renderer here.
- Every code block carries a language tag. C++ unless they used Java.
- Plain markdown: fenced code, short lists, bold sparingly. No headings.
- If you are not sure, say so in one line rather than guessing at length.

Hints, in order. Give exactly one step and stop:
1. What to notice about the input or the constraints.
2. The observation that makes the problem small.
3. The technique, named.
4. The recurrence, the invariant, or the loop shape.
5. The full solution.
Start at the level they are asking from. If they say they are completely stuck, start at 1. Only go further when they ask again.

Solutions:
- Never volunteer a full solution to a problem they have not solved. This is a rated problem they are actively working; handing it over costs them the thing they came for.
- If they ask outright for the solution, give it. They know what they are working on.
- If their status says solved, discuss it freely — including alternative approaches and why the intended one is the intended one.

Ratings and progression:
- A problem rated more than about 200 above their current rating is a stretch problem. Say so, and coach it as a learning exercise rather than as something they should be getting quickly.
- A problem at or below their rating that they cannot crack is worth 20-30 minutes, then the editorial. Say that plainly — reading the editorial after a real attempt is how people improve, not a failure.
- Do not predict rating gains or promise outcomes.

Language specifics worth volunteering when relevant: integer overflow and when to reach for __int128, fast I/O, unordered_map anti-tests on Codeforces, comparator strict-weak-ordering rules, recursion depth on large trees.

Out of scope:
- Anything that is not programming, computer science or competitive programming. Say in one sentence that you only cover those, and stop.
- Never help with a contest that is currently running. If they mention a live round, say you cannot help until it ends.`;

/**
 * The starter questions the empty CP chat offers.
 *
 * Served from here rather than hardcoded in the client for the same reason the
 * roadmap's are: changing what the coach suggests should not need a frontend
 * deploy. Phrased as things a person on a ladder actually asks, which is mostly
 * about *how to practise* rather than about a specific algorithm.
 */
export const CP_SUGGESTIONS = Object.freeze([
  'How long should I stay stuck before reading the editorial?',
  'What should I practise to get from 1200 to 1400?',
  'Why is my greedy wrong on test 6?',
  'How do I know a problem is binary search on the answer?',
]);

/**
 * Context for an attached CP problem, as its own system turn.
 *
 * Around eighty tokens, and deliberately not the statement — Codeforces
 * statements are long, we do not mirror them, and most questions are not about
 * the wording anyway.
 *
 * The two joins earn their place. Knowing they have already solved it is what
 * lets the coach discuss the solution rather than refuse to; knowing their *live
 * Codeforces rating* is what lets it say "this is 250 above you, treat it as a
 * stretch" instead of answering in a vacuum. That second one is the difference
 * between a chatbot and a coach.
 *
 * Returns null when the problem does not exist *or is not theirs to see* — the
 * `owner` filter is what stops a problem id being a way to read other people's
 * private additions.
 */
export async function cpProblemContext(problemId, userId) {
  if (!problemId) return null;

  const problem = await CPProblem.findOne({
    _id: problemId,
    $or: [{ owner: null }, { owner: userId }],
  })
    .select('slug title platform difficulty patternSlug tier topicTags codeforces codechef')
    .lean();

  if (!problem) return null;

  const [progress, profile] = await Promise.all([
    CPProgress.findOne({ user: userId, problem: problem._id })
      .select('status confidence solvedOnPlatform attempts')
      .lean(),
    CPProfile.findOne({ user: userId }).select('rating handle').lean(),
  ]);

  const lines = ['The user is working on this problem:', `Title: ${problem.title}`];

  if (problem.platform === 'codeforces' && problem.codeforces) {
    const cf = problem.codeforces;
    lines.push(
      `Codeforces ${cf.contestId}${cf.index}` +
        (cf.rating ? `, rated ${cf.rating}` : '') +
        (cf.division ? `, ${cf.division}` : ''),
    );
    if (cf.contestName) lines.push(`Contest: ${cf.contestName}`);
  } else if (problem.platform === 'codechef' && problem.codechef) {
    const cc = problem.codechef;
    lines.push(
      `CodeChef ${cc.code}` +
        (cc.difficultyRating ? `, difficulty ${cc.difficultyRating}` : '') +
        (cc.division ? `, ${cc.division}` : ''),
    );
  }

  lines.push(`Pattern: ${problem.patternSlug}`);
  lines.push(`Ladder tier: ${tierBySlug(problem.tier)?.label || problem.tier}`);

  /*
    Our topics, never the platform's tags.

    A Codeforces tag list is the editorial's answer key — "dp, bitmasks" on an
    unsolved problem is most of the solution. The UI hides them behind a toggle
    for exactly that reason, and putting them in the model's context would hand
    over through the coach what the interface deliberately withholds.
  */
  if (problem.topicTags?.length) lines.push(`Topics: ${problem.topicTags.slice(0, 4).join(', ')}`);

  const attempts = progress?.attempts?.length || 0;
  if (progress) {
    lines.push(
      `Their status: ${progress.status}, confidence ${progress.confidence}/5` +
        (attempts ? `, ${attempts} logged attempt${attempts === 1 ? '' : 's'}` : '') +
        (progress.solvedOnPlatform ? ', accepted on the judge' : ''),
    );
  } else {
    lines.push('Their status: not started');
  }

  /*
    The line that makes the coaching specific. Both halves are stated — the
    rating and the gap — because the model should not be doing arithmetic to
    decide whether to call something a stretch problem.
  */
  if (Number.isFinite(profile?.rating)) {
    const tier = tierForRating(profile.rating);
    lines.push(`Their Codeforces rating: ${profile.rating} (${tier?.label || 'unrated'})`);
    const target = problem.codeforces?.rating;
    if (target) {
      const gap = target - profile.rating;
      lines.push(
        gap > 200
          ? `This problem is ${gap} above their rating — a stretch problem.`
          : gap < -200
            ? `This problem is ${-gap} below their rating — they should be getting this.`
            : 'This problem is around their current rating.',
      );
    }
  } else {
    lines.push('They have not linked a Codeforces handle, so their rating is unknown.');
  }

  return {
    text: lines.join('\n'),
    slug: problem.slug,
    title: problem.title,
    id: problem._id,
  };
}
