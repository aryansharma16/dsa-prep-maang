import { classify } from './errors.js';
import { cerebras } from './cerebras.provider.js';
import { deepseek } from './deepseek.provider.js';
import { gemini } from './gemini.provider.js';
import { xai } from './xai.provider.js';

/**
 * Which provider answers, and when to stop asking one that will not.
 *
 * Three gates, cheapest first, because most requests are answered by the first
 * candidate and the other two checks should not cost anything in that case:
 *
 *   configured   a key exists in the environment       — static, free
 *   enabled      the admin left it in the settings list — cached, 30s
 *   healthy      it is not in a cooldown                — in-process map
 *
 * The default order is time-to-first-token, not model quality. For "what does
 * this Python syntax do", a fast small model that starts typing immediately
 * beats a better one that thinks first, and every model here clears the bar for
 * the questions this assistant is scoped to.
 */

const PROVIDERS = [cerebras, deepseek, gemini, xai];

const BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

/** The fallback when no settings row exists yet. xai is absent on purpose — see below. */
export const DEFAULT_ORDER = ['cerebras', 'deepseek', 'gemini'];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

export const providerById = (id) => BY_ID.get(id) || null;

/**
 * Health, keyed by provider id.
 *
 * In-process rather than in Mongo, and that is a real trade worth stating: pm2
 * may run several workers and each learns which providers are dead
 * independently, so a dead provider costs one wasted request per worker per
 * cooldown instead of one. Sharing it would mean a database read on the hot
 * path of every message to save that. It is not worth it — but someone will
 * eventually look at this and think it is a bug, so: it is not.
 *
 * @type {Map<string, {failures: number, until: number, kind: string}>}
 */
const health = new Map();

export function noteSuccess(id) {
  // Success is the only thing that clears a cooldown. A provider that fails,
  // sits out its fifteen minutes and fails again should back off further, not
  // start over at thirty seconds.
  health.delete(id);
}

export function noteFailure(id, error) {
  const previous = health.get(id);
  const failures = (previous?.failures || 0) + 1;
  const { kind, cooldownMs } = classify(error, failures);
  health.set(id, { failures, until: Date.now() + cooldownMs, kind });
  return kind;
}

export const isHealthy = (id) => {
  const entry = health.get(id);
  return !entry || entry.until <= Date.now();
};

/** What the admin panel shows. Never the upstream message — see errors.js. */
export function healthOf(id) {
  const entry = health.get(id);
  if (!entry || entry.until <= Date.now()) return { ok: true, kind: null, until: null };
  return { ok: false, kind: entry.kind, until: new Date(entry.until).toISOString() };
}

/**
 * Everything the client and the admin panel need to render a picker.
 *
 * Model ids are flattened with their provider attached, because a model id
 * alone is ambiguous — the client sends both back and the two must agree.
 */
export function catalogue(enabled = DEFAULT_ORDER) {
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    envKey: provider.envKey,
    configured: provider.configured(),
    enabled: enabled.includes(provider.id),
    health: healthOf(provider.id),
    defaultModel: provider.defaultModel,
    models: provider.models.map((m) => ({ ...m, provider: provider.id })),
  }));
}

/**
 * The ordered list of providers to try for one request.
 *
 * Two rules that are easy to get wrong:
 *
 * An explicitly chosen provider goes first even when it is cooling down. The
 * cooldown is a heuristic built from other people's failures; someone who
 * picked DeepSeek from a dropdown has asked a direct question and deserves one
 * real attempt at an answer rather than a silent substitution.
 *
 * Cooling-down providers are appended rather than dropped. If every provider
 * happens to be in a cooldown at once — one bad minute upstream, or a fresh
 * process that has learned nothing yet — an empty candidate list turns a
 * recoverable moment into an error page. A stale cooldown is a guess; a real
 * request is evidence.
 */
export function candidatesFor({ provider: requested, enabled = DEFAULT_ORDER } = {}) {
  const usable = enabled.filter((id) => BY_ID.get(id)?.configured());

  const ordered = [];
  const push = (id) => {
    if (id && !ordered.includes(id) && BY_ID.get(id)?.configured()) ordered.push(id);
  };

  push(requested);
  usable.filter(isHealthy).forEach(push);
  usable.forEach(push);

  return ordered;
}

/**
 * The provider for work nobody is watching — currently auto-titling.
 *
 * Never Gemini. A title is 24 tokens, and spending one of a 20-per-day
 * allowance on it would mean the free tier ran out on conversation names rather
 * than on answers.
 */
export function backgroundProvider(enabled = DEFAULT_ORDER) {
  const id = enabled.find((candidate) => candidate !== 'gemini' && BY_ID.get(candidate)?.configured() && isHealthy(candidate));
  return id ? BY_ID.get(id) : null;
}

/** Is there any provider at all on this deployment? Drives `/health` and the composer. */
export const anyProviderConfigured = () => PROVIDERS.some((p) => p.configured());

/** Test seam — the probe script resets health between runs. */
export const resetHealth = () => health.clear();
