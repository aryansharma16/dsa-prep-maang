import mongoose from 'mongoose';
import { recallSchema } from './schemas/recall.js';

/**
 * One account's standing with one Learn topic.
 *
 * Learn is 117 topics of reference prose — the Complexity, React and Node notes —
 * and until now it was the one thing in the app you could read and never see
 * again. The roadmap schedules a problem to come back in three days; a topic you
 * read once in week two was simply gone by week nine, which is the opposite of
 * how the rest of this app treats knowledge.
 *
 * So a topic gets the same treatment a problem does, on the same ladder: mark it
 * read, say how solid it felt, and it comes back on the 3/7/21/60 schedule
 * stretched or compressed by that confidence. The interval maths is not
 * reimplemented here — `nextReview()` in services/review.service.js is the one
 * implementation, shared with both problem curriculums, so all three queues
 * cannot drift apart.
 *
 * ---------------------------------------------------------------------------
 * Why the topic is a pair of slugs and not a ref.
 *
 * This used to read "Learn has no collection", and that was the whole argument:
 * the prose was authored as modules in the client bundle, so there was nothing
 * to point a ref at. `LearnTopic` exists now, and the premise is gone.
 *
 * The conclusion survives it. A ref would have to be backfilled, and the rows
 * that cannot be — the ones naming a slug that was renamed at some point — are
 * exactly the rows a ref is supposed to protect; it would fix them by losing
 * them. `LearnTopic.slugHistory` is the version of that idea which works, and it
 * is strictly larger: the read endpoint resolves an old slug to its canonical
 * one, so a rename stops breaking bookmarks and cross-module links too, not just
 * these rows. Nothing had to be migrated, and marking a topic stays one query.
 *
 * `npm run seed:learn` reports rows pointing at slugs that no longer exist,
 * which is the visibility that replaces the enforcement.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * Two facts on one row, and they must not be confused.
 *
 * **Read** — `readAt`, `lastViewedAt` — is a browsing fact. It is set by
 * scrolling to the bottom of a page as well as by the button, so it means "my
 * eyes have been over this", and it says nothing about whether you could explain
 * it tomorrow.
 *
 * **Scheduled** — `scheduledAt` and the three ladder fields — is the deliberate
 * act. It only ever happens when you press the control and say how solid it
 * felt.
 *
 * They live on one row because they are two facts about one topic, and they are
 * separate fields because a topic skimmed on a train must never turn up in
 * Tuesday's revision queue. That was the argument for keeping read in
 * localStorage; the argument was for keeping the two *meanings* apart, and it is
 * `scheduledAt` that does that now — so read can be on the server, and follow
 * you between browsers, without the queue ever hearing about it.
 * ---------------------------------------------------------------------------
 */
const learnProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /** `complexity`, `react`, `node` — the track slug from client/src/learn/tracks.js. */
    track: { type: String, required: true, trim: true, maxlength: 64 },
    /** The topic slug within it, from that track's index. */
    topic: { type: String, required: true, trim: true, maxlength: 128 },

    /**
     * What it is called, captured when it is scheduled.
     *
     * Still a snapshot, and still for the reason `Task` snapshots a problem
     * title — but no longer for the reason written here before. The server used
     * to have no way to turn `react/use-effect` into "useEffect", so it trusted
     * a string the client sent; it reads it out of `LearnTopic` now, and the
     * request is not consulted.
     *
     * The field stays because a queue row has to render for a topic that has
     * since been deleted or renamed, and a list of slugs is not a queue.
     */
    title: { type: String, default: '', maxlength: 200 },

    /** First time your eyes reached the bottom, or you pressed the button. */
    readAt: { type: Date, default: null },
    /** Most recent of the same. Cheap, and it is what "recently read" needs. */
    lastViewedAt: { type: Date, default: null },

    /**
     * When this topic was put on the revision ladder — and `null` when it is not
     * on it.
     *
     * A field rather than a derivation, and that is deliberate. The obvious test
     * is `nextReviewAt != null`, and it is wrong twice: a topic dismissed from
     * the queue has its `nextReviewAt` cleared while still being something you
     * chose to learn, and a topic merely *read* has no business being confused
     * with either. One field that means one thing beats three fields read in a
     * particular combination that everybody has to remember.
     */
    scheduledAt: { type: Date, default: null },

    confidence: { type: Number, min: 1, max: 5, default: 3 },
    needsRevision: { type: Boolean, default: false },

    /* The same three fields the two problem curriculums carry, holding the same
       meanings, moved by the same function. */
    lastReviewedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null },
    reviewStage: { type: Number, default: 0 },

    /** What you said it was, in test mode. See schemas/recall.js. */
    recalls: { type: [recallSchema], default: [] },
  },
  { timestamps: true },
);

/** One row per account per topic — every upsert relies on this. */
learnProgressSchema.index({ user: 1, track: 1, topic: 1 }, { unique: true });
/** The queue lookup, matching the two problem collections' shape. */
learnProgressSchema.index({ user: 1, nextReviewAt: 1 });

export const LearnProgress = mongoose.model('LearnProgress', learnProgressSchema);
