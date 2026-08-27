import mongoose from 'mongoose';

/**
 * What you said the problem was, from the title alone.
 *
 * The revision queue used to ask you to press *I got it* while the problem was
 * in front of you, which tests nothing — recognition with the answer on screen
 * is not recall. Test mode collapses the row to its title and asks for the
 * trigger and the approach in one line before anything is revealed. This is
 * that line.
 *
 * Kept as a short series rather than one latest value, and that is the point of
 * storing it at all. One line tells you what you thought this morning; five over
 * four months tell you whether the idea is getting sharper or whether you have
 * been writing the same vague sentence since March. The writer caps it with
 * `$slice`, so a problem reviewed thirty times keeps its last ten and the
 * document cannot grow without bound.
 *
 * Shared by `Progress` and `CPProgress` for the reason the attempt sub-document
 * next door is: the two curriculums have one revision ladder between them, and a
 * field that existed on one queue and not the other would be a test mode that
 * silently forgot half of what you typed into it.
 */
export const recallSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    /**
     * Short on purpose. The exercise is naming the trigger — "sorted, and it
     * wants a pair" — not re-deriving the solution; a box you can write an essay
     * in invites re-deriving it, which is the twenty-five-minute thing this is
     * meant to replace.
     */
    text: { type: String, required: true, maxlength: 500 },
  },
  { _id: false },
);
