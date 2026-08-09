import mongoose from 'mongoose';

/**
 * The one line a model wrote for one person on one day.
 *
 * This is a cache, not a record. It exists so that asking Gemini is something
 * that happens once a day per active account rather than once per page view —
 * the unique index below is what enforces that, not a counter someone has to
 * remember to increment.
 *
 * `signals` is the snapshot the line was written from. Without it, a line that
 * reads oddly is unexplainable a day later; with it you can see that it was
 * told the streak was four and said three.
 */
const dailyLineSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** UTC `YYYY-MM-DD`, the same bucket the streak uses. */
    day: { type: String, required: true },

    text: { type: String, required: true, maxlength: 240 },
    /** Which model wrote it — these get retired, and old rows should say so. */
    model: { type: String, default: '' },
    signals: { type: mongoose.Schema.Types.Mixed, default: {} },

    /**
     * How many times a model has been asked for this person today.
     *
     * The row is rewritten in place when the numbers it quotes stop being true,
     * so this is the only thing standing between "the line keeps up with you"
     * and an unbounded number of calls on a free-tier key.
     *
     * Defaults to 0, not 1: the write that creates the row also `$inc`s this,
     * and a schema default on a field being `$inc`ed is a write conflict rather
     * than an off-by-one.
     */
    generations: { type: Number, default: 0 },

    // A cache with no expiry is a leak with good manners. Thirty days is long
    // enough to explain a line someone asks about and short enough that this
    // collection never becomes a thing anyone has to think about.
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
  },
  { timestamps: false },
);

/**
 * One line per person per day, enforced by the database.
 *
 * Two tabs opening at the same moment both miss the cache; the in-process
 * single-flight in motivation.ai.js collapses that to one call, and this index
 * is what catches the case it cannot see — two server processes.
 */
dailyLineSchema.index({ user: 1, day: 1 }, { unique: true });

export const DailyLine = mongoose.model('DailyLine', dailyLineSchema);
