import { z } from 'zod';

import { ChatUsage } from '../../models/ChatUsage.js';
import { Conversation } from '../../models/Conversation.js';
import { Message } from '../../models/Message.js';
import { Setting } from '../../models/Setting.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AUDIT, diff, recordAudit } from '../../services/audit.service.js';
import { catalogue, PROVIDER_IDS } from '../../services/ai/registry.js';
import { CHAT_DEFAULTS, chatSettings, invalidateSettings } from '../../services/settings.service.js';

/**
 * Site settings, and the chat data they govern.
 *
 * Read is `settings:read` so an admin can answer "is chat working" without
 * being able to change what it costs; write is `settings:write`, which only the
 * super admin holds. See config/roles.js for why that is its own capability
 * rather than a reuse of content:write.
 */

export const settingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    retentionHours: z.number().int().min(1).max(24 * 30).optional(),
    providers: z.array(z.enum(PROVIDER_IDS)).min(1).max(PROVIDER_IDS.length).optional(),
    dailyMessageCap: z.number().int().min(1).max(1000).optional(),
    maxHistoryMessages: z.number().int().min(2).max(100).optional(),
    maxInputChars: z.number().int().min(200).max(4000).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')
  .refine((body) => !body.providers || new Set(body.providers).size === body.providers.length, {
    message: 'A provider cannot appear twice',
    path: ['providers'],
  });

/** Counts the panel shows next to the retention control, so the number means something. */
async function chatStats() {
  const [conversations, messages, oldest] = await Promise.all([
    Conversation.countDocuments(),
    Message.countDocuments(),
    Conversation.findOne().sort({ lastMessageAt: 1 }).select('lastMessageAt').lean(),
  ]);
  return { conversations, messages, oldestMessageAt: oldest?.lastMessageAt || null };
}

export const getSettings = asyncHandler(async (req, res) => {
  const chat = await chatSettings();
  res.json({
    chat,
    defaults: CHAT_DEFAULTS,
    // Live provider state — which have keys, which are cooling down and why.
    // `health.kind` is a code, never the upstream's message; see ai/errors.js.
    providers: catalogue(chat.providers),
    stats: await chatStats(),
  });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const before = await chatSettings();

  const doc = await Setting.findOneAndUpdate(
    { key: 'app' },
    {
      $set: {
        ...Object.fromEntries(Object.entries(req.body).map(([field, value]) => [`chat.${field}`, value])),
        updatedBy: req.actor._id,
        updatedByEmail: req.actor.email,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

  invalidateSettings();
  const after = await chatSettings();

  /*
    Retention changed, so every existing row's expiry is now wrong.

    This matters most in the direction that destroys data: dropping 720 hours to
    24 and leaving old conversations stamped with next month's date would mean
    history lingering for weeks after someone explicitly asked for a day. A
    retention setting that only governs future rows is not a retention setting.

    One aggregation-pipeline update per collection, so the arithmetic happens
    server-side in a single pass. It is awaited because a human is watching and
    the response reports what it touched. Unbounded by design — fine while a day
    of chat is a few hundred rows, and the first thing to make a background job
    if that ever stops being true.
  */
  let rescheduled = null;
  if (before.retentionHours !== after.retentionHours) {
    const ms = after.retentionHours * 60 * 60 * 1000;
    const [conversations, messages] = await Promise.all([
      Conversation.updateMany({}, [{ $set: { expiresAt: { $add: ['$lastMessageAt', ms] } } }]),
      Message.updateMany({}, [{ $set: { expiresAt: { $add: ['$createdAt', ms] } } }]),
    ]);
    rescheduled = { conversations: conversations.modifiedCount, messages: messages.modifiedCount };
  }

  await recordAudit(req, {
    action: AUDIT.SETTINGS_UPDATE,
    targetType: 'settings',
    targetId: String(doc._id),
    targetLabel: 'chat',
    meta: {
      ...diff(before, after, [
        'enabled',
        'retentionHours',
        'providers',
        'dailyMessageCap',
        'maxHistoryMessages',
        'maxInputChars',
      ]),
      ...(rescheduled ? { rescheduled } : {}),
    },
  });

  res.json({ chat: after, rescheduled, providers: catalogue(after.providers), stats: await chatStats() });
});

/**
 * Delete every conversation on the deployment, now.
 *
 * The retention window is the ordinary path; this is the one for when something
 * has to be gone before it. Usage counters are deliberately left alone — they
 * are the spend record, not the content, and wiping them would hand everyone a
 * fresh daily allowance as a side effect of a privacy action.
 */
export const purgeChats = asyncHandler(async (req, res) => {
  const [messages, conversations] = await Promise.all([Message.deleteMany({}), Conversation.deleteMany({})]);

  await recordAudit(req, {
    action: AUDIT.CHAT_PURGE,
    targetType: 'settings',
    targetLabel: 'chat',
    meta: { conversations: conversations.deletedCount, messages: messages.deletedCount },
  });

  res.json({ conversations: conversations.deletedCount, messages: messages.deletedCount });
});

/** Spend, for the panel. Survives a purge, which is the point of it being separate. */
export const getChatUsage = asyncHandler(async (req, res) => {
  const rows = await ChatUsage.aggregate([
    { $group: { _id: '$day', messages: { $sum: '$messages' }, tokensIn: { $sum: '$tokensIn' }, tokensOut: { $sum: '$tokensOut' }, users: { $sum: 1 } } },
    { $sort: { _id: -1 } },
    { $limit: 14 },
  ]);
  res.json({ days: rows.map(({ _id, ...rest }) => ({ day: _id, ...rest })) });
});
