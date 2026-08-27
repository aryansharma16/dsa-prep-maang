import mongoose from 'mongoose';

import { ChatUsage } from '../../models/ChatUsage.js';
import { Conversation } from '../../models/Conversation.js';
import { Message } from '../../models/Message.js';
import { ApiError } from '../../utils/ApiError.js';
import { today } from '../activity.service.js';
import { chatSettings, expiryFrom } from '../settings.service.js';
import {
  anyProviderConfigured,
  backgroundProvider,
  candidatesFor,
  nextRetryAt,
  noteFailure,
  noteSuccess,
  providerById,
} from '../ai/registry.js';
import { classify } from '../ai/errors.js';
import { cleanTitle, draftTitle, recentTurns } from './history.js';
import { classifyTask } from './routing.js';
import { SYSTEM, TITLE_SYSTEM, problemContext } from './prompt.js';
import { CP_SYSTEM, cpProblemContext } from '../cp/cpChat.prompt.js';

/**
 * One message in, one reply out, over as many providers as it takes.
 *
 * The whole design turns on a single fact: an HTTP response is uncommitted
 * until its first byte. Everything before the first token can be retried on
 * another provider and the caller never knows; everything after it is visible
 * on someone's screen and cannot be taken back. `runChat` is an async generator
 * precisely so the controller can await the first event before writing headers
 * — a provider that wrote to the response itself would make that impossible.
 */

/** Per candidate. A host that accepts a connection and then says nothing must not hold the chain. */
const TTFT_MS = 8000;
/** Between two tokens. The timeout people forget, and the only one that catches a stall at token 200. */
const IDLE_MS = 20000;
/** Whole stream. */
const TOTAL_MS = 60000;

const TITLE_TIMEOUT_MS = 6000;

/** Two per account. One person with ten tabs is the cheapest attack on a feature with no rate limiter. */
const MAX_CONCURRENT_PER_USER = 2;

/**
 * Live streams, so they can be stopped and so a conversation cannot have two.
 *
 * In-process, which bounds what `POST /chat/stop` can promise: under pm2
 * cluster mode a stop request only works if it lands on the worker that owns
 * the stream. The client's own `AbortController` is the primary mechanism and
 * is not subject to that — this map is the cross-tab courtesy.
 *
 * @type {Map<string, {controller: AbortController, userId: string, reason: string|null}>}
 */
const activeStreams = new Map();

const streamKey = (userId, conversationId) => `${userId}:${conversationId || 'new'}`;

const activeCountFor = (userId) => {
  let count = 0;
  for (const entry of activeStreams.values()) if (entry.userId === userId) count += 1;
  return count;
};

/** Best-effort, and honest about it. Returns whether anything was actually stopped. */
export function stopStream(userId, conversationId) {
  const entry = activeStreams.get(streamKey(userId, conversationId));
  if (!entry) return false;
  entry.reason = 'stopped';
  entry.controller.abort();
  return true;
}

/**
 * Charge one message against today's allowance.
 *
 * Increment first, then compare what came back. The obvious ordering — read the
 * count, check it against the cap, write it back — lets two concurrent requests
 * both read `cap - 1` and both proceed. `$inc` inside the upsert is atomic, so
 * the returned value is already serialised against every other request, which
 * is the only version that holds under the concurrency the cap exists to bound.
 * Same argument DailyLine.generations makes.
 */
