import { Setting } from '../models/Setting.js';
import { DEFAULT_ORDER } from './ai/registry.js';

/**
 * The settings document, cached, with defaults that work on an empty database.
 *
 * `CHAT_DEFAULTS` is the contract: chat has to work on a deployment where
 * nobody has ever opened the admin panel, the same way uploads work without a
 * Cloudinary key and the roadmap works without a Gemini one. A settings row is
 * an override, never a prerequisite.
 */

export const CHAT_DEFAULTS = Object.freeze({
  enabled: true,
  retentionHours: 24,
  providers: Object.freeze([...DEFAULT_ORDER]),
  dailyMessageCap: 40,
  maxHistoryMessages: 20,
  maxInputChars: 4000,
});

/**
 * Thirty seconds, and an explicit invalidation, and both are load-bearing.
 *
 * The invalidation is what makes the admin panel feel immediate: the worker
 * that handled the PATCH drops its cache and the next request sees the change.
 * The TTL is what makes the *other* pm2 workers converge, since they never saw
 * that PATCH and there is no message bus here to tell them. Either one alone
 * leaves you with a setting that took effect on one worker and not the others,
 * which presents as "it randomly did and didn't work".
 */
const CACHE_MS = 30_000;

let cache = null;
let cachedAt = 0;

export function invalidateSettings() {
  cache = null;
  cachedAt = 0;
}

/**
 * Chat settings, merged over the defaults.
 *
 * Never throws. A database hiccup while reading configuration should degrade to
 * the defaults, not fail the message someone was trying to send — the settings
 * row governs chat, it is not a dependency of it.
 */
export async function chatSettings() {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;

  let stored = null;
  try {
    stored = await Setting.findOne({ key: 'app' }).select('chat').lean();
  } catch (error) {
    console.warn(`[settings] falling back to defaults: ${error.message}`);
  }

  const chat = stored?.chat || {};
  cache = {
    ...CHAT_DEFAULTS,
    ...chat,
    // A stored empty array would disable every provider and read as "chat is
    // broken" rather than "chat is off" — the kill switch is `enabled`.
    providers: chat.providers?.length ? chat.providers : [...CHAT_DEFAULTS.providers],
  };
  cachedAt = Date.now();
  return cache;
}

/** Milliseconds a conversation lives past its last message, from current settings. */
export const retentionMs = (settings) => settings.retentionHours * 60 * 60 * 1000;

/** The `expiresAt` to stamp on rows written right now. */
export const expiryFrom = (settings, from = Date.now()) => new Date(from + retentionMs(settings));
