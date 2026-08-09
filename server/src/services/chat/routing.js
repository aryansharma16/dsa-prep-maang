/**
 * Which kind of question is this, so Auto can pick a model that suits it.
 *
 * A heuristic, deliberately, and not a model call. Asking an LLM which LLM to
 * use costs one request out of the same allowance the answer needs — on a free
 * tier of twenty per model per day that is a tax of fifty percent — and it adds
 * a full round trip in front of the first token, which is the one delay a
 * reader actually feels. The classification below is a few regexes over one
 * message and takes microseconds. It will occasionally send a code question to
 * a general model, and the cost of being wrong is a slightly worse answer, not
 * a failed one.
 *
 * The other half of Auto's decision is availability, and that lives in the
 * registry: a perfect match that is out of requests until midnight is not a
 * match. See candidatesFor().
 */

/** Asking for something to be written, or holding code up to be looked at. */
const CODE = /\b(code|implement|write|snippet|syntax|function|method|class|compile|debug|refactor|solution|program)\b|```|\bin (python|java|c\+\+|cpp|javascript|typescript|go|rust|kotlin|c#)\b/i;

/** Asking why, or for a comparison — the answers that reward a better model. */
const REASONING = /\b(why|prove|derive|trade[- ]?offs?|compare|difference between|when (would|should)|how does .* work|explain how|walk me through|complexity of|optimi[sz]e)\b/i;

/** Definition-shaped, and short. The cheapest model answers these perfectly. */
const LOOKUP = /^\s*(what('| i)s|what are|define|meaning of|is a|does)\b/i;

/**
 * @returns {'code'|'reasoning'|'lookup'|'general'}
 */
export function classifyTask(content, { hasProblem = false } = {}) {
  const text = String(content || '');

  // An attached problem means the question is about writing or fixing code far
  // more often than not, and the model that handles code well is the safer bet
  // even when the wording is vague ("how do I do this one?").
  if (CODE.test(text) || hasProblem) return 'code';
  if (REASONING.test(text)) return 'reasoning';
  // Short and definition-shaped. The length check matters: "what is the
  // difference between a heap and a BST, and when does the choice actually
  // change the complexity" starts like a lookup and is not one.
  if (LOOKUP.test(text) && text.length < 120) return 'lookup';
  return 'general';
}

/**
 * How well a model suits a task, higher is better.
 *
 * Small numbers on purpose: this only ever reorders models that are already
 * available, so the difference between first and second place is which good
 * answer you get, never whether you get one.
 */
export function scoreModel(model, task) {
  const strengths = model.strengths || [];
  const tier = model.tier || 'balanced';
  let score = 0;

  if (task === 'code') {
    if (strengths.includes('code')) score += 3;
    if (tier === 'balanced') score += 2;
    // Deep models are better at code and slower to start. For a snippet the
    // balanced tier wins; this keeps them ahead of the lite models regardless.
    if (tier === 'deep') score += 1;
  } else if (task === 'reasoning') {
    if (strengths.includes('reasoning')) score += 3;
    if (tier === 'deep') score += 2;
    if (tier === 'balanced') score += 1;
  } else if (task === 'lookup') {
    // "What is a trie" does not need a frontier model. Take the one that starts
    // typing first and leave the good models' allowances for questions that
    // need them — on a per-model daily quota, that is the whole game.
    if (tier === 'fast') score += 3;
    if (tier === 'balanced') score += 1;
  } else {
    if (tier === 'balanced') score += 2;
    if (tier === 'fast') score += 1;
  }

  return score;
}
