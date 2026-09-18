import mongoose from 'mongoose';

import {
  APPLICATION_STAGES,
  APPLY_METHOD_KEYS,
  CLOSED_REASONS,
  CURRENCIES,
  DEFAULT_STALE_AFTER_DAYS,
  EMPLOYMENT_TYPES,
  PRIORITIES,
  QUESTION_RATINGS,
  REACHED_KEYS,
  ROUND_MODES,
  ROUND_OUTCOME_KEYS,
  ROUND_TYPE_KEYS,
  SOURCES,
  STAGE_KEYS,
  TOUCHPOINT_KINDS,
  WORK_MODES,
  outcomeSettled,
  roundFamily,
  stageClosed,
} from '../config/applications.js';
import { companySlug } from '../services/logo.service.js';

/**
 * One job you applied for, and everything that happened next.
 *
 * The roadmap records what you practised and Tasks records what you meant to
 * do. Neither can hold the thing the practice is *for*: a company, a role, a
 * sequence of rounds with dates, and — the part that makes the module worth
 * building — a record of the questions you were actually asked and how badly
 * you handled them. That last one is the only honest input to "what should I
 * study next", and until now it lived in a Google Doc.
 *
 * ---------------------------------------------------------------------------
 * One document per application, with rounds embedded and questions embedded
 * inside those.
 *
 * A round has no life outside its application: you never restore one without
 * the other, you never move one between companies, and there are tens of them
 * rather than thousands. That makes it `Task.sessions`, not `DesignNode` — the
 * separate collection next door is separate precisely because nodes are moved,
 * trashed and restored on their own and there are a couple of thousand per
 * project. Neither is true here.
 *
 * Every read wants the whole record, which is the other half of the argument:
 * opening a company shows its timeline *and* its rounds *and* their questions,
 * so a split would buy a `$lookup` on the one query that runs on every page
 * load and pay for it in nothing. The stats aggregation gets its join free,
 * because `$unwind: '$rounds'` over colocated data is not a join at all.
 *
 * The one thing embedding endangers is questions, and the answer is a
 * projection rather than a collection. Worst case under the ceilings in
 * config/applications.js is 20 rounds x 40 questions x ~5 KB, about 4 MB —
 * comfortable against Mongo's 16 MB limit, and fatal as a board read of three
 * hundred applications. So the board read selects `-rounds.questions` and there
 * are two wire shapes; see the foot of this file.
 * ---------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------- */
/* sub-schemas                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A question you were asked, and what you did with it.
 *
 * Free text rather than a ref to a `Problem`, and this is the decision the
 * schema least wants to revisit. An interview question is not a roadmap row: it
 * is half-remembered, differently worded, and often not a coding problem at all
 * — "design the rate limiter for this", "why did you leave". Forcing it through
 * a picker means the ones that match nothing never get written down, and the
 * ones that match nothing are the ones you did worst on.
 *
 * `problem` is here, optional and unset, as the seam for a later pass that
 * matches a question to a roadmap row so a fumbled one can join the revision
 * ladder. It must never become the required field.
 *
 * `_id` is kept, for the reason `schemas/attempt.js` spells out: deleting a
 * question shifts every index after it, so an edit issued against a position
 * read a moment ago would land on the wrong question. An id does not move.
 */
const interviewQuestionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true, maxlength: 600 },

  /**
   * What you said, in as much detail as you can still remember.
   *
   * 4000 characters — the room a stored solution gets, and for the same reason:
   * the answer is the thing. A schema that records that a question happened
   * without recording what you said records a tally mark.
   */
  answer: { type: String, default: '', maxlength: 4000 },

  /** `''` is "not graded yet", which is not `blank`. See QUESTION_RATINGS. */
  rating: { type: String, enum: [...QUESTION_RATINGS, ''], default: '' },

  /** Your own word for what it was about — "graphs", "indexes", "system design". */
  topic: { type: String, default: '', trim: true, maxlength: 60 },

  notes: { type: String, default: '', maxlength: 1000 },
  order: { type: Number, default: 0 },
  addedAt: { type: Date, default: Date.now },

  /** The seam. Unset today; nothing reads it. */
  problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', default: null },
});

/**
 * Who was on the other side.
 *
 * `_id` off, unlike everything else in this file. Nobody edits one interviewer
 * by id — the field is a two-line form rewritten whole — and there are at most
 * a handful per round.
 */
const interviewerSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true, maxlength: 120 },
    title: { type: String, default: '', trim: true, maxlength: 120 },
    /** A LinkedIn URL or an email. Not validated as either: it is a note. */
    contact: { type: String, default: '', trim: true, maxlength: 200 },
  },
  { _id: false },
);

