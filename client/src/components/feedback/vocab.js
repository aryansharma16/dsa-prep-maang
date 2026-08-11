/**
 * The words on the feedback form and in its lists.
 *
 * The lists themselves live on the server — `FEEDBACK_TYPES` and
 * `FEEDBACK_STATUSES` in models/Feedback.js are what a submission is validated
 * against, and they ride down with every list response. What is kept here is the
 * part the server has no business knowing: the order the options are offered in
 * and the sentence a person reads, exactly the arrangement store/modules.js uses
 * for the side menu.
 */

/**
 * The `note` lines matter more than they look.
 *
 * The difference between a bug and a complaint is not obvious, and somebody
 * guessing wrong sends their bug report to the wrong queue. Dropdown renders
 * `note` as a second line under the label, so the distinction gets explained
 * where the choice is made rather than in a paragraph above the field nobody
 * reads.
 */
export const FEEDBACK_TYPES = [
  { value: 'suggestion', label: 'Suggestion', note: 'Something you would like this to do' },
  { value: 'bug', label: 'Bug', note: 'Something that is broken or wrong' },
  { value: 'complaint', label: 'Complaint', note: 'Something that works but gets in your way' },
  { value: 'other', label: 'Something else', note: 'Anything that does not fit the three above' },
];

export const TYPE_LABEL = Object.fromEntries(FEEDBACK_TYPES.map((t) => [t.value, t.label]));

/*
  "Waiting", not "Open", for the `open` status.

  The stored value stays `open` — it is the server's enum and reads correctly in
  the API and the audit log. The word a person sees is different because "Open"
  is also a verb, and on a badge shaped like a control it was read as one: people
  clicked it expecting a submission to open. "Waiting" cannot be an instruction,
  and it matches the count in the queue's filter bar.
*/
export const STATUS_LABEL = {
  open: 'Waiting',
  in_review: 'Being read',
  planned: 'Planned',
  resolved: 'Done',
  declined: 'Not planned',
};

/**
 * What each status means to the person who submitted it.
 *
 * "Planned" and "Done" are the same word to the team and two very different
 * promises to a reader, so each one says which it is.
 */
export const STATUS_NOTE = {
  open: 'Nobody has picked this up yet',
  in_review: 'Somebody is looking at it',
  planned: 'Accepted, not built yet',
  resolved: 'Done, or answered',
  declined: 'Read, and we are not doing it',
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({
  value,
  label,
  note: STATUS_NOTE[value],
}));

/** The two statuses that are the end of the conversation, not a step in it. */
export const CLOSED_STATUSES = ['resolved', 'declined'];

// Kept level with the maxlengths on the schema. A form that lets you type past
// what the server will accept is a form that throws your paragraph away.
export const MAX_TITLE = 140;
export const MAX_MESSAGE = 4000;
