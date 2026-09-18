/**
 * The words on the screen for the keys the server stores.
 *
 * The server's `config/applications.js` owns the vocabulary — which values
 * exist, and what each one *means* for the funnel. This owns the half the
 * server has no business knowing: what to call them, in what order to draw
 * them, and which hue they wear. The same split `store/modules.js` makes for
 * the side menu.
 *
 * Every dropdown in the module is built from a list here, so there is exactly
 * one place a label lives. A key with no entry falls back to itself rather than
 * rendering blank — a new server value should look unfinished, not invisible.
 */

const label = (map) => (key) => map[key]?.label ?? map[key] ?? key ?? '';

/** `{ value, label, note }` — the shape `Dropdown` takes. */
const options = (map, keys = Object.keys(map)) =>
  keys.map((key) => ({ value: key, label: map[key].label, note: map[key].note }));

/* -------------------------------------------------------------------------- */
/* stages and lanes                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Nine stages, six lanes.
 *
 * `column` is duplicated from the server's table on purpose and is the only
 * duplication in this file. The board has to know which lane a card belongs in
 * before any request has landed — a card being dragged, a card just created —
 * and a round trip to find out would mean a card that flickers into the wrong
 * column first.
 */
export const STAGES = {
  wishlist: { label: 'Wishlist', column: 'wishlist', hue: 'slate' },
  applied: { label: 'Applied', column: 'applied', hue: 'blue' },
  screening: { label: 'Screening', column: 'screening', hue: 'sky' },
  in_process: { label: 'In Process', column: 'in_process', hue: 'violet' },
  offer: { label: 'Offer', column: 'offer', hue: 'amber' },
  accepted: { label: 'Accepted', column: 'offer', hue: 'green' },
  rejected: { label: 'Rejected', column: 'closed', hue: 'red' },
  ghosted: { label: 'Ghosted', column: 'closed', hue: 'orange' },
  withdrawn: { label: 'Withdrawn', column: 'closed', hue: 'pink' },
};

export const stageLabel = label(STAGES);
export const stageHue = (key) => STAGES[key]?.hue || 'slate';
export const columnOf = (key) => STAGES[key]?.column || 'applied';

/** The stages that share one lane, for the chip that picks between them. */
export const stagesInColumn = (columnKey) =>
  Object.keys(STAGES).filter((key) => STAGES[key].column === columnKey);

/**
 * Whether a lane needs the card to say which stage it is.
 *
 * Only the two that hold more than one. A chip on Applied would be a label
 * repeating the column header it is sitting under.
 */
export const columnIsMixed = (columnKey) => stagesInColumn(columnKey).length > 1;

/**
 * What a card becomes when it is dropped into a lane.
 *
 * Mirrors the server's `defaultStageFor`, because the board needs the answer
 * before any request has landed — the card has to be drawn in the lane it was
 * dropped into, not flicker there after a round trip. `closed` resolving to
 * `rejected` falls out of the order the stages are declared in above, which is
 * also the order the chip offers them.
 */
export const defaultStageFor = (columnKey) => stagesInColumn(columnKey)[0] || 'applied';

export const stageOptionsFor = (columnKey) =>
  stagesInColumn(columnKey).map((key) => ({ value: key, label: STAGES[key].label }));

export const ALL_STAGE_OPTIONS = Object.entries(STAGES).map(([value, stage]) => ({
  value,
  label: stage.label,
}));

/* -------------------------------------------------------------------------- */
/* where it came from                                                          */
/* -------------------------------------------------------------------------- */

/**
 * There is no "referral" here, and that is deliberate — see the long note in
 * the server's config. Referral is not a channel; it is something that happened
 * *as well as* a channel, and it lives on the card as the presence of a
 * referrer. Putting it in this list would mean every referred application had
 * to throw away where you actually found the job.
 */
