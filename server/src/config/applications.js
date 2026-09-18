/**
 * The vocabularies an application is written in.
 *
 * Tables rather than bare arrays, for the reason `ATTEMPT_OUTCOMES` is one:
 * every value here has a rule hanging off it — whether it counts in the funnel,
 * whether it killed the application, whether the round actually happened — and a
 * rule stated beside the value cannot be re-derived wrongly by the third
 * consumer. The enums below are `Object.keys` of these and are never
 * hand-written a second time.
 *
 * Every key is snake_case and goes into somebody's history the moment the first
 * document is saved. Renaming one is a migration, not an edit.
 */

/* -------------------------------------------------------------------------- */
/* stages — nine of them, six columns                                          */
/* -------------------------------------------------------------------------- */

/**
 * Where an application is, and what that means.
 *
 * Four facts per stage, and each exists because something downstream would
 * otherwise have to guess:
 *
 * `kind`   — what the stage *means*. Behaviour hangs off this and never off the
 *            key, the way a task's column kind rather than its name decides
 *            whether the task is finished. "How many are live" is
 *            `kind === 'open'`, and a tenth stage added below joins that count
 *            without anyone editing the query.
 *
 * `column` — which lane the board draws it in. Nine columns is not a board
 *            anybody can read across, so the four settled stages share two
 *            lanes and are told apart by a chip on the card. Collapsing in the
 *            *view* rather than in the *data* is what keeps `rejected` and
 *            `ghosted` separate numbers in the funnel — they are two very
 *            different facts about a channel, and merging them would make every
 *            source's conversion rate a lie.
 *
 * `rank`   — depth down the funnel, and deliberately null for the three exits.
 *            Rejected is not deeper than offer and not shallower than applied;
 *            it is off the ladder entirely. How far an application actually got
 *            is `reached`, never the stage it ended in — which is the whole
 *            reason `reached` exists. See models/Application.js.
 *
 * `counts` — funnel membership. `wishlist` is false because you never applied:
 *            counting saved-but-never-sent rows in the denominator makes every
 *            conversion rate a function of how much window-shopping you did
 *            that month.
 *
 * On the two that look like the same stage: `screening` is *a human replied and
 * there is a recruiter call or an OA in front of you*; `in_process` is *a round
 * that tests the actual job is scheduled or done*. The first rate measures your
 * CV, the second measures your interviewing, and merging them loses the most
 * useful split in the whole report. That definition has to live somewhere or
 * filing drifts and the numbers quietly stop meaning anything.
 *
 * On `ghosted`: it earns a key because "they told me no" and "I never heard
 * back" are different lessons — a source with 40% rejections is working, a
 * source with 40% silence is not. But *nothing ever moves a card into it on its
 * own*. A board that reshuffles itself overnight is one you stop trusting.
 * Staleness is derived from `lastActivityAt` against the board's
 * `staleAfterDays` and shows up as a badge; the drag is yours.
 *
 * On declining an offer: that is `withdrawn` with `closedReason:
 * 'declined_offer'`, not a tenth stage. It is not `rejected` — they said yes —
 * and not `accepted` — you did not take it — and `reached.offer` stays set, so
 * the funnel still credits the offer.
 */
export const APPLICATION_STAGES = {
  wishlist: { kind: 'open', column: 'wishlist', rank: 0, counts: false },
  applied: { kind: 'open', column: 'applied', rank: 1, counts: true },
  screening: { kind: 'open', column: 'screening', rank: 2, counts: true },
  in_process: { kind: 'open', column: 'in_process', rank: 3, counts: true },
  offer: { kind: 'open', column: 'offer', rank: 4, counts: true },
  accepted: { kind: 'closed', column: 'offer', rank: 5, counts: true },
  rejected: { kind: 'closed', column: 'closed', rank: null, counts: true },
  ghosted: { kind: 'closed', column: 'closed', rank: null, counts: true },
  withdrawn: { kind: 'closed', column: 'closed', rank: null, counts: true },
};