async function charge(userId, cap) {
  const day = today();
  const usage = await ChatUsage.findOneAndUpdate(
    { user: userId, day },
    { $inc: { messages: 1 }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (usage.messages > cap) {
    await ChatUsage.updateOne({ user: userId, day }, { $inc: { messages: -1 } });
    const error = new ApiError(429, `You have used all ${cap} messages for today`, 'CHAT_QUOTA');
    error.meta = { used: cap, cap, resetsAt: `${day}T24:00:00Z` };
    throw error;
  }
  return { used: usage.messages, remaining: Math.max(0, cap - usage.messages) };
}

/** Give it back when nothing was actually spent. An outage is not the caller's fault. */
const refund = (userId) =>
  ChatUsage.updateOne({ user: userId, day: today() }, { $inc: { messages: -1 } }).catch(() => {});

async function recordSpend(userId, providerId, usage) {
  if (!usage) return;
  await ChatUsage.updateOne(
    { user: userId, day: today() },
    {
      $inc: {
        tokensIn: usage.in || 0,
        tokensOut: usage.out || 0,
        [`byProvider.${providerId}`]: 1,
      },
    },
  ).catch(() => {});
}

/**
 * Try each candidate until one produces a token.
 *
 * Returns the live iterator *and* the first chunk it already yielded — the
 * first token has to be pulled to know the provider works, and it must not be
 * lost in the process of finding that out.
 */
async function openStream({ candidates, messages, system, signal, enabled }) {
  const tried = [];

  for (const { provider: id, model: useModel } of candidates) {
    const provider = providerById(id);
    if (!provider) continue;

    const ttft = new AbortController();
    // Two signals, one fetch: the caller's (navigation, stop) and ours (this
    // candidate is too slow). AbortSignal.any propagates whichever fires first.
    const composed = AbortSignal.any([signal, ttft.signal]);
    const timer = setTimeout(() => ttft.abort(), TTFT_MS);

    try {
      const iterator = provider.stream({ messages, system, model: useModel, signal: composed });

      /*
        Pull until the first *delta*, by hand.

        `for await (…) break` would be the obvious way to write this and is
        silently wrong: breaking out of a for-await calls `iterator.return()`,
        which closes the generator for good. The stream would deliver exactly
        one token and then report itself finished — a bug that looks like a
        provider truncating every reply after two words. Calling `.next()`
        directly leaves the generator open for the caller to drain.

        A `done` before any delta means the provider answered with nothing,
        which is a failure to answer; the loop falls through and the next
        candidate gets a turn.
      */
      let first = null;
      for (;;) {
        const step = await iterator.next();
        if (step.done) break;
        if (step.value.type === 'delta') {
          first = step.value;
          break;
        }
      }
      clearTimeout(timer);

      if (!first) {
        tried.push({ provider: id, model: useModel, code: 'EMPTY' });
        noteFailure(id, { status: 502, message: 'empty response' }, useModel);
        continue;
      }

      noteSuccess(id, useModel);
      return { provider, model: useModel, iterator, first, tried };
    } catch (error) {
      clearTimeout(timer);

      // The caller went away. That is not a provider failure and there is
      // nothing left to fail over to.
      if (signal.aborted) throw error;

      const kind = noteFailure(id, error, useModel);
      tried.push({ provider: id, model: useModel, code: kind });
    }
  }

  const configured = anyProviderConfigured();
  const error = new ApiError(
    configured ? 502 : 503,
    configured ? 'Every model is unavailable right now' : 'AI is not configured on this server',
    configured ? 'ALL_PROVIDERS_FAILED' : 'AI_DISABLED',
  );
  /*
    `retryAt` is the whole point of reporting this failure rather than just
    saying no. When every model is spent, the reader's real question is "is this
    broken, or do I wait" — and a daily quota has an exact answer, which
    errors.js computes as the next UTC midnight.
  */
  error.meta = { tried, retryAt: nextRetryAt(enabled) };
  throw error;
}

/**
 * The reply, as a sequence of events.
 *
 * Throws for anything that goes wrong before the first token — those become
 * ordinary HTTP status codes, so the client's normal error handling covers
 * them. Yields an `error` event for anything after, because by then the status
 * line is spent.
 */
export async function* runChat({
  userId,
  conversationId,
  content,
  provider: requestedProvider,
  model,
  problemId,
  cpProblemId,
  mode = 'dsa',
}) {
  const settings = await chatSettings();

  if (!settings.enabled) throw new ApiError(503, 'The assistant is switched off', 'CHAT_DISABLED');
  if (content.length > settings.maxInputChars) {
    throw new ApiError(400, `Keep it under ${settings.maxInputChars} characters`, 'MESSAGE_TOO_LONG');
  }
  if (activeCountFor(userId) >= MAX_CONCURRENT_PER_USER) {
    throw new ApiError(429, 'You already have two replies in flight', 'TOO_MANY_STREAMS');
  }

  /*
    Single-flight, but only for a thread that already exists.

    Two sends into the same conversation would interleave two replies into one
    transcript, so that is refused. Two *new* chats are genuinely different
    conversations that merely do not have ids yet — the dock and the full page
    are both open, and someone asked something in each. Keying those together
    would refuse the second for no reason, and the per-account concurrency cap
    above already covers the case this guard exists to prevent.
  */
  const key = streamKey(userId, conversationId);
  if (conversationId && activeStreams.has(key)) {
    throw new ApiError(409, 'This conversation is already replying', 'STREAM_IN_FLIGHT');
  }

  // Ownership before anything is charged. 404 rather than 403 on someone
  // else's id, so this cannot be used to discover that one exists.
  let conversation = null;
  if (conversationId) {
    conversation = await Conversation.findOne({ _id: conversationId, user: userId });
    if (!conversation) throw new ApiError(404, 'That conversation no longer exists', 'NO_CONVERSATION');
  }

  const charged = await charge(userId, settings.dailyMessageCap);

  const controller = new AbortController();
  activeStreams.set(key, { controller, userId, reason: null });

  try {
    /*
      Which assistant is answering.

      A thread that already exists keeps its own mode — the request's is only
      consulted for a new one. Otherwise a client that forgot to send `mode`
      would silently switch an in-progress CP conversation to the interview
      assistant halfway through, and the transcript would read as two people.
    */
    const activeMode = conversation?.mode || mode;
    const isCp = activeMode === 'cp';

    const attached = isCp
      ? await cpProblemContext(cpProblemId, userId)
      : await problemContext(problemId, userId);
    const history = await recentTurns(conversation?._id, settings.maxHistoryMessages);
    const messages = [...history, { role: 'user', content }];

    // The problem goes in the system prompt, never merged into what the user
    // typed — app-supplied context and a person's own words must stay
    // distinguishable to the model.
    const persona = isCp ? CP_SYSTEM : SYSTEM;
    const system = attached ? `${persona}\n\n${attached.text}` : persona;

    const totalTimer = setTimeout(() => controller.abort(), TOTAL_MS);
    let idleTimer = null;
    const touch = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), IDLE_MS);
    };

    let opened;
    try {
      /*
        Auto is the absence of a choice, not a magic model id.

        The client sends no provider/model when the picker is on "Auto", so the
        task is classified and used to order candidates. Naming a model means
        exactly that — it is tried first and the classification is skipped,
        because a person who chose from a dropdown was not asking to be
        second-guessed.
      */
      const task = model ? null : classifyTask(content, { hasProblem: Boolean(attached) });

      opened = await openStream({
        candidates: candidatesFor({
          provider: requestedProvider,
          model,
          enabled: settings.providers,
          task,
        }),
        messages,
        system,
        signal: controller.signal,
        enabled: settings.providers,
      });
    } catch (error) {
      clearTimeout(totalTimer);
      // Nothing was generated, so nothing was spent.
      await refund(userId);
      throw error;
    }

    const expiresAt = expiryFrom(settings);

    // Only now does anything get written. A send that never produced a token
    // leaves no conversation, no message and no charge behind.
    if (!conversation) {
      conversation = await Conversation.create({
        user: userId,
        title: draftTitle(content),
        mode: activeMode,
        // One of the two, never both — see the note on the model.
        problem: isCp ? null : attached?.id || null,
        cpProblem: isCp ? attached?.id || null : null,
        problemSlug: attached?.slug || '',
        problemTitle: attached?.title || '',
        expiresAt,
      });
    }

    await Message.create({
      conversation: conversation._id,
      user: userId,
      role: 'user',
      content,
      problemSlug: attached?.slug || '',
      expiresAt,
    });

    yield {
      type: 'start',
      conversationId: String(conversation._id),
      provider: opened.provider.id,
      model: opened.model,
      title: conversation.title,
      mode: activeMode,
    };

    let text = opened.first.text;
    let finish = 'stop';
    let usage = null;
    let truncated = false;
    let failure = null;

    yield { type: 'delta', t: opened.first.text };
    touch();

    try {
      for await (const event of opened.iterator) {
        if (event.type === 'delta') {
          text += event.text;
          touch();
          yield { type: 'delta', t: event.text };
        } else if (event.type === 'done') {
          finish = event.finish;
          usage = event.usage;
        }
      }
    } catch (error) {
      /*
        The upstream died with tokens already on screen. Do not fail over here:
        splicing a second model's continuation onto the first one's half-sentence
        produces text that is subtly incoherent with no way for the reader to
        tell why. Keep what arrived, say it stopped, and let them re-ask — which
        is a fresh request, and lands on a different provider because this one
        just entered a cooldown.
      */
      const stopped = activeStreams.get(key)?.reason === 'stopped';
      if (!stopped) {
        noteFailure(opened.provider.id, error);
        truncated = true;
        finish = 'error';
        failure = classify(error).message;
      } else {
        finish = 'stop';
      }
    } finally {
      clearTimeout(totalTimer);
      if (idleTimer) clearTimeout(idleTimer);
    }

    const stoppedByUser = activeStreams.get(key)?.reason === 'stopped';

    const saved = await Message.create({
      conversation: conversation._id,
      user: userId,
      role: 'assistant',
      content: text,
      provider: opened.provider.id,
      model: opened.model,
      truncated,
      stoppedByUser,
      problemSlug: attached?.slug || '',
      tokens: { in: usage?.in || 0, out: usage?.out || 0 },
      expiresAt,
    });

    /*
      The sliding window. Both writes matter: without the updateMany, the older
      messages in a long thread expire while newer ones survive and you are left
      with a conversation full of holes, which is worse than not having it.
    */
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageAt: new Date(),
          provider: opened.provider.id,
          model: opened.model,
          expiresAt,
        },
        $inc: { messageCount: 2 },
      },
    );
    await Message.updateMany({ conversation: conversation._id }, { $set: { expiresAt } });

    await recordSpend(userId, opened.provider.id, usage);

    if (truncated) yield { type: 'error', code: 'STREAM_TRUNCATED', message: failure };

    yield {
      type: 'done',
      messageId: String(saved._id),
      conversationId: String(conversation._id),
      finish,
      truncated,
      stoppedByUser,
      usage,
      remaining: charged.remaining,
    };

    const named = await maybeTitle(conversation, content, text, settings);
    if (named) yield { type: 'title', title: named };
  } finally {
    activeStreams.delete(key);
    /*
      Always abort, including on the happy path.

      This generator is closed early whenever the reader disconnects — the
      controller calls `.return()` on it — and at that moment the upstream fetch
      is still open and still being billed. Aborting only on failure would leave
      a provider streaming a reply into a socket nobody is reading, for the full
      sixty seconds, every time someone closes a tab mid-answer. On a stream
      that finished normally the request is already complete and this is a
      no-op, which is the cheap half of the trade.
    */
    controller.abort();
  }
}

