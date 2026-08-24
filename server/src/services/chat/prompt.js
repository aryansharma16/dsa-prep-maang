import { Problem } from '../../models/Problem.js';
import { Progress } from '../../models/Progress.js';

/**
 * What the assistant is told about itself, and about the problem on screen.
 *
 * The instructions are blunt and mostly negative because the failure mode of a
 * chat model given a study context is not being wrong — it is being long. Ask a
 * capable model what a hash map is and it will write you a tutorial with
 * headings. Someone who is mid-problem and typed one question wanted one
 * answer, and the tutorial costs them their place.
 *
 * Terseness is asked for here and enforced elsewhere: max_tokens 700,
 * temperature 0.3, and MINIMAL thinking on Gemini. Prompts leak; limits do not.
 */

export const SYSTEM = `You are the study assistant inside a DSA interview-prep app. You answer quick questions from someone working through algorithm problems, and from the Learn reference in the same app.

You cover: language syntax, what a data structure or algorithm does, time and space complexity, short code snippets, standard system-design vocabulary, core computer-science concepts, and web and framework fundamentals — React, JavaScript, the DOM, Node, HTTP, SQL. A question about a React hook is in scope and gets a straight answer, not a redirection back to algorithms.

How you answer:
- Short. Two to six sentences, or one code block with a one-line explanation.
- Answer first. No preamble, no restating the question, no "great question".
- Every code block carries a language tag. Match the language they used; use Python if they gave no signal.
- Give complexity as O(...) only where it is actually relevant. Write it as plain text — O(n log n), never $O(n \\log n)$. There is no maths renderer here, so LaTeX and dollar delimiters reach the reader as literal punctuation.
- Plain markdown: fenced code, short lists, bold sparingly. No headings.
- If you are not sure, say so in one line instead of guessing at length.

Solutions:
- When they ask how to approach a problem, give the idea, the pattern, or the next step — not the finished code.
- If they then ask for the full solution outright, give it to them without arguing. They know what they are working on.
- Never volunteer a complete solution to a problem they have not solved.

Out of scope:
- Anything that is not programming, computer science or interview preparation. Say in one sentence that you only cover those, and stop.`;

/**
 * The auto-namer's brief. Separate from SYSTEM because it is a different job
 * with different rules, and appending "also, sometimes, write a title" to a
 * prompt about answering questions is how you get titles that answer questions.
 */
export const TITLE_SYSTEM =
  'You write short titles for saved conversations. Six words or fewer. No quotes, no trailing punctuation, no preamble. Reply with the title alone.';

/**
 * Context for an attached problem, as its own system turn.
 *
 * Deliberately about sixty tokens, and deliberately not the statement.
 * `descriptionHtml` is many kilobytes of markup per problem — the roadmap
 * endpoint already excludes it for exactly this reason — and shipping it would
 * multiply the cost of every message in an attached thread to answer questions
 * that mostly are not about the statement.
 *
 * The Progress join is the part that earns its place: knowing they have already
 * solved this is what lets the assistant answer differently, for one indexed
 * read.
 *
 * Returns null when the problem does not exist *or is not theirs to see* — the
 * `owner` filter is what stops a problem id from being a way to read other
 * people's custom problems.
 */
export async function problemContext(problemId, userId) {
  if (!problemId) return null;

  const problem = await Problem.findOne({
    _id: problemId,
    $or: [{ owner: null }, { owner: userId }],
  })
    .select('slug title lcId difficulty patternSlug topicTags')
    .lean();

  if (!problem) return null;

  const progress = await Progress.findOne({ user: userId, problem: problem._id })
    .select('status confidence')
    .lean();

  const lines = [
    'The user is working on this problem:',
    `Title: ${problem.title}${problem.lcId ? ` (LeetCode ${problem.lcId})` : ''}`,
    `Difficulty: ${problem.difficulty}`,
    `Pattern: ${problem.patternSlug}`,
  ];
  if (problem.topicTags?.length) lines.push(`Tags: ${problem.topicTags.slice(0, 5).join(', ')}`);
  lines.push(
    progress
      ? `Their status: ${progress.status}, confidence ${progress.confidence}/5`
      : 'Their status: not started',
  );

  return { text: lines.join('\n'), slug: problem.slug, title: problem.title, id: problem._id };
}

/**
 * The starter questions the empty chat offers.
 *
 * Served from here rather than hardcoded in the client for the same reason the
 * motivation triggers are: changing what the assistant suggests should not need
 * a frontend deploy.
 */
export const SUGGESTIONS = Object.freeze([
  'What is a monotonic stack?',
  'Explain two pointers with an example',
  'When do I use BFS over DFS?',
  'What does O(n log n) actually mean?',
]);
