/**
 * The four ways a review can go, and what each reads as.
 *
 * A mirror of `REVIEW_ANSWERS` in server/src/services/review.service.js, kept
 * here for the reason the attempt outcome table is: the server owns the
 * arithmetic and this owns the words. What the server will not tell you is that
 * the four are ordered worst to best on purpose — the row of buttons is a scale,
 * and a scale that runs left to right is one you can answer without reading.
 *
 * `missed` posts `result: 'missed'`; the other three post `result: 'recalled'`
 * with themselves as the grade. That split is the server's contract, not a
 * quirk: a lapse is a different event from a slow success, and only one of them
 * is evidence that you can do the problem.
 */
export const REVIEW_ANSWERS = [
  {
    value: 'missed',
    label: 'Missed',
    tone: 'bad',
    hint: 'Could not do it. Drops back a rung and comes round again tomorrow',
  },
  {
    value: 'hard',
    label: 'Hard',
    tone: 'warn',
    hint: 'Got there, slowly or by fighting for it. Stays on this rung',
  },
  {
    value: 'good',
    label: 'Good',
    tone: 'ok',
    hint: 'Came back to you and you wrote it. Up a rung, the plain gap',
  },
  {
    value: 'easy',
    label: 'Easy',
    tone: 'great',
    hint: 'Instant, and you would bet on it cold. Up a rung and twice the gap',
  },
];

/** What a click on one of the four sends. See the server's `reviewSchema`. */
export const answerBody = (answer, recall = '') => ({
  result: answer === 'missed' ? 'missed' : 'recalled',
  ...(answer === 'missed' ? {} : { grade: answer }),
  ...(recall.trim() ? { recall: recall.trim() } : {}),
});
