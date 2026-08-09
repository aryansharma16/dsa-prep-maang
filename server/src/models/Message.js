import mongoose from 'mongoose';

/**
 * One turn in a conversation.
 *
 * There is no `system` role here, deliberately. The system prompt is rebuilt
 * from live data on every request — the attached problem's difficulty, the
 * asker's progress on it — so storing a copy would only create something that
 * can disagree with what the model was actually told.
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    /**
     * Denormalised from the conversation.
     *
     * Ownership is checked on every message read, and "delete everything mine"
     * has to reach messages directly. Both become a join without this, on the
     * hot path, to save one ObjectId per row.
     */
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    role: { type: String, enum: ['user', 'assistant'], required: true },
    // Roughly 4k tokens. The input cap is far lower; this ceiling is for
    // replies, and for the partial that gets persisted when a stream dies.
    content: { type: String, required: true, maxlength: 16000 },

    provider: { type: String, default: '' },
    model: { type: String, default: '' },

    /** The upstream died mid-answer. The client shows this text plus a retry. */
    truncated: { type: Boolean, default: false },
    /** The reader pressed stop. Not a failure, and must not be presented as one. */
    stoppedByUser: { type: Boolean, default: false },

    /**
     * The problem attached to *this turn*, not to the thread.
     *
     * Attachment is per-message: you can ask about one problem, then another,
     * in the same conversation. Reading the thread's current attachment back
     * onto an old turn would misattribute what the model was actually shown.
     */
    problemSlug: { type: String, default: '' },

    tokens: {
      in: { type: Number, default: 0 },
      out: { type: Number, default: 0 },
    },

    /** Same mechanism as Conversation.expiresAt — see the note there. */
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true },
);

/** Reading a thread, and walking it backwards for the history window. */
messageSchema.index({ conversation: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