/**
 * One round of the loop.
 *
 * `order` is separate from `scheduledAt` and both are needed. The round list
 * draws in `order`, which is the sequence the company put them in; the timeline
 * draws by date. They disagree constantly and both are right — a round logged
 * retroactively, a round moved two weeks later, an OA that sat unopened for a
 * fortnight. Sorting the list by date would reorder a loop because you
 * rescheduled one call.
 */
const roundSchema = new mongoose.Schema({
  type: { type: String, enum: ROUND_TYPE_KEYS, default: 'other' },

  /**
   * What the company called it: "Round 2", "Onsite Panel A", "Krypton".
   *
   * Free text beside the enum rather than instead of it. The label is how you
   * recognise the round when the recruiter emails about it; the type is what
   * the stats can count. Neither substitutes for the other — the same bargain
   * `hues.js` strikes between a colour's name and its value.
   */
  label: { type: String, default: '', trim: true, maxlength: 80 },

  order: { type: Number, default: 0 },

  /**
   * Nullable, and null means "no date on it" rather than "unset and therefore
   * wrong" — the `dueAt` rule. An OA link that arrives with a seven-day window
   * has no scheduled instant until you sit it, and inventing one would put a
   * fake row on the timeline and a fake date in `nextRoundAt`.
   *
   * May sit before `appliedAt` and before `createdAt`, deliberately and with no
   * validator in the way. Logging an application after two rounds have already
   * happened is the normal way this module gets used for the first time, and a
   * chronology check would reject the most common first write anybody makes.
   */
  scheduledAt: { type: Date, default: null },

  /**
   * Every instant this round was previously set to, oldest first.
   *
   * Three dates, not an event log. It exists because "they have moved this
   * three times" is a fact about the company that nothing else records, and it
   * costs one push on the write that changes `scheduledAt`. A rescheduled round
   * stays `scheduled` — rescheduling is not an outcome.
   */
  rescheduledFrom: { type: [Date], default: [] },

  /** Null rather than 60. A round whose length you did not note is not an hour. */
  durationMinutes: { type: Number, default: null, min: 0, max: 600 },

  mode: { type: String, enum: [...ROUND_MODES, ''], default: '' },
  interviewers: { type: [interviewerSchema], default: [] },

  outcome: { type: String, enum: ROUND_OUTCOME_KEYS, default: 'scheduled' },

  /**
   * When the outcome stopped being `scheduled`.
   *
   * Separate from `scheduledAt`, because a round you sat on Tuesday and heard
   * about on Friday has two dates and "how long do they take to come back" is a
   * question the report will be asked. Stamped by the service rather than by a
   * hook, so it can be backdated.
   */
  outcomeAt: { type: Date, default: null },

  /** How it felt, out of five. Null is "did not say", not "average". */
  feeling: { type: Number, default: null, min: 1, max: 5 },

  notes: { type: String, default: '', maxlength: 4000 },
  questions: { type: [interviewQuestionSchema], default: [] },

  /**
   * How many questions are on this round — stored, not counted at read time.
   *
   * It looks redundant beside the array, and it is not: the board read selects
   * `-rounds.questions`, so on a card the array is *gone* and a length taken
   * from it is zero rather than unknown. A card that silently claimed every
   * round had no questions would be the projection quietly lying about the one
   * thing the module exists to record.
   *
   * Written by the same pre-save pass that derives the application's own
   * `questionCount`, from the same loop, so the two cannot disagree.
   */
  questionCount: { type: Number, default: 0 },
});

/**
 * The person who put you in.
 *
 * A sub-schema with `default: undefined`, the `Feedback.response` arrangement,
 * so an application nobody referred carries no `referrer` key at all and "was
 * this referred" is one truthy check rather than a walk over four empty
 * strings. That check is a whole axis of the report, so it has to be cheap and
 * unambiguous.
 *
 * Not a ref to anything. There is no Contact collection, and inventing one to
 * hold six people is a second module nobody asked for. If the same name turns
 * up on eleven applications, that is when it earns a collection.
 */
const referrerSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true, maxlength: 120 },
    /** Their role there — what decides how much the referral is actually worth. */
    title: { type: String, default: '', trim: true, maxlength: 120 },
    /** How you know them: "college senior", "ex-Zomato", "Twitter mutual". */
    relationship: { type: String, default: '', trim: true, maxlength: 200 },
    contact: { type: String, default: '', trim: true, maxlength: 200 },
    askedAt: { type: Date, default: null },
  },
  { _id: false },
);

/** The recruiter or HR contact on their side. Same shape, different person. */
const contactSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true, maxlength: 120 },
    title: { type: String, default: '', trim: true, maxlength: 120 },
    email: { type: String, default: '', trim: true, maxlength: 200 },
    phone: { type: String, default: '', trim: true, maxlength: 40 },
  },
  { _id: false },
);