export const STAGE_KEYS = Object.keys(APPLICATION_STAGES);

export const OPEN_STAGES = STAGE_KEYS.filter(
  (key) => APPLICATION_STAGES[key].kind === 'open',
);

export const stageKind = (key) => APPLICATION_STAGES[key]?.kind ?? 'open';
export const stageRank = (key) => APPLICATION_STAGES[key]?.rank ?? null;
export const stageClosed = (key) => stageKind(key) === 'closed';

/**
 * The stages that get a date on `reached`.
 *
 * The exits are absent on purpose. An exit is `closedAt` plus `closedReason`,
 * and giving each one a slot here would invite somebody to read them as depths
 * — which is exactly the mistake `rank: null` exists to prevent.
 */
export const REACHED_KEYS = ['applied', 'screening', 'in_process', 'offer', 'accepted'];

/**
 * The six lanes the board draws, in order.
 *
 * Derived from the stage table rather than written out again, so a stage added
 * above cannot end up in a lane that does not exist. The label here is only the
 * factory default — what a lane is actually called is on the account's
 * `ApplicationBoard`, and renaming one changes no key and therefore no number.
 */
export const COLUMNS = [
  { key: 'wishlist', label: 'Wishlist', hue: 'slate' },
  { key: 'applied', label: 'Applied', hue: 'blue' },
  { key: 'screening', label: 'Screening', hue: 'sky' },
  { key: 'in_process', label: 'In Process', hue: 'violet' },
  { key: 'offer', label: 'Offer', hue: 'amber' },
  { key: 'closed', label: 'Closed', hue: 'slate' },
];

export const COLUMN_KEYS = COLUMNS.map((column) => column.key);

/** The stages that live in one lane, in the order the chip picker offers them. */
export const stagesInColumn = (columnKey) =>
  STAGE_KEYS.filter((key) => APPLICATION_STAGES[key].column === columnKey);

/**
 * What a card becomes when it is dropped into a lane.
 *
 * A drag has to be a complete status update on its own — that is the whole
 * argument for a board over a form — so every lane needs one stage it means by
 * default. Five are their own answer; `closed` is `rejected`, because that is
 * what nine closures in ten are, and the other three are one click on the chip
 * the card grows on arrival.
 */
export const defaultStageFor = (columnKey) =>
  columnKey === 'closed' ? 'rejected' : stagesInColumn(columnKey)[0] || 'applied';

/* -------------------------------------------------------------------------- */
/* where the job came from                                                     */
/* -------------------------------------------------------------------------- */

/**
 * *Where you found it.* Not *how you got in*, and that distinction is the most
 * important correction this file makes.
 *
 * `referral` is not in this list, and putting it here is the obvious design.
 * It does not belong, because it is not mutually exclusive with anything else
 * in the list: you find a role on LinkedIn on Monday and get an ex-colleague to
 * refer you on Tuesday, and a single enum has to throw one of those two facts
 * away — always the one the stats wanted. So the channel stays here, and "was I
 * referred" is the presence of `referrer` on the document.
 *
 * That split also improves the report it was blocking. Conversion by source
 * with `referral` inside it answers a question nobody has; *referred against
 * not referred, cut across every channel*, answers the one everybody has.
 *
 * `instagram` and `linkedin` are first-class rather than one `social`, because
 * they behave nothing alike — one is a job board, the other is a hiring-post
 * feed — and a bucket that merges them cannot tell you to stop using one of
 * them.
 *
 * `shared_list` is the circulated Google Doc, Notion page or off-campus sheet.
 * Named for what it is rather than where it is hosted, so it survives the next
 * tool.
 *
 * `job_portal` is the deliberate catch-all for the long tail — Indeed,
 * Instahyre, Wellfound, Cutshort, Hirist, Unstop. The specific one goes in
 * `sourceNote`, which is where a value earns promotion out of here: when that
 * free text reads "instahyre" for the fifteenth time, add `instahyre` above.
 */
