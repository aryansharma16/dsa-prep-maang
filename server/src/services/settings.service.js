import { MODULE_KEYS, OWNER_MODULE_CAP, OWNER_MODULE_KEYS } from '../config/modules.js';
import { can } from '../config/roles.js';
import { Setting } from '../models/Setting.js';
import { DEFAULT_ORDER } from './ai/registry.js';

/**
 * The settings document, cached, with defaults that work on an empty database.
 *
 * `CHAT_DEFAULTS` is the contract: chat has to work on a deployment where
 * nobody has ever opened the admin panel, the same way uploads work without a
 * Cloudinary key and the roadmap works without a Gemini one. A settings row is
 * an override, never a prerequisite. `MODULE_DEFAULTS` says the same thing about
 * the side menu — nothing hidden until someone hides it.
 */

export const CHAT_DEFAULTS = Object.freeze({
  enabled: true,
  retentionHours: 24,
  providers: Object.freeze([...DEFAULT_ORDER]),
  dailyMessageCap: 40,
  maxHistoryMessages: 20,
  maxInputChars: 4000,
});

export const MODULE_DEFAULTS = Object.freeze({ hidden: Object.freeze([]) });

/**
 * Thirty seconds, and an explicit invalidation, and both are load-bearing.
 *
 * The invalidation is what makes the admin panel feel immediate: the worker
 * that handled the PATCH drops its cache and the next request sees the change.
 * The TTL is what makes the *other* pm2 workers converge, since they never saw
 * that PATCH and there is no message bus here to tell them. Either one alone
 * leaves you with a setting that took effect on one worker and not the others,
 * which presents as "it randomly did and didn't work".
 *
 * The window is also the honest answer to "how fast does hiding a module take
 * effect": up to thirty seconds on the workers that did not serve the write.
 * That is fine for a feature flag on an unfinished module and would not be for
 * an authorisation check, which is why this caches configuration and
 * `requireCap` reads the account every time.
 */
const CACHE_MS = 30_000;

let cache = null;
let cachedAt = 0;

export function invalidateSettings() {
  cache = null;
  cachedAt = 0;
}

/**
 * The whole settings document, merged over the defaults.
 *
 * One read and one cache for every section, so a request that needs both chat
 * settings and the module list costs what a request needing either one costs.
 *
 * Never throws. A database hiccup while reading configuration should degrade to
 * the defaults, not fail the message someone was trying to send — the settings
 * row governs chat, it is not a dependency of it. Degrading to the defaults also
 * means a module is *visible* when the database is unreachable, which is the
 * right way round: an unfinished feature briefly appearing is a smaller failure
 * than the whole side menu emptying out during an outage.
 */
async function appSettings() {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;

  let stored = null;
  try {
    stored = await Setting.findOne({ key: 'app' }).select('chat modules').lean();
  } catch (error) {
    console.warn(`[settings] falling back to defaults: ${error.message}`);
  }

  const chat = stored?.chat || {};
  cache = {
    chat: {
      ...CHAT_DEFAULTS,
      ...chat,
      // A stored empty array would disable every provider and read as "chat is
      // broken" rather than "chat is off" — the kill switch is `enabled`.
      providers: chat.providers?.length ? chat.providers : [...CHAT_DEFAULTS.providers],
    },
    modules: {
      // Filtered against the registry rather than trusted, so a module deleted
      // from config/modules.js while it was hidden leaves a dead key in the
      // database that hides nothing and shows up nowhere, instead of an entry
      // the admin panel cannot render and nobody can clear.
      hidden: (stored?.modules?.hidden || []).filter((key) => MODULE_KEYS.includes(key)),
    },
  };
  cachedAt = Date.now();
  return cache;
}

export async function chatSettings() {
  return (await appSettings()).chat;
}

/** Keys of the modules that are super-admin-only right now. */
export async function hiddenModules() {
  return (await appSettings()).modules.hidden;
}

/**
 * What a role may see of the side menu, for `GET /auth/me`.
 *
 * `preview` is the subset of `visible` that everyone else is currently denied,
 * so the client can badge those entries as unfinished rather than presenting a
 * half-built page as if it had shipped. It is empty for every role without
 * `module:preview`, which means the response never tells an ordinary learner
 * that a hidden module exists at all.
 */
export async function moduleAccess(role) {
  const hidden = await hiddenModules();

  /*
    Owner modules come off first, and for everyone the capability does not
    cover. They are not "hidden" in the sense the rest of this function means —
    nothing in the panel turns them back on — so they are removed before the
    hidden list is consulted rather than folded into it. The response therefore
    never mentions them to anyone else, the same way it never names a hidden
    module to a learner.
  */
  const mine = can(role, OWNER_MODULE_CAP)
    ? MODULE_KEYS
    : MODULE_KEYS.filter((key) => !OWNER_MODULE_KEYS.includes(key));

  if (can(role, 'module:preview')) return { visible: [...mine], preview: [...hidden] };

  return { visible: mine.filter((key) => !hidden.includes(key)), preview: [] };
}

/** Milliseconds a conversation lives past its last message, from current settings. */
export const retentionMs = (settings) => settings.retentionHours * 60 * 60 * 1000;

/** The `expiresAt` to stamp on rows written right now. */
export const expiryFrom = (settings, from = Date.now()) => new Date(from + retentionMs(settings));