/**
 * Money, and only once there is any.
 *
 * `default: undefined` again. Most applications never have a compensation
 * conversation, and materialising `{ expected: 0, offered: 0, base: 0, ... }`
 * on every row would put a zero offer on every card and make "is there an offer
 * on the table" a question about zeroes.
 *
 * Every amount is in whole units of `currency` — rupees, not lakhs, not paise.
 * That rule is restated here because this is the field it gets broken in: a
 * form that accepts "32" for thirty-two lakh, added to a 3200000 typed
 * somewhere else, produces a number nobody can debug afterwards. The client
 * renders LPA; this stores rupees.
 *
 * `esopNote` sits beside `esop` on purpose. An equity number without the
 * vesting schedule, the cliff and the strike price is not information, and none
 * of those three is worth a column on a personal tracker.
 */
const compensationSchema = new mongoose.Schema(
  {
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    expected: { type: Number, default: null, min: 0 },
    offered: { type: Number, default: null, min: 0 },
    base: { type: Number, default: null, min: 0 },
    bonus: { type: Number, default: null, min: 0 },
    joiningBonus: { type: Number, default: null, min: 0 },
    esop: { type: Number, default: null, min: 0 },
    esopNote: { type: String, default: '', maxlength: 500 },
    receivedAt: { type: Date, default: null },
    /** When it expires. The only date on this document anyone is afraid of. */
    decideBy: { type: Date, default: null },
    notes: { type: String, default: '', maxlength: 2000 },
  },
  { _id: false },
);

/**
 * What killed it, written down while you still remember.
 *
 * `round` is a ref *and* a snapshot, exactly as `Task.questions` is, and for
 * exactly the same reason. A post-mortem that names a round only by id renders
 * as a blank line the moment that round is deleted — which reads as corruption,
 * where a dangling `roundLabel` reads as history and is what actually happened.
 * So the service nulls the ref in the same save that pulls the round, and the
 * two snapshot fields survive to say "it died at the system design round".
 *
 * They are written server-side from the round and never echoed from the
 * request, the rule `resolveAssets` applies to attachments.
 *
 * `theirWord` and `myRead` are two fields and must stay two. The first is what
 * the rejection email said and is usually worthless. The second is the one
 * sentence in this entire collection worth re-reading in six months, and it
 * only ever gets written if there is a box visibly not for their answer.
 */
const postMortemSchema = new mongoose.Schema(
  {
    round: { type: mongoose.Schema.Types.ObjectId, default: null },
    roundType: { type: String, default: '' },
    roundLabel: { type: String, default: '' },
    theirWord: { type: String, default: '', maxlength: 2000 },
    myRead: { type: String, default: '', maxlength: 2000 },
  },
  { _id: false },
);

/**
 * Something that happened that no other field can hold.
 *
 * The one genuine event log in this module, and it is one because it is primary
 * data: a recruiter's phone call has no source document to be projected from.
 * Everything else on the timeline is derived — see `applicationTimeline` — and
 * that is precisely so that editing a round's date does not mean finding and
 * rewriting an event somewhere else.
 *
 * `_id` kept, `attempt.js` again. `at` is user-settable, because half of these
 * are typed in three days late.
 */
const touchpointSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  kind: { type: String, enum: TOUCHPOINT_KINDS, default: 'note' },
  /** Whether the other side started it. This is what feeds days-to-first-reply. */
  fromThem: { type: Boolean, default: false },
  note: { type: String, default: '', maxlength: 2000 },
});

/**
 * The first time this application reached each stage.
 *
 * A fixed-key subdocument rather than an event array, and it is the whole of
 * the stored history this module keeps.
 *
 * **Monotone.** A date is stamped only when it is null, so dragging a card back
 * from `in_process` to `screening` to fix a misdrop does not erase the fact
 * that it got to `in_process`. Dragging *forward* deliberately does not
 * back-fill the stages it skipped: an application dragged from `applied`
 * straight to `offer` has a null `screening`, which is true, and is what the
 * days-to-reply calculation has to see rather than a fabricated guess.
 *
 * Every field is user-editable, and that is the property that makes this safe
 * to store while the rest of the timeline is derived. When the source of a
 * derived row is wrong you fix the source; when one of these is wrong you fix
 * the date directly, because it *is* the source. There is nothing for it to
 * drift from.
 *
 * It is also the field the funnel reads. "How far did this get" is the deepest
 * non-null key here and never `stage` — an application that ended `rejected`
 * reached `in_process`, and a funnel built on the current stage reports every
 * rejection as though it never got past the first screen. The clearest case is
 * an offer you declined: it ends `withdrawn`, and `reached.offer` is what keeps
 * the offer counted.
 *
 * No keys for the three exits. An exit is `closedAt` plus `closedReason`, and
 * giving each one a slot here would invite somebody to treat them as depths.
 */
const reachedSchema = new mongoose.Schema(
  Object.fromEntries(REACHED_KEYS.map((key) => [key, { type: Date, default: null }])),
  { _id: false },
);