export const SOURCES = [
  'linkedin',
  'naukri',
  'instagram',
  'company_site',
  'job_portal',
  'shared_list',
  'cold_email',
  'recruiter_inbound',
  'career_fair',
  'campus',
  'community',
  'other',
];

/**
 * *How you actually submitted it.*
 *
 * The third of the three facts people try to cram into one "source" field, and
 * the one it hurts most to lose. `linkedin` says where you found the job. It
 * does not say whether you pressed Easy Apply — which sends a bare profile into
 * a pile of four hundred — or followed the link to the company's own portal and
 * filled the form out properly. Those two convert nothing like each other, and
 * a tracker that cannot tell them apart will confidently report that LinkedIn
 * does not work when what does not work is one button on it.
 *
 * So it is its own axis, exactly as `referrer` is. Three orthogonal questions,
 * three fields, and the report cuts by all three:
 *
 *   source       where you found it        linkedin
 *   applyMethod  how you sent it           easy_apply
 *   referrer     whether somebody put you in
 *
 * `''` is legal and is the default. Most of the first hundred rows anybody logs
 * will not have this filled in, and a default of `company_portal` would invent
 * an answer on every one of them — which is worse than an empty column, because
 * the empty one is visibly a gap and the invented one is a number.
 */
export const APPLY_METHODS = {
  easy_apply: { label: 'Easy Apply', quality: 'low' },
  company_portal: { label: "The company's own portal", quality: 'high' },
  referral_portal: { label: 'Internal referral link', quality: 'high' },
  email: { label: 'Emailed a CV', quality: 'high' },
  form: { label: 'A form', quality: 'low' },
  recruiter: { label: 'A recruiter submitted me', quality: 'high' },
  other: { label: 'Some other way', quality: 'unknown' },
};

export const APPLY_METHOD_KEYS = Object.keys(APPLY_METHODS);

/**
 * Which methods are the one-click kind.
 *
 * `quality` is a claim about effort rather than about outcome, and it exists so
 * the report can draw the one comparison this field is for — one-click against
 * a real application — without hard-coding `easy_apply` in three places. What it
 * is worth is measured, not asserted: the number beside it comes from your own
 * conversion rate.
 */
export const isOneClick = (method) => APPLY_METHODS[method]?.quality === 'low';

/**
 * What to suggest once somebody picks a source.
 *
 * A suggestion and never a rule — every one of these is editable, and the two
 * platforms that have a one-click button are deliberately left empty rather
 * than pre-filled, because those are exactly the two where the answer carries
 * information and guessing it would destroy the thing the field is for.
 */
export const APPLY_METHOD_HINTS = {
  linkedin: '',
  naukri: '',
  job_portal: '',
  company_site: 'company_portal',
  cold_email: 'email',
  recruiter_inbound: 'recruiter',
  campus: 'form',
  career_fair: 'form',
};

/* -------------------------------------------------------------------------- */
/* rounds                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What the round actually was.
 *
 * Eighteen values, which is more than a picker wants in one flat list — hence
 * `family`. The picker groups by it, and "which round type kills most
 * applications" can be answered at two granularities off the same field: the
 * type (`lld`), and the family (`technical`), which is the one with enough
 * sample size to mean anything in the first fifty applications.
 *
 * The list is long on purpose. A missing round type does not degrade into
 * `other` once — it degrades into `other` *forever*, because you file it there
 * the first time and then send every similar round after it to the same place
 * to keep the history consistent. `other` ends up the largest bucket in the
 * report the module exists to produce. An unused enum value costs one line.
 */
