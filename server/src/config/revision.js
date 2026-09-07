/**
 * Why a problem is in your revision queue when you put it there by hand.
 *
 * The schedule needs no explanation — a row is due because a date passed. A row
 * you flagged yourself is the opposite: three weeks later it is a title with no
 * reason attached, and "I flagged this for something" is not a reason you can
 * act on. Half of them turn out to be "I want the O(n) version", half are "I do
 * not know what a monotonic stack is yet", and those are different mornings'
 * work.
 *
 * So the flag carries two things now: one of these categories, and a line of
 * your own. The category is what the queue groups and filters by; the line is
 * what actually tells you what you meant.
 *
 * Slugs, not labels — these go into everybody's history the moment the first one
 * is written, and the wording on screen belongs to the client for the same
 * reason the attempt outcomes' does. See client/src/components/problem/
 * revisionFlags.js, which is the mirror.
 *
 * `''` is a real value and means "flagged, reason not given". Flagging must stay
 * one click away for the case where you are mid-problem and do not want a
 * dialog — see the `r` shortcut on the roadmap — so a flag with no category has
 * to be storable.
 */
export const REVISION_FLAGS = ['later', 'learn-first', 'shaky', 'slow', 'redo', 'important'];

/**
 * How long the line attached to a flag may be.
 *
 * Short on purpose. This is "come back for the O(n) version, the heap one is in
 * the notes" — a pointer to your own thinking, not a place to write the
 * thinking down. That is what the problem's notes are for, and they hold 20,000
 * characters.
 */
export const REVISION_NOTE_MAX = 500;

/** Whether a value may be stored in `revisionReason`. `''` is legal — see above. */
export const isRevisionFlag = (value) => value === '' || REVISION_FLAGS.includes(value);

/**
 * How many not-yet-due rows the queue endpoints ship alongside the due ones.
 *
 * The queue answers "what do I work this morning", and it always has. It could
 * not answer "when does this come back" or "what is next week like", because a
 * row not yet due was simply absent — the schedule existed only as a date on a
 * row you could not see until the day it fired.
 *
 * Thirty is about a month of an ordinary account's schedule, which is as far
 * ahead as a forecast is worth reading. It is a cap and not a window: fifty rows
 * due on one day would fill it, and the honest answer to "what is coming" is
 * then the next thirty of them.
 */
export const UPCOMING_LIMIT = 30;