/**
 * Which CV this application was sent with.
 *
 * A reference into the library *and* a snapshot of it, the arrangement
 * `postMortem` uses. The reference is how the drawer finds the live row; the
 * snapshot is what it draws when the row has since been deleted from the
 * library — which nulls `id` and leaves the rest, so "sent the backend one"
 * stays readable rather than turning into a blank line.
 *
 * Written server-side from the library row, never echoed from the request, so
 * a client cannot name a CV it does not own. See services/resume.service.js.
 */
const resumeRefSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', default: null },
    label: { type: String, default: '' },
    url: { type: String, default: '' },
  },
  { _id: false },
);

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, default: '', trim: true, maxlength: 60 },
    url: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

/* -------------------------------------------------------------------------- */
/* the application                                                             */
/* -------------------------------------------------------------------------- */

const applicationSchema = new mongoose.Schema(
  {
    /**
     * No `index: true`, the `Task` rule: every query in this module is
     * `user`-prefixed and covered by one of the three compound indexes below,
     * and a bare one would answer nothing they do not already.
     */
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    /*
      No `board` ref, unlike Task — see the long note in ApplicationBoard.js.
      A stage is a fixed key the server already knows, so this document needs
      nothing from the board to render, to validate or to be counted.
    */
    stage: { type: String, enum: STAGE_KEYS, default: 'applied' },
    /** Position within its lane. Plain integers, whole lane rewritten on a move. */
    order: { type: Number, default: 0 },

    company: { type: String, required: true, trim: true, maxlength: 120 },

    /**
     * `companySlug(company)`, recomputed by the pre-save hook.
     *
     * Stored rather than derived at read time for two reasons: it can be
     * indexed, which is what answers "have I applied here before", and the card
     * becomes a lookup rather than a string operation repeated per render.
     *
     * No image is stored here. The client builds
     * `/api/companies/<slug>/logo` itself, which is what stops a three-hundred
     * card board carrying three hundred identical path strings and lets the
     * browser cache one company's logo across every application to it.
     */
    companySlug: { type: String, default: '' },

    role: { type: String, default: '', trim: true, maxlength: 140 },

    /**
     * The org inside the company — "AWS S3", "Ads Ranking", "Payments".
     *
     * Its own field because "two roles at one company" is almost always two
     * teams, and two cards both reading "Amazon · SDE-1" are two cards you
     * cannot tell apart at the glance a board is for. It is also the only thing
     * that makes a reapplication six months later legible.
     */
    team: { type: String, default: '', trim: true, maxlength: 120 },

    /** "SDE-1", "L4", "Member of Technical Staff". Their ladder, not ours. */
    level: { type: String, default: '', trim: true, maxlength: 60 },

    employment: { type: String, enum: EMPLOYMENT_TYPES, default: 'full_time' },
    location: { type: String, default: '', trim: true, maxlength: 120 },
    workMode: { type: String, enum: [...WORK_MODES, ''], default: '' },

    /**
     * The posting, and anything else worth keeping.
     *
     * An array because the job ad, the referral portal link and the assessment
     * invite are three different URLs and each is the one you need at a
     * different moment. `label` so the second one is not an anonymous `https://`
     * you have to click to identify.
     */
    links: { type: [linkSchema], default: [] },

    /**
     * The job description, pasted.
     *
     * A plain field nothing reads today. It is the seam for a later pass that
     * fills the form out of it — see the module's section in the README — and
     * it costs a nullable string until then.
     */
    jdText: { type: String, default: '', maxlength: 20000 },

    source: { type: String, enum: SOURCES, default: 'other' },
    /**
     * The specific portal, poster or list.
     *
     * Where an enum value earns promotion: when this reads "instahyre" for the
     * fifteenth time, `instahyre` goes into SOURCES. Until then the long tail
     * lives here instead of inflating the vocabulary with values of one.
     */
    sourceNote: { type: String, default: '', trim: true, maxlength: 200 },

    /**
     * How you actually submitted it — Easy Apply, or their own portal, or an
     * email. A separate axis from `source` on purpose; see the long note in
     * config/applications.js.
     *
     * `''` is the default and means "did not say". Defaulting it to anything
     * would invent an answer on every row logged before the field existed, and
     * the whole value of this column is that it distinguishes one click from a
     * real application.
     */
    applyMethod: { type: String, enum: [...APPLY_METHOD_KEYS, ''], default: '' },

    referrer: { type: referrerSchema, default: undefined },
    contact: { type: contactSchema, default: undefined },

    /** The CV it was sent with. `default: undefined`, so "no CV recorded" is absent. */
    resume: { type: resumeRefSchema, default: undefined },

    /**
     * When you sent it. Not `createdAt`, and nullable.
     *
     * `createdAt` is when the *row* was written, which for the first thirty
     * applications anybody logs is some evening weeks after the fact. Every
     * number in the funnel is measured from this field, so it has to be the one
     * the user can set.
     *
     * Null is correct for a `wishlist` card, and it is stamped automatically the
     * first time the card leaves that stage — the way `completedAt` is stamped
     * by a column's kind rather than by its name.
     */
    appliedAt: { type: Date, default: null },

    /** "Chase this by Friday." Null means nothing is owed. */
    followUpBy: { type: Date, default: null },

    reached: { type: reachedSchema, default: () => ({}) },

    rounds: { type: [roundSchema], default: [] },
    touchpoints: { type: [touchpointSchema], default: [] },

    comp: { type: compensationSchema, default: undefined },
    postMortem: { type: postMortemSchema, default: undefined },

    closedAt: { type: Date, default: null },
    closedReason: { type: String, enum: [...CLOSED_REASONS, ''], default: '' },

    /** How you feel about the place, out of five. Null is "have not decided". */
    excitement: { type: Number, default: null, min: 1, max: 5 },
    priority: { type: String, enum: PRIORITIES, default: 'none' },

    notes: { type: String, default: '', maxlength: 8000 },
    tags: { type: [String], default: [] },

    /* ---------------------------------------------------------------------- */
    /* derived — written by the pre-save hook, never accepted from a client    */
    /* ---------------------------------------------------------------------- */

    /**
     * The soonest future round that is still unsettled, or null.
     *
     * Denormalised so the board read can sort and badge without unwinding the
     * rounds array, and so "what is coming up this week" is an index scan
     * rather than a scan of every application. Recomputed whenever `rounds`
     * changes: a card showing a stale next-round date still shows *a* date, and
     * nothing in the response says it is wrong.
     */
    nextRoundAt: { type: Date, default: null },

    /**
     * The last thing that happened, from either side.
     *
     * Deliberately not `updatedAt`: fixing a typo in the job title is not
     * activity on the application, and if it counted, the act of tidying your
     * board would reset every staleness badge on it.
     *
     * Future stamps are excluded, which is the other half of the same idea. A
     * round booked for next Thursday has not happened; letting it count would
     * make every application with an interview in the diary look freshly active
     * and suppress the follow-up nudge for exactly the two weeks you most need
     * it.
     */
    lastActivityAt: { type: Date, default: null },

    /**
     * The first time they came back to you.
     *
     * Stored rather than computed in the pipeline, so the median-days-to-reply
     * aggregation is a projection over one field instead of a three-way `$min`
     * over two arrays — and so the same definition cannot be written twice and
     * differently.
     */
    firstReplyAt: { type: Date, default: null },

    /** Cheap counts for the card, so the board read need not carry questions. */
    roundCount: { type: Number, default: 0 },
    questionCount: { type: Number, default: 0 },

    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

/* -------------------------------------------------------------------------- */
/* derived fields                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Keeps the denormalised fields honest without asking any caller to remember.
 *
 * All of them are recomputed from scratch rather than adjusted incrementally. A
 * full pass over twenty rounds is free, and it is the only version that cannot
 * drift: an incremental update has to be correct for insert, edit, delete and
 * reschedule separately, and the one that is wrong produces a card confidently
 * announcing next Tuesday for a round that was cancelled.
 *
 * This hook is also why every write in this module goes through
 * `load -> mutate -> save()` rather than an `updateOne` with `arrayFilters`.
 * The two-level `rounds.$[r].questions.$[q]` update is genuinely more elegant,
 * and it bypasses this — leaving `questionCount` wrong after an edit and
 * `nextRoundAt` pointing at a round that has since been cancelled.
 */
applicationSchema.pre('save', function deriveApplication(next) {
  if (this.isModified('company')) this.companySlug = companySlug(this.company);

  if (this.isModified('stage')) {
    /*
      Leaving the wishlist is what makes something an application. Stamped only
      when null, so a date you typed in yourself is never overwritten.
    */
    if (this.stage !== 'wishlist' && !this.appliedAt) this.appliedAt = new Date();

    /* Monotone — see reachedSchema. Only ever filled in, never cleared, and
       never back-filled for stages that were skipped. */
    if (REACHED_KEYS.includes(this.stage) && !this.reached?.[this.stage]) {
      this.reached[this.stage] = this.appliedAt || new Date();
    }

    if (stageClosed(this.stage)) {
      if (!this.closedAt) this.closedAt = new Date();
    } else {
      /*
        Re-opening clears the close: a card dragged back out of `rejected` is
        one you filed wrongly, and a `closedAt` left behind would make it both
        live and finished at once. The *reason* is kept — it is a sentence about
        the past, and making you retype it is worse than a stale dropdown you
        can see.
      */
      this.closedAt = null;
    }
  }

  const touchedTimeline =
    this.isModified('rounds') ||
    this.isModified('touchpoints') ||
    this.isModified('appliedAt') ||
    this.isModified('reached');

  if (touchedTimeline) {
    const rounds = this.rounds || [];
    const touchpoints = this.touchpoints || [];
    const now = Date.now();

    this.roundCount = rounds.length;
    this.questionCount = rounds.reduce((total, round) => {
      round.questionCount = round.questions?.length || 0;
      return total + round.questionCount;
    }, 0);

    const upcoming = rounds
      .filter((round) => round.scheduledAt && !outcomeSettled(round.outcome))
      .map((round) => +round.scheduledAt)
      .filter((at) => at >= now);
    this.nextRoundAt = upcoming.length ? new Date(Math.min(...upcoming)) : null;

    const happened = [
      this.appliedAt,
      ...rounds.flatMap((round) => [round.scheduledAt, round.outcomeAt]),
      ...touchpoints.map((touchpoint) => touchpoint.at),
    ]
      .filter(Boolean)
      .map(Number)
      .filter((at) => at <= now);
    this.lastActivityAt = happened.length ? new Date(Math.max(...happened)) : this.appliedAt;

    /*
      Clamped to `>= appliedAt`, so a mistyped date cannot produce a negative
      days-to-reply and poison the median the whole report hangs on.
    */
    const applied = this.appliedAt ? +this.appliedAt : null;
    const replies = [
      this.reached?.screening,
      ...touchpoints.filter((touchpoint) => touchpoint.fromThem).map((touchpoint) => touchpoint.at),
      ...rounds.map((round) => round.scheduledAt),
    ]
      .filter(Boolean)
      .map(Number)
      .filter((at) => applied === null || at >= applied);
    this.firstReplyAt = replies.length ? new Date(Math.min(...replies)) : null;
  }

  next();
});

/* -------------------------------------------------------------------------- */
/* indexes                                                                     */
/* -------------------------------------------------------------------------- */

/*
  The board read: every live application for one person, already in lane order.
  Its `{ user, deletedAt }` prefix is also what every stats aggregation matches
  on, so the funnel is an index scan rather than a collection scan.
*/
applicationSchema.index({ user: 1, deletedAt: 1, stage: 1, order: 1 });

/*
  "What is coming up" — the due badge and the upcoming rail. Most applications
  have a null `nextRoundAt` and null sorts first, so the rows worth reading are
  a contiguous tail.
*/
applicationSchema.index({ user: 1, deletedAt: 1, nextRoundAt: 1 });

/*
  "Have I applied here before", asked at create time to warn about a
  reapplication, and the grouping behind per-company history.

  Not unique, and that is deliberate: two roles at one company and re-applying
  six months later are both normal, and both are separate rows with separate
  timelines. The second application's outcome is the only way to tell whether
  the first rejection stuck.

  Deliberately not prefixed with `deletedAt` either — the warning has to fire
  for an application you trashed, because somewhere you deleted the record of is
  exactly the one you have forgotten about.
*/
applicationSchema.index({ user: 1, companySlug: 1, appliedAt: -1 });

/* -------------------------------------------------------------------------- */
/* queries                                                                     */
/* -------------------------------------------------------------------------- */

/** Live applications only — the base every read starts from. */
applicationSchema.statics.live = function live(filter = {}) {
  return this.find({ ...filter, deletedAt: null });
};

applicationSchema.statics.softDelete = function softDelete(id, userId = null) {
  return this.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId } },
    { new: true },
  );
};