export const ROUND_TYPES = {
  recruiter_screen: { family: 'screen' },
  oa: { family: 'screen' },
  aptitude: { family: 'screen' },
  group_discussion: { family: 'screen' },
  take_home: { family: 'technical' },
  dsa: { family: 'technical' },
  hld: { family: 'technical' },
  lld: { family: 'technical' },
  core_cs: { family: 'technical' },
  sql: { family: 'technical' },
  domain: { family: 'technical' },
  project_deep_dive: { family: 'technical' },
  hiring_manager: { family: 'behavioural' },
  bar_raiser: { family: 'behavioural' },
  culture_fit: { family: 'behavioural' },
  leadership: { family: 'behavioural' },
  offer_discussion: { family: 'closing' },
  other: { family: 'other' },
};

export const ROUND_TYPE_KEYS = Object.keys(ROUND_TYPES);

export const roundFamily = (type) => ROUND_TYPES[type]?.family ?? 'other';

/** The families, in the order a picker groups them. */
export const ROUND_FAMILIES = ['screen', 'technical', 'behavioural', 'closing', 'other'];

/**
 * How a round ended, and the three questions the stats ask of it.
 *
 * `happened` — did you sit it. "How many DSA rounds have I done" must not count
 *              the two that were cancelled.
 * `adverse`  — did it kill the application. The kill report reads this and
 *              never the outcome string.
 * `settled`  — is anything still owed. Drives the card's waiting badge, the
 *              follow-up nudge, and which rounds count towards `nextRoundAt`.
 *
 * `awaiting` is `happened` without `settled` and is the most common state in
 * the collection — the round is over and nobody has said anything. It is also
 * why the kill report cannot read `adverse` alone: an application that ends
 * `ghosted` was killed by its last `awaiting` round, and the aggregation has to
 * say so or it will blame the last round anybody explicitly failed.
 *
 * Rescheduling is deliberately not here. A round moved to next week is still
 * `scheduled` — the reschedule is recorded on `rescheduledFrom`, because it is
 * a fact about the company and not about how the round went.
 */
export const ROUND_OUTCOMES = {
  scheduled: { happened: false, adverse: false, settled: false },
  awaiting: { happened: true, adverse: false, settled: false },
  passed: { happened: true, adverse: false, settled: true },
  failed: { happened: true, adverse: true, settled: true },
  cancelled: { happened: false, adverse: false, settled: true },
  no_show: { happened: false, adverse: false, settled: true },
};

export const ROUND_OUTCOME_KEYS = Object.keys(ROUND_OUTCOMES);

export const outcomeHappened = (outcome) => Boolean(ROUND_OUTCOMES[outcome]?.happened);
export const outcomeAdverse = (outcome) => Boolean(ROUND_OUTCOMES[outcome]?.adverse);
export const outcomeSettled = (outcome) => Boolean(ROUND_OUTCOMES[outcome]?.settled);

/**
 * Where the round happened, which is logistics and nothing else.
 *
 * `async` rather than `take_home`, and the difference matters: a take-home is a
 * *kind of round* and it is already in `ROUND_TYPES`. What it has in common
 * with an online assessment is only that nobody was on the call. Listing
 * `take_home` in both places would let the same event be filed two ways and put
 * the two axes permanently at odds.
 *
 * `''` is a legal value and means "not said", the `attempt.reason` rule: a
 * round you logged without noting the mode is a different fact from a phone
 * screen.
 */
export const ROUND_MODES = ['phone', 'video', 'onsite', 'async'];

/**
 * How you handled one question, in your own estimation.
 *
 * `blank` and `''` are not the same fact and the schema holds both. `blank` is
 * "I had nothing, I sat there" — the most informative rating in the list, and
 * the one worth searching for later. `''` is "I have not graded this yet",
 * which is the state every question is in for the ten minutes after an
 * interview while you are still dumping them in. Collapsing the two would turn
 * every ungraded question into a disaster and make the one number this module
 * exists to produce untrustworthy.
 *
 * There is deliberately no `other`, the argument `FAILURE_REASONS` already
 * makes: a self-rating you cannot name is better left empty than filed into a
 * bucket that then dominates the report.
 */