export const SOURCES = {
  linkedin: { label: 'LinkedIn' },
  naukri: { label: 'Naukri' },
  instagram: { label: 'Instagram' },
  company_site: { label: 'Company website' },
  job_portal: { label: 'Job portal', note: 'Instahyre, Wellfound, Cutshort, Unstop…' },
  shared_list: { label: 'Shared list', note: 'A Google Doc, Notion page or off-campus sheet' },
  cold_email: { label: 'Cold email' },
  recruiter_inbound: { label: 'Recruiter reached out' },
  career_fair: { label: 'Career fair' },
  campus: { label: 'Campus placement' },
  community: { label: 'Community', note: 'A Discord, Slack or WhatsApp group' },
  other: { label: 'Somewhere else' },
};

export const sourceLabel = label(SOURCES);
export const SOURCE_OPTIONS = options(SOURCES);

/**
 * Guess the channel from a pasted link.
 *
 * The add form's one piece of cleverness, and the same trick `AddProblemModal`
 * plays with a LeetCode URL: most of what you know about an application when
 * you create it is already in the link you copied. A guess is only ever a
 * pre-fill — every field it touches stays editable, and an unrecognised host
 * fills nothing rather than guessing `other`, because a wrong answer you have
 * to notice and undo is worse than a blank one you expected to fill in.
 */
const HOSTS = [
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)naukri\.com$/, 'naukri'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(instahyre|wellfound|angel|cutshort|hirist|unstop|indeed|glassdoor)\.(com|co|io)$/, 'job_portal'],
  [/(^|\.)(docs\.google|notion\.so|notion\.site)\.?/, 'shared_list'],
  [/(^|\.)(discord|slack)\.com$/, 'community'],
];

/**
 * A company name out of a careers URL.
 *
 * Only for hosts that are not a job board — `careers.razorpay.com` is a company
 * and `linkedin.com/jobs/...` is not, and guessing "Linkedin" as the employer
 * would be confidently wrong on the field people are least likely to re-read.
 */
const STRIP = /^(www|careers|jobs|job|apply|boards|talent|hire|recruiting)\./;

export function readLink(url) {
  let host;
  try {
    host = new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return {};
  }

  const match = HOSTS.find(([pattern]) => pattern.test(host));
  if (match) return { source: match[1] };

  const bare = host.replace(STRIP, '').replace(/\.(com|in|io|co|dev|ai|org|net)(\.[a-z]{2})?$/, '');
  const name = bare.split('.').pop();
  if (!name || name.length < 2) return { source: 'company_site' };

  return { source: 'company_site', company: name[0].toUpperCase() + name.slice(1) };
}

/* -------------------------------------------------------------------------- */
/* how you sent it                                                             */
/* -------------------------------------------------------------------------- */

/**
 * *How you actually applied*, which is not the same question as where you found
 * the job — and the difference matters most on the one platform where both
 * answers are available.
 *
 * "LinkedIn" covers pressing Easy Apply, which sends a bare profile into a pile
 * of four hundred, and following the link through to the company's own portal
 * and filling the form out properly. Those convert nothing like each other. A
 * tracker that cannot separate them will tell you LinkedIn does not work, when
 * what does not work is one button on it.
 *
 * So it is a third axis beside `source` and the referrer, and the report cuts
 * by it on its own — see `byMethod`.
 */
export const APPLY_METHODS = {
  easy_apply: { label: 'Easy Apply', note: 'One click, profile only', oneClick: true },
  company_portal: {
    label: "Their own site",
    note: 'Workday, Greenhouse, Lever, their careers page',
  },
  referral_portal: { label: 'Referral link', note: 'The internal one somebody sent you' },
  email: { label: 'Emailed a CV' },
  form: { label: 'A form', note: 'Google Form, campus portal', oneClick: true },
  recruiter: { label: 'A recruiter submitted me' },
  other: { label: 'Some other way' },
};

export const applyMethodLabel = label(APPLY_METHODS);
export const isOneClick = (key) => Boolean(APPLY_METHODS[key]?.oneClick);

/** `''` is first and is the default — see the note on the server field. */
export const APPLY_METHOD_OPTIONS = [
  { value: '', label: 'Not said' },
  ...options(APPLY_METHODS),
];

/**
 * Whether the source makes this question worth asking prominently.
 *
 * On LinkedIn, Naukri and the job boards, both answers are genuinely available
 * and which one you picked is the single most useful thing about the
 * application — so the form promotes the field instead of tucking it away. On a
 * company's own careers page there is only one way in, and asking would be
 * asking somebody to confirm something obvious.
 */