/* -------------------------------------------------------------------------- */
/* the timeline                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The story of one application, derived.
 *
 * Not a second event log, and that is the decision this module turns on. Every
 * row below is projected from a dated fact the record already holds, so editing
 * a round's date moves its row because the row *is* the round, and deleting a
 * round deletes its row because there was never a copy of it anywhere else.
 *
 * The alternative was worked through and has no good branch. Mutate the stored
 * event and it is not a log, it is a denormalised cache of the round with a
 * consistency bug for every field somebody forgets. Append a correction and the
 * screen that answered "what happened with Razorpay" starts answering "what did
 * I type, and when" — six rows for one interview, five of them about data
 * entry. Leave it alone and the timeline lies, which is the worst of the three,
 * because a narrative is the thing a reader trusts most. And a deleted round
 * has no branch at all: its events become orphans needing a liveness check
 * against the rounds array on every render, which is this function, written
 * twice and badly.
 *
 * The only thing a stored log buys is an audit trail, and this collection has
 * exactly one writer who is also its only reader.
 *
 * Two things genuinely cannot be derived and are therefore stored, and both are
 * read back in here: `reached` (when each stage was first entered — `stage`
 * holds only the current value) and `touchpoints` (a recruiter called, you
 * chased them; there is no source document to project those from).
 *
 * `id` is a synthetic address — `round:<oid>`, `stage:applied`, `touch:<oid>`.
 * Stable across reads so the client can key a list and scroll to a row, and
 * obviously not a document id anybody should try to PATCH.
 */