export const QUESTION_RATINGS = ['nailed', 'ok', 'fumbled', 'blank'];

/* -------------------------------------------------------------------------- */
/* touchpoints                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Something that happened which no other field can hold.
 *
 * `fromThem` on the document is what decides whether one of these counts as a
 * reply; the kind is only what it was. `inbound` exists beside `call` and
 * `email` for the case where you do not know or do not care which channel it
 * came through, which is most of them.
 */
export const TOUCHPOINT_KINDS = [
  'follow_up',
  'inbound',
  'call',
  'email',
  'referral_ping',
  'note',
];

/* -------------------------------------------------------------------------- */
/* closing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Why it ended — machine-readable, set on any closed stage.
 *
 * Distinct from the two free-text fields on the post-mortem, and all three earn
 * their place:
 *
 *   closedReason          the bucket, for the report
 *   postMortem.theirWord  what they actually said, verbatim, including when it
 *                         is "we decided to move forward with other candidates"
 *   postMortem.myRead     what you think really happened
 *
 * The second and third are the pair that makes a post-mortem worth writing at
 * all, and only the first is aggregatable. Forcing the honest read into a
 * dropdown would lose the one sentence in this whole collection you go back and
 * re-read in six months.
 *
 * `role_closed` and `eligibility` are here because neither is about how you did
 * — headcount pulled, req frozen, notice period, location, visa — and a report
 * that files those under "failed" tells you to study when the answer was that
 * the job stopped existing.
 */
export const CLOSED_REASONS = [
  'no_reply',
  'failed_round',
  'role_closed',
  'eligibility',
  'lowball',
  'declined_offer',
  'accepted_elsewhere',
  'changed_mind',
  'other',
];

/* -------------------------------------------------------------------------- */
/* the job itself                                                              */
/* -------------------------------------------------------------------------- */

export const WORK_MODES = ['onsite', 'hybrid', 'remote'];

export const EMPLOYMENT_TYPES = ['full_time', 'internship', 'contract', 'part_time'];

/**
 * Enough for the places this app's readers apply, and not an ISO-4217 dump.
 *
 * Amounts are stored in whole units of the currency — rupees, not lakhs, not
 * paise. That rule is written here because it is the bug this field otherwise
 * gets: a form that accepts "32" meaning thirty-two lakh, added to a 3200000
 * typed somewhere else, produces a number nobody can debug afterwards. The
 * client renders LPA; the database stores rupees.
 */
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED', 'CAD', 'AUD'];

export const PRIORITIES = ['none', 'low', 'med', 'high'];

/* -------------------------------------------------------------------------- */
/* ceilings                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Bounds on a loop rather than opinions about your job hunt — the `MAX_TASKS`
 * argument. Every one of these is far above any real use.
 *
 * `MAX_QUESTIONS_PER_ROUND` is the one doing real work: it is what keeps the
 * worst-case document (20 rounds × 40 questions × ~5 KB ≈ 4 MB) comfortably
 * inside Mongo's 16 MB ceiling, which is the number that makes embedding the
 * questions safe in the first place. See models/Application.js.
 */
export const MAX_APPLICATIONS = 500;
export const MAX_ROUNDS = 20;
export const MAX_QUESTIONS_PER_ROUND = 40;
export const MAX_TOUCHPOINTS = 100;
export const MAX_INTERVIEWERS = 6;
export const MAX_LINKS = 8;
export const MAX_TAGS = 12;

/** Default silence before a live card is drawn as stale. Overridable per account. */
export const DEFAULT_STALE_AFTER_DAYS = 21;
export const MIN_STALE_AFTER_DAYS = 3;
export const MAX_STALE_AFTER_DAYS = 180;

/**
 * How far ahead `GET /applications/due` looks.
 *
 * A week, because the badge answers "is there anything I have to prepare for",
 * and a round three weeks out is not something you do anything about today.
 */
export const DUE_WINDOW_DAYS = 7;