export const METHOD_MATTERS = ['linkedin', 'naukri', 'job_portal', 'instagram', 'shared_list'];

/**
 * What to pre-fill once a source is picked.
 *
 * A suggestion, never a rule, and deliberately empty for exactly the platforms
 * in `METHOD_MATTERS` — those are the ones where the answer carries information,
 * and guessing it would destroy the thing the field is for.
 */
export const METHOD_HINTS = {
  company_site: 'company_portal',
  cold_email: 'email',
  recruiter_inbound: 'recruiter',
  campus: 'form',
  career_fair: 'form',
};

/* -------------------------------------------------------------------------- */
/* rounds                                                                      */
/* -------------------------------------------------------------------------- */

export const ROUND_TYPES = {
  recruiter_screen: { label: 'Recruiter / HR call', family: 'screen' },
  oa: { label: 'Online assessment', family: 'screen', note: 'A timed platform test' },
  aptitude: { label: 'Aptitude', family: 'screen' },
  group_discussion: { label: 'Group discussion', family: 'screen' },
  take_home: { label: 'Take-home', family: 'technical', note: 'Build this in three days' },
  dsa: { label: 'DSA', family: 'technical' },
  hld: { label: 'System design (HLD)', family: 'technical' },
  lld: { label: 'Machine coding / LLD', family: 'technical' },
  core_cs: { label: 'Core CS', family: 'technical', note: 'OS, DBMS, networks' },
  sql: { label: 'SQL', family: 'technical' },
  domain: { label: 'Domain deep dive', family: 'technical', note: 'Frontend, ML, data, infra' },
  project_deep_dive: { label: 'Project deep dive', family: 'technical' },
  hiring_manager: { label: 'Hiring manager', family: 'behavioural' },
  bar_raiser: { label: 'Bar raiser', family: 'behavioural' },
  culture_fit: { label: 'Culture fit', family: 'behavioural' },
  leadership: { label: 'Director / leadership', family: 'behavioural' },
  offer_discussion: { label: 'Offer discussion', family: 'closing' },
  other: { label: 'Something else', family: 'other' },
};

export const roundTypeLabel = label(ROUND_TYPES);

export const FAMILIES = {
  screen: { label: 'Screening' },
  technical: { label: 'Technical' },
  behavioural: { label: 'Behavioural' },
  closing: { label: 'Closing' },
  other: { label: 'Other' },
};

export const familyLabel = label(FAMILIES);

/**
 * Round types grouped by family, for the picker.
 *
 * Eighteen values in one flat list is a scroll; five groups of three or four is
 * a glance. `Dropdown` has no group support, so the grouping is expressed as
 * the family in each option's `note` — which is also the more useful thing to
 * read when you are deciding between "Core CS" and "Domain deep dive".
 */
export const ROUND_TYPE_OPTIONS = Object.entries(ROUND_TYPES).map(([value, type]) => ({
  value,
  label: type.label,
  note: type.note || familyLabel(type.family),
}));

export const ROUND_OUTCOMES = {
  scheduled: { label: 'Scheduled', hue: 'sky', note: 'Booked, not sat yet' },
  awaiting: { label: 'Waiting to hear', hue: 'amber', note: 'Sat it, no word yet' },
  passed: { label: 'Passed', hue: 'green' },
  failed: { label: 'Failed', hue: 'red' },
  cancelled: { label: 'Cancelled', hue: 'slate' },
  no_show: { label: 'No-show', hue: 'slate' },
};

export const outcomeLabel = label(ROUND_OUTCOMES);
export const outcomeHue = (key) => ROUND_OUTCOMES[key]?.hue || 'slate';
export const OUTCOME_OPTIONS = options(ROUND_OUTCOMES);

/** Mirrors the server's table, so the card and the API agree about "settled". */
export const OUTCOME_SETTLED = { passed: true, failed: true, cancelled: true, no_show: true };
export const outcomeSettled = (key) => Boolean(OUTCOME_SETTLED[key]);