/**
 * Replace the heuristic title with a written one.
 *
 * Awaited rather than fired and forgotten. A floating promise that rejects
 * takes the process down on modern Node, and this one talks to a network — the
 * same reasoning recordAudit's docblock gives for awaiting a single insert.
 * Six seconds, cheapest provider, never Gemini, and any failure just leaves the
 * first-sixty-characters title in place.
 */
async function maybeTitle(conversation, question, answer, settings) {
  if (conversation.titleSetByUser || conversation.messageCount > 0) return null;

  const provider = backgroundProvider(settings.providers);
  if (!provider) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TITLE_TIMEOUT_MS);
  try {
    const raw = await provider.complete({
      messages: [{ role: 'user', content: `Question: ${question}\n\nAnswer: ${answer.slice(0, 400)}` }],
      system: TITLE_SYSTEM,
      model: provider.defaultModel,
      maxTokens: 24,
      signal: controller.signal,
    });
    const title = cleanTitle(raw);
    if (!title) return null;

    // Guarded in the query, not just above: a rename can land between the two.
    const result = await Conversation.updateOne(
      { _id: conversation._id, titleSetByUser: false },
      { $set: { title } },
    );
    return result.modifiedCount ? title : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Delete a thread and its messages. Used by the owner and by the admin purge. */
export async function deleteConversation(userId, conversationId) {
  const conversation = await Conversation.findOneAndDelete({ _id: conversationId, user: userId });
  if (!conversation) throw new ApiError(404, 'That conversation no longer exists', 'NO_CONVERSATION');
  await Message.deleteMany({ conversation: conversation._id });
  return conversation;
}

export async function deleteAllConversations(userId) {
  const id = new mongoose.Types.ObjectId(String(userId));
  const messages = await Message.deleteMany({ user: id });
  const conversations = await Conversation.deleteMany({ user: id });
  return { conversations: conversations.deletedCount, messages: messages.deletedCount };
}