export const applicationTimeline = (app) => {
  const rows = [];

  const appliedAt = app.appliedAt ? +app.appliedAt : null;

  if (app.appliedAt) {
    rows.push({
      id: 'stage:applied',
      at: app.appliedAt,
      kind: 'applied',
      title: 'Applied',
      detail: app.source || '',
      ref: null,
    });
  }

  REACHED_KEYS.forEach((key) => {
    const at = app.reached?.[key];
    if (!at) return;
    /*
      `reached.applied` and `appliedAt` are the same instant in almost every
      case, and two rows saying the same thing one pixel apart is how a timeline
      starts looking like a changelog.
    */
    if (key === 'applied' && appliedAt !== null && +at === appliedAt) return;
    rows.push({
      id: `stage:${key}`,
      at,
      kind: 'stage',
      title: key,
      detail: '',
      ref: null,
    });
  });

  (app.rounds || []).forEach((round) => {
    if (!round.scheduledAt) return;
    rows.push({
      id: `round:${round._id}`,
      at: round.scheduledAt,
      kind: 'round',
      title: round.label || round.type,
      detail: round.outcome,
      ref: { roundId: round._id, type: round.type, family: roundFamily(round.type) },
    });
  });

  if (app.comp?.receivedAt) {
    rows.push({
      id: 'offer:received',
      at: app.comp.receivedAt,
      kind: 'offer',
      title: 'Offer received',
      detail: app.comp.offered != null ? String(app.comp.offered) : '',
      ref: null,
    });
  }

  (app.touchpoints || []).forEach((touchpoint) => {
    rows.push({
      id: `touch:${touchpoint._id}`,
      at: touchpoint.at,
      kind: 'touchpoint',
      title: touchpoint.kind,
      detail: touchpoint.note || '',
      ref: { fromThem: Boolean(touchpoint.fromThem) },
    });
  });

  if (app.closedAt) {
    rows.push({
      id: 'stage:closed',
      at: app.closedAt,
      kind: 'closed',
      title: app.stage,
      detail: app.closedReason || '',
      ref: app.postMortem
        ? { roundType: app.postMortem.roundType, roundLabel: app.postMortem.roundLabel }
        : null,
    });
  }

  return rows.sort((a, b) => new Date(b.at) - new Date(a.at));
};

