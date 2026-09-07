/**
 * Why you flagged something for revision, and what that reads as.
 *
 * A mirror of `REVISION_FLAGS` in server/src/config/revision.js, kept here for
 * the reason the attempt outcome table is: the server owns which values are
 * legal and what they do, this owns what they are called.
 *
 * The six are not shades of one feeling. Each is a different next action, which
 * is the whole point of asking — three weeks later "I flagged this" tells you
 * nothing, and "I flagged this because I did not know what a monotonic stack
 * was" tells you what to go and read:
 *
 *   later         nothing is wrong; the clock ran out
 *   learn-first   blocked on something you do not know yet
 *   shaky         it went in, and it would not go in again cold
 *   slow          it works and it is not the answer they want
 *   redo          you want to write it again from nothing
 *   important     nothing is wrong and you want it kept warm anyway
 *
 * `''` is a real value and means "flagged, reason not given" — the `r` shortcut
 * on the roadmap raises a flag without opening anything, and it has to stay that
 * fast. Rows flagged before this shipped read the same way.
 */
export const REVISION_FLAGS = [
  {
    value: 'later',
    label: 'Do it later',
    short: 'Later',
    hint: 'Nothing went wrong — the session ended. A bookmark, not a failure',
  },
  {
    value: 'learn-first',
    label: 'Learn something first',
    short: 'Learn first',
    hint: 'Blocked on a technique you have not covered yet. Read before you retry',
  },
  {
    value: 'shaky',
    label: 'Got it, barely',
    short: 'Shaky',
    hint: 'It went in this time and it would not go in cold tomorrow',
  },
  {
    value: 'slow',
    label: 'Too slow',
    short: 'Slow',
    hint: 'It passed and it is not the complexity they are asking for',
  },
  {
    value: 'redo',
    label: 'Redo from scratch',
    short: 'Redo',
    hint: 'You want to write it again from nothing, without the last version in view',
  },
  {
    value: 'important',
    label: 'Keep it warm',
    short: 'Important',
    hint: 'A pattern worth coming back to on purpose, however well it went',
  },
];

const BY_VALUE = Object.fromEntries(REVISION_FLAGS.map((f) => [f.value, f]));

/** Null for `''` — "not said" draws nothing, rather than a chip saying nothing. */
export const revisionFlagOf = (value) =>
  value ? BY_VALUE[value] || { value, label: value, short: value, hint: '' } : null;

/** The cap the server enforces on the line attached to a flag. */
export const REVISION_NOTE_MAX = 500;
