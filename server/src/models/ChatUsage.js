import mongoose from 'mongoose';

/**
 * What one account spent on chat in one UTC day.
 *
 * Modelled on DailyLine, including the `default: 0` on the counter for the same
 * reason: the write that creates the row also `$inc`s it, and a schema default
 * on a field being `$inc`ed is a write conflict rather than an off-by-one.
 *
 * Note the lifetime, which is the trap in this whole feature. These rows are
 * *not* on the chat retention TTL, and must never be moved onto it. Chat
 * retention is "delete the conversations after a day"; if the usage counter
 * expired with them, the daily cap would reset every time chats were swept and
 * the cap would quietly stop existing. Different data, different obligation,
 * different lifetime — which is also why this is its own collection rather than
 * a counter hanging off Conversation.
 */
const chatUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /** UTC `YYYY-MM-DD`, from activity.service.js — the same bucket the streak uses. */
    day: { type: String, required: true },

    messages: { type: Number, default: 0 },
    tokensIn: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },

    /** `{ cerebras: 12, gemini: 3 }` — which providers actually served this account. */
    byProvider: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Forty days: long enough to answer "why was my bill like that last month",
    // short enough that nobody has to think about this collection.
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 40 },
  },
  { timestamps: false },
);

chatUsageSchema.index({ user: 1, day: 1 }, { unique: true });

export const ChatUsage = mongoose.model('ChatUsage', chatUsageSchema);
