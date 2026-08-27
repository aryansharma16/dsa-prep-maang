import mongoose from 'mongoose';

/**
 * One sitting of the pattern drill.
 *
 * The drill shows a problem's title and asks which technique it wants. That is
 * the skill an interview actually tests first — you have ninety seconds to
 * recognise the shape, and everything after that is typing you can already do.
 * Re-solving a problem trains the typing at twenty-five minutes a repetition;
 * this trains the recognition at about three seconds.
 *
 * Stored per *run* rather than per answer, and that is the whole design. A
 * document per answer would be a write on every keypress-speed interaction and
 * a collection that grows by thousands a week for a signal that only means
 * anything in aggregate. A run is one write when you stop, holds its own score,
 * and carries the misses — which are the part worth keeping, because a pattern
 * you keep failing to recognise is the most actionable fact this app can
 * produce about you.
 *
 * Right answers are deliberately not stored. Knowing you got 34 of 40 and which
 * 6 were wrong is the whole of it; recording the 34 would triple the document to
 * say "and the rest were fine".
 */

const missSchema = new mongoose.Schema(
  {
    /**
     * The problem that was shown.
     *
     * A ref with no snapshot, unlike `Task.questions` — and the difference is
     * what the row is for. A task names a problem you meant to do and has to
     * still render its title after you delete it. A miss is a statistic: if the
     * problem is gone, so is the pattern it was evidence about, and a dangling
     * entry should disappear from the report rather than persist as a title
     * pointing at nothing. The aggregation `$lookup`s it and drops what does not
     * resolve.
     */
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },

    /**
     * The pattern that was picked instead.
     *
     * A slug rather than a ref, because it is answering "what did this look like
     * to you" — and the interesting cases are the confusable pairs. Sliding
     * window answered as two pointers is a different and more fixable mistake
     * than sliding window answered as dynamic programming, and only the wrong
     * answer says which it was.
     */
    chose: { type: String, default: '', maxlength: 64 },
  },
  { _id: false },
);

const drillRunSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    at: { type: Date, default: Date.now },

    /** How many questions were answered, and how many were right. */
    total: { type: Number, required: true, min: 1, max: 500 },
    correct: { type: Number, required: true, min: 0, max: 500 },

    misses: { type: [missSchema], default: [] },
  },
  { timestamps: true },
);

/** The history list and the accuracy trend, both newest-first per account. */
drillRunSchema.index({ user: 1, at: -1 });

export const DrillRun = mongoose.model('DrillRun', drillRunSchema);
