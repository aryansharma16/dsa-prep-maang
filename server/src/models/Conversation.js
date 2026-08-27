import mongoose from 'mongoose';

/**
 * One chat thread, belonging to one person, for as long as retention allows.
 *
 * Separate from its messages rather than embedding them, and the reason is the
 * retention setting itself. At 24 hours an embedded array is obviously right —
 * no thread lives long enough to grow. But retention exists to be changed, and
 * at 30 days the argument inverts: documents grow and get relocated on every
 * append, and the conversation list — the most-requested route in the feature —
 * would have to project megabytes of messages away on every sidebar render.
 * Design for the setting being used, not for its default.
 */
const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, default: 'New chat', maxlength: 120 },
    /**
     * Set once someone renames the thread by hand.
     *
     * The auto-namer runs after the first reply and would otherwise overwrite a
     * deliberate title with its own guess — the same guard `Motivation.key` and
     * `PatternGuide.seededAt` use to keep a seeder off something a human owns.
     */
    titleSetByUser: { type: Boolean, default: false },

    /**
     * Which assistant answered here.
     *
     * `dsa` is the interview study assistant; `cp` is the competitive-programming
     * coach, which has a different persona, a different spoiler rule and a
     * different problem collection behind it. Stored on the thread rather than
     * passed per message because a conversation belongs to one of them — a
     * transcript that switched coach halfway through would read as two people.
     *
     * Defaults to `dsa`, which is what every thread written before this existed
     * was, so the history needs no migration.
     */
    mode: { type: String, enum: ['dsa', 'cp'], default: 'dsa', index: true },

    /*
      The attached problem, with its identity copied alongside the reference.
      A custom problem can be deleted while a conversation about it is still on
      screen, and a transcript that suddenly cannot say what it was about is
      worse than a stale title. Same reasoning as AuditLog's actorEmail.
    */
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', default: null },
    /**
     * The CP problem, when `mode` is `cp`.
     *
     * A separate reference rather than a polymorphic one on `problem`, because
     * mongoose populates by a fixed `ref` and the two point at different
     * collections. `problemSlug` and `problemTitle` are shared — they are the
     * copied identity that keeps a transcript readable after a delete, and that
     * fact does not depend on which collection it came from.
     */
    cpProblem: { type: mongoose.Schema.Types.ObjectId, ref: 'CPProblem', default: null },
    problemSlug: { type: String, default: '' },
    problemTitle: { type: String, default: '' },

    /** The last provider and model that answered here, for the UI badge. */
    provider: { type: String, default: '' },
    model: { type: String, default: '' },

    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now },

    /**
     * When this thread disappears, enforced by Mongo rather than by a job.
     *
     * `expireAfterSeconds: 0` means "delete each document once wall-clock
     * passes its own expiresAt", which is the whole trick: retention becomes a
     * number that write-time code stamps on rows, so changing it in the admin
     * panel takes effect without touching an index. The `expires` shorthand
     * used by DailyLine bakes the interval into the index at creation and
     * mongoose will not alter it afterwards — that model can afford it because
     * its 30 days are a constant, and this one cannot.
     */
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

/** The sidebar: this user's threads, newest activity first. */
conversationSchema.index({ user: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
