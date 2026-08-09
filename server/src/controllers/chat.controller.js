import { z } from 'zod';

import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Problem } from '../models/Problem.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { objectId, paged, pageQuery } from '../utils/query.js';
import { catalogue, PROVIDER_IDS } from '../services/ai/registry.js';
import { chatSettings } from '../services/settings.service.js';
import { SUGGESTIONS } from '../services/chat/prompt.js';
import {
  deleteAllConversations,
  deleteConversation,
  runChat,
  stopStream,
} from '../services/chat/chat.service.js';

/*
  The static 4000 here and `settings.maxInputChars` are not the same thing and
  are not meant to be. This schema is the contract — the largest message this
  endpoint will ever accept, which bounds what a request can cost before any
  database read happens. The setting is the policy inside that contract, and it
  is enforced in the service where the settings are already loaded. Zod cannot
  read the database, and a schema that changed shape per deployment would not be
  a contract.
*/
export const sendSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  conversationId: objectId.nullish(),
  // Provider and model travel together: a model id alone is ambiguous across
  // providers, and the pair is what the picker actually selects.
  provider: z.enum(PROVIDER_IDS).optional(),
  model: z.string().max(80).optional(),
  problemId: objectId.nullish(),
});

export const stopSchema = z.object({ conversationId: objectId });

export const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    problemId: objectId.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');

/** What the composer needs before it will let anyone type. */
export const getConfig = asyncHandler(async (req, res) => {
  const settings = await chatSettings();
  const providers = catalogue(settings.providers);

  // Flattened to models, because that is what a picker is a list of. A provider
  // with no key still appears, marked unavailable — hiding it makes "why is
  // Cerebras not in the list" unanswerable from the UI.
  const models = providers.flatMap((provider) =>
    provider.models.map((model) => ({
      id: model.id,
      label: model.label,
      provider: provider.id,
      providerLabel: provider.label,
      available: provider.configured && provider.enabled && provider.health.ok,
    })),
  );

  const preferred = providers.find((p) => p.enabled && p.configured && p.health.ok);

  res.json({
    enabled: settings.enabled && providers.some((p) => p.configured),
    models,
    defaultProvider: preferred?.id || null,
    defaultModel: preferred?.defaultModel || null,
    suggestions: SUGGESTIONS,
    retentionHours: settings.retentionHours,
    dailyMessageCap: settings.dailyMessageCap,
    maxInputChars: settings.maxInputChars,
  });
});

export const listConversations = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const filter = { user: req.userId };

  const [rows, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('title problemSlug problemTitle provider model messageCount lastMessageAt expiresAt createdAt')
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  res.json(paged('conversations', rows, { total, page, limit }));
});

export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.id, user: req.userId }).lean();
  if (!conversation) throw ApiError.notFound('That conversation no longer exists', 'NO_CONVERSATION');

  const messages = await Message.find({ conversation: conversation._id })
    .sort({ createdAt: 1 })
    .select('role content provider model truncated stoppedByUser problemSlug createdAt')
    .lean();

  res.json({ conversation, messages });
});

export const updateConversation = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.id, user: req.userId });
  if (!conversation) throw ApiError.notFound('That conversation no longer exists', 'NO_CONVERSATION');

  if (req.body.title !== undefined) {
    conversation.title = req.body.title;
    // Tells the auto-namer to keep its hands off from here on.
    conversation.titleSetByUser = true;
  }

  if (req.body.problemId !== undefined) {
    if (req.body.problemId === null) {
      conversation.set({ problem: null, problemSlug: '', problemTitle: '' });
    } else {
      const problem = await Problem.findOne({
        _id: req.body.problemId,
        $or: [{ owner: null }, { owner: req.userId }],
      })
        .select('slug title')
        .lean();
      if (!problem) throw ApiError.notFound('That problem no longer exists', 'NO_PROBLEM');
      conversation.set({ problem: problem._id, problemSlug: problem.slug, problemTitle: problem.title });
    }
  }

  await conversation.save();
  res.json({ conversation: conversation.toObject() });
});

export const removeConversation = asyncHandler(async (req, res) => {
  await deleteConversation(req.userId, req.params.id);
  res.json({ ok: true });
});

export const removeAllConversations = asyncHandler(async (req, res) => {
  res.json(await deleteAllConversations(req.userId));
});

export const stop = asyncHandler(async (req, res) => {
  res.json({ stopped: stopStream(req.userId, req.body.conversationId) });
});

const frame = (event, payload) => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

/**
 * The streaming endpoint.
 *
 * Not wrapped in asyncHandler, and that is the point: once `flushHeaders()` has
 * run there is no status line left to set, so an error cannot be handed to the
 * error middleware. Everything before the first write may throw normally —
 * `runChat` is built so that all of it does — and everything after is caught
 * here and sent as an event.
 */
export async function stream(req, res, next) {
  const events = runChat({ userId: req.userId, ...req.body });

  let started = false;
  let heartbeat = null;

  /*
    The reader navigated away, closed the tab, or hit stop. Node fires `close`
    on normal completion too, so `started && !res.writableEnded` is what
    separates "they left" from "we finished" — without it, every successful
    stream would also look like an abort.
  */
  req.on('close', () => {
    if (heartbeat) clearInterval(heartbeat);
    if (started && !res.writableEnded) events.return?.();
  });

  try {
    for await (const event of events) {
      if (!started) {
        started = true;
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          // `no-transform` matters as much as `no-cache`: it is gzip, not
          // caching, that reintroduces buffering through a proxy.
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          // nginx honours this from upstream, which is what makes streaming
          // work through the reverse proxy without editing its config.
          'X-Accel-Buffering': 'no',
        });
        res.flushHeaders();
        // Keeps an idle proxy from closing a connection that is waiting on a
        // slow first token of a later turn.
        heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write(':\n\n');
        }, 15000);
      }

      const { type, ...payload } = event;
      res.write(frame(type, payload));
    }
  } catch (error) {
    // Before the first byte this is an ordinary request that failed, and the
    // client's normal error handling should see a real status code.
    if (!started) return next(error);

    res.write(
      frame('error', {
        code: error.code || 'AI_FAILED',
        message: error.message || 'The assistant stopped responding',
      }),
    );
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (started && !res.writableEnded) res.end();
  }
  return undefined;
}

export const listQuery = pageQuery;