/* -------------------------------------------------------------------------- */
/* wire shapes                                                                 */
/* -------------------------------------------------------------------------- */

applicationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const publicQuestion = (question) => ({
  id: question._id,
  text: question.text,
  answer: question.answer || '',
  rating: question.rating || '',
  topic: question.topic || '',
  notes: question.notes || '',
  order: question.order ?? 0,
  addedAt: question.addedAt ?? null,
});

/**
 * A round without its questions — what the card gets.
 *
 * `questionCount` rather than the questions themselves, so the card can say
 * "12 questions" and the drawer can show them. The client tells a card round
 * from a full one by the presence of `questions`, which is `undefined` here and
 * never `[]` — so "not loaded" cannot be mistaken for "none were asked".
 */
const roundSummary = (round) => ({
  id: round._id,
  type: round.type,
  family: roundFamily(round.type),
  label: round.label || '',
  order: round.order ?? 0,
  scheduledAt: round.scheduledAt ?? null,
  rescheduledCount: (round.rescheduledFrom || []).length,
  durationMinutes: round.durationMinutes ?? null,
  mode: round.mode || '',
  outcome: round.outcome,
  outcomeAt: round.outcomeAt ?? null,
  feeling: round.feeling ?? null,
  /* The stored count, because on a card the array has been projected away —
     see `questionCount` on the round. The array wins when it is present, so a
     full read is always authoritative over a stale denormalised number. */
  questionCount: round.questions ? round.questions.length : round.questionCount ?? 0,
});