/**
 * The next round actually ahead of you, or undefined.
 *
 * Unsettled *and* in the future. A round you sat three weeks ago and never
 * heard back about is unsettled too, and treating it as "next" is how a card
 * ends up announcing an interview that is "44 days late". That round is
 * waiting on them, which the card says differently — see ApplicationCard.
 */
export const nextRound = (rounds = [], now = Date.now()) =>
  rounds
    .filter(
      (round) => round.scheduledAt && !outcomeSettled(round.outcome) && +new Date(round.scheduledAt) >= now,
    )
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];

export const ROUND_MODES = {
  video: { label: 'Video call' },
  phone: { label: 'Phone' },
  onsite: { label: 'On site' },
  async: { label: 'On your own time', note: 'An assessment or take-home' },
};

export const modeLabel = label(ROUND_MODES);
export const MODE_OPTIONS = [{ value: '', label: 'Not said' }, ...options(ROUND_MODES)];

/* -------------------------------------------------------------------------- */
/* questions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * How you handled it.
 *
 * `''` is absent from this list on purpose: it is not something you pick, it is
 * what a question is before you have picked anything. The row renders it as an
 * unfilled control rather than as a fifth value, because "ungraded" and "I had
 * nothing" are the two facts this field exists to keep apart.
 */
export const RATINGS = {
  nailed: { label: 'Nailed it', hue: 'green' },
  ok: { label: 'Got there', hue: 'sky' },
  fumbled: { label: 'Fumbled', hue: 'amber' },
  blank: { label: 'Blanked', hue: 'red', note: 'Had nothing' },
};

export const ratingLabel = label(RATINGS);
export const ratingHue = (key) => RATINGS[key]?.hue || 'slate';
export const RATING_OPTIONS = options(RATINGS);

/* -------------------------------------------------------------------------- */
/* closing                                                                     */
/* -------------------------------------------------------------------------- */

export const CLOSED_REASONS = {
  no_reply: { label: 'Never heard back' },
  failed_round: { label: 'Failed a round' },
  role_closed: { label: 'Role closed', note: 'Headcount pulled or the req froze' },
  eligibility: { label: 'Not eligible', note: 'Notice period, location, visa, band' },
  lowball: { label: 'Offer was too low' },
  declined_offer: { label: 'I declined the offer' },
  accepted_elsewhere: { label: 'Took something else' },
  changed_mind: { label: 'Changed my mind' },
  other: { label: 'Something else' },
};

export const closedReasonLabel = label(CLOSED_REASONS);
export const CLOSED_REASON_OPTIONS = [
  { value: '', label: 'Not said' },
  ...options(CLOSED_REASONS),
];

export const TOUCHPOINT_KINDS = {
  inbound: { label: 'They got in touch' },
  follow_up: { label: 'I followed up' },
  call: { label: 'Phone call' },
  email: { label: 'Email' },
  referral_ping: { label: 'Nudged my referrer' },
  note: { label: 'Note' },
};

export const touchpointLabel = label(TOUCHPOINT_KINDS);
export const TOUCHPOINT_OPTIONS = options(TOUCHPOINT_KINDS);

/* -------------------------------------------------------------------------- */
/* the job                                                                     */
/* -------------------------------------------------------------------------- */

export const WORK_MODES = {
  onsite: { label: 'On site' },
  hybrid: { label: 'Hybrid' },
  remote: { label: 'Remote' },
};

export const workModeLabel = label(WORK_MODES);
export const WORK_MODE_OPTIONS = [{ value: '', label: 'Not said' }, ...options(WORK_MODES)];

export const EMPLOYMENT = {
  full_time: { label: 'Full time' },
  internship: { label: 'Internship' },
  contract: { label: 'Contract' },
  part_time: { label: 'Part time' },
};

export const employmentLabel = label(EMPLOYMENT);
export const EMPLOYMENT_OPTIONS = options(EMPLOYMENT);

export const PRIORITIES = {
  none: { label: 'None' },
  low: { label: 'Low' },
  med: { label: 'Medium' },
  high: { label: 'High' },
};

export const PRIORITY_OPTIONS = options(PRIORITIES);

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD', 'AUD'];
export const CURRENCY_OPTIONS = CURRENCIES.map((value) => ({ value, label: value }));