const publicRound = (round) => ({
  ...roundSummary(round),
  rescheduledFrom: round.rescheduledFrom || [],
  interviewers: (round.interviewers || []).map((person) => ({
    name: person.name || '',
    title: person.title || '',
    contact: person.contact || '',
  })),
  notes: round.notes || '',
  questions: [...(round.questions || [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(publicQuestion),
});

const plain = (value) => (value?.toObject ? value.toObject() : value);

/**
 * One application as the board draws it.
 *
 * `logoSlug` and not a URL: the client assembles `/api/companies/<slug>/logo`
 * itself, which keeps a three-hundred-card board from carrying three hundred
 * identical path strings and lets the browser cache by slug across every
 * application to the same company.
 *
 * `stale` is computed here rather than in the browser because it is a
 * comparison against the *server's* clock, and a client whose system time is a
 * day out should not silently disagree with the rest of the app about which
 * cards are dead.
 */
export const applicationCard = (app, { staleAfterDays = DEFAULT_STALE_AFTER_DAYS } = {}) => {
  const idleMs = app.lastActivityAt ? Date.now() - +app.lastActivityAt : 0;
  const open = APPLICATION_STAGES[app.stage]?.kind === 'open';
  const comp = plain(app.comp);
  const referrer = plain(app.referrer);
  const contact = plain(app.contact);

  return {
    id: app._id,
    stage: app.stage,
    column: APPLICATION_STAGES[app.stage]?.column || 'applied',
    order: app.order ?? 0,

    company: app.company,
    logoSlug: app.companySlug || '',
    role: app.role || '',
    team: app.team || '',
    level: app.level || '',
    employment: app.employment || 'full_time',
    location: app.location || '',
    workMode: app.workMode || '',
    links: (app.links || []).map((link) => ({ label: link.label || '', url: link.url })),

    source: app.source,
    sourceNote: app.sourceNote || '',
    applyMethod: app.applyMethod || '',
    /* On the card as well as in the drawer — "which CV did I send them" is a
       question you ask while scanning the board, and it is three short fields. */
    resume: app.resume?.url
      ? { id: app.resume.id ?? null, label: app.resume.label || '', url: app.resume.url }
      : null,
    /* One truthy check, which is why `referrer` is `default: undefined`. */
    referred: Boolean(referrer),
    referrer: referrer
      ? {
          name: referrer.name || '',
          title: referrer.title || '',
          relationship: referrer.relationship || '',
          contact: referrer.contact || '',
          askedAt: referrer.askedAt ?? null,
        }
      : null,
    contact: contact
      ? {
          name: contact.name || '',
          title: contact.title || '',
          email: contact.email || '',
          phone: contact.phone || '',
        }
      : null,

    appliedAt: app.appliedAt ?? null,
    followUpBy: app.followUpBy ?? null,
    nextRoundAt: app.nextRoundAt ?? null,
    lastActivityAt: app.lastActivityAt ?? null,
    firstReplyAt: app.firstReplyAt ?? null,
    closedAt: app.closedAt ?? null,
    closedReason: app.closedReason || '',

    reached: { ...(plain(app.reached) || {}) },

    rounds: [...(app.rounds || [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(roundSummary),
    roundCount: app.roundCount ?? 0,
    questionCount: app.questionCount ?? 0,

    comp: comp
      ? {
          currency: comp.currency || 'INR',
          expected: comp.expected ?? null,
          offered: comp.offered ?? null,
          base: comp.base ?? null,
          bonus: comp.bonus ?? null,
          joiningBonus: comp.joiningBonus ?? null,
          esop: comp.esop ?? null,
          esopNote: comp.esopNote || '',
          receivedAt: comp.receivedAt ?? null,
          decideBy: comp.decideBy ?? null,
          notes: comp.notes || '',
        }
      : null,

    excitement: app.excitement ?? null,
    priority: app.priority || 'none',
    tags: app.tags || [],

    stale: open && idleMs > staleAfterDays * 24 * 60 * 60 * 1000,
    idleDays: app.lastActivityAt ? Math.floor(idleMs / 86400000) : null,

    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
};

/**
 * The whole application, for the drawer.
 *
 * Built by adding to the card, and the direction is the point — the same
 * argument `feedbackRow` makes about `feedbackCard`. A field added to the card
 * is deliberately on the board, and a field added only here is deliberately
 * behind a click, because of where it was written rather than because somebody
 * remembered to strip it.
 *
 * This is the one place the module departs from `publicTask`, which refuses a
 * card shape at all. The reason is arithmetic rather than taste: a task's
 * largest field is four thousand characters of notes, and an application's is
 * twenty rounds of forty answers. The split is drawn at exactly one place —
 * `rounds[].questions` — so the two shapes cannot develop different opinions
 * about what an application is.
 */
export const publicApplication = (app, opts = {}) => ({
  ...applicationCard(app, opts),
  rounds: [...(app.rounds || [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(publicRound),
  notes: app.notes || '',
  jdText: app.jdText || '',
  touchpoints: [...(app.touchpoints || [])]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .map((touchpoint) => ({
      id: touchpoint._id,
      at: touchpoint.at,
      kind: touchpoint.kind,
      fromThem: Boolean(touchpoint.fromThem),
      note: touchpoint.note || '',
    })),
  postMortem: app.postMortem
    ? {
        /* Optional navigation, never a guaranteed link — the round it names may
           have been deleted, which is exactly what the snapshot is for. */
        roundId: app.postMortem.round ?? null,
        roundType: app.postMortem.roundType || '',
        roundLabel: app.postMortem.roundLabel || '',
        theirWord: app.postMortem.theirWord || '',
        myRead: app.postMortem.myRead || '',
      }
    : null,
  timeline: applicationTimeline(app),
});

export const Application = mongoose.model('Application', applicationSchema);
