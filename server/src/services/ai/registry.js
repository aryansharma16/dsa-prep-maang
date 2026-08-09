import { classify } from './errors.js';
import { cerebras } from './cerebras.provider.js';
import { deepseek } from './deepseek.provider.js';
import { gemini } from './gemini.provider.js';
import { xai } from './xai.provider.js';

/**
 * Which model answers, and when to stop asking one that will not.
 *
 * The unit here is a **(provider, model) pair**, not a provider. That is not a
 * refinement, it is the thing that makes a free tier usable: Google counts its
 * allowance per model per day, so one key with seven flash models is seven
 * separate buckets of twenty. A chain that gave up on Gemini the moment one
 * model returned 429 would be throwing away six sevenths of what the account
 * can actually do.
 *
 * The order across providers is time-to-first-token — a fast small model that
 * starts typing immediately beats a better one that thinks first, for the
 * questions this assistant is scoped to. The order within a provider is
 * quality, so the good model is tried first and the fallbacks are what you get
 * only when it is spent.
 */

const PROVIDERS = [cerebras, deepseek, gemini, xai];

const BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

/** The fallback when no settings row exists yet. xai is absent on purpose. */
export const DEFAULT_ORDER = ['cerebras', 'deepseek', 'gemini'];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

export const providerById = (id) => BY_ID.get(id) || null;

/**
 * Cooldowns, keyed either by `provider` or by `provider:model`.
 *
 * Two scopes in one map because a failure tells you which it is. "This key has
 * no credit" is about the account and sidelines the host; "this model is out of
 * requests until midnight" is about one id and must leave its siblings alone.
 * classify() decides; see the note on `scope` there.
 *
 * In-process rather than in Mongo, deliberately: pm2 may run several workers
 * and each learns independently, so a dead model costs one wasted request per
 * worker per cooldown instead of one. Sharing it would mean a database read on
 * the hot path of every message to save that. Someone will read this later and
 * think it is a bug. It is not.
 *
 * @type {Map<string, {failures: number, until: number, kind: string}>}
 */
const health = new Map();

const modelKey = (providerId, modelId) => `${providerId}:${modelId}`;

const cooling = (key) => {
  const entry = health.get(key);
  return entry && entry.until > Date.now() ? entry : null;
};

export function noteSuccess(providerId, modelId) {
  // Success clears both scopes: it proves the key spends and the model answers.
  health.delete(providerId);
  if (modelId) health.delete(modelKey(providerId, modelId));
}

export function noteFailure(providerId, error, modelId) {
  const scoped = classify(error, 1).scope === 'model' && modelId;
  const key = scoped ? modelKey(providerId, modelId) : providerId;

  const failures = (health.get(key)?.failures || 0) + 1;
  const { kind, cooldownMs } = classify(error, failures);
  health.set(key, { failures, until: Date.now() + cooldownMs, kind });
  return kind;
}

export const isProviderHealthy = (id) => !cooling(id);
export const isModelHealthy = (providerId, modelId) =>
  !cooling(providerId) && !cooling(modelKey(providerId, modelId));

/** For the admin panel. A code, never the upstream's message — see errors.js. */
function healthReport(key) {
  const entry = cooling(key);
  if (!entry) return { ok: true, kind: null, until: null };
  return { ok: false, kind: entry.kind, until: new Date(entry.until).toISOString() };
}

export const healthOf = (id) => healthReport(id);

/**
 * When the next thing currently sidelined becomes available again.
 *
 * The earliest expiry across every configured provider and model, so the UI can
 * say "back in four hours" instead of "unavailable" — which is the difference
 * between a reader waiting and a reader assuming it is broken. Null when
 * nothing is in a cooldown, i.e. the failure was something else.
 */
export function nextRetryAt(enabled = DEFAULT_ORDER) {
  let soonest = null;
  const now = Date.now();

  for (const id of enabled) {
    const provider = BY_ID.get(id);
    if (!provider?.configured()) continue;

    for (const key of [id, ...provider.models.map((m) => modelKey(id, m.id))]) {
      const entry = health.get(key);
      if (!entry || entry.until <= now) continue;
      if (soonest === null || entry.until < soonest) soonest = entry.until;
    }
  }

  return soonest === null ? null : new Date(soonest).toISOString();
}

/** Everything the client and the admin panel need to render a picker. */
export function catalogue(enabled = DEFAULT_ORDER) {
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    envKey: provider.envKey,
    configured: provider.configured(),
    enabled: enabled.includes(provider.id),
    health: healthReport(provider.id),
    defaultModel: provider.defaultModel,
    models: provider.models.map((model) => ({
      ...model,
      provider: provider.id,
      health: healthReport(modelKey(provider.id, model.id)),
    })),
  }));
}

/**
 * The ordered list of (provider, model) pairs to try for one request.
 *
 * Two rules that are easy to get wrong:
 *
 * An explicit pick goes first even when it is cooling down. The cooldown is a
 * heuristic built from an earlier failure; someone who chose a model from a
 * dropdown asked a direct question and deserves one real attempt rather than a
 * silent substitution.
 *
 * Cooling-down pairs are appended as last resorts rather than dropped. If
 * everything happens to be sidelined at once — one bad minute upstream, or a
 * worker that has learned nothing yet — an empty candidate list turns a
 * recoverable moment into an error page. A stale cooldown is a guess; a real
 * request is evidence.
 */
export function candidatesFor({ provider: requestedProvider, model: requestedModel, enabled = DEFAULT_ORDER } = {}) {
  const ordered = [];
  const seen = new Set();

  const push = (providerId, modelId) => {
    const key = modelKey(providerId, modelId);
    if (seen.has(key)) return;
    const provider = BY_ID.get(providerId);
    if (!provider?.configured()) return;
    if (!provider.models.some((m) => m.id === modelId)) return;
    seen.add(key);
    ordered.push({ provider: providerId, model: modelId });
  };

  // The explicit choice, first and unconditionally.
  if (requestedProvider && requestedModel) push(requestedProvider, requestedModel);

  const usable = enabled.filter((id) => BY_ID.get(id)?.configured());

  // Healthy pairs, provider order then model order.
  for (const id of usable) {
    if (!isProviderHealthy(id)) continue;
    for (const model of BY_ID.get(id).models) {
      if (isModelHealthy(id, model.id)) push(id, model.id);
    }
  }

  // Then everything else, as last resorts.
  for (const id of usable) {
    for (const model of BY_ID.get(id).models) push(id, model.id);
  }

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
  const id = enabled.find(
    (candidate) => candidate !== 'gemini' && BY_ID.get(candidate)?.configured() && isProviderHealthy(candidate),
  );
  return id ? BY_ID.get(id) : null;
}

/** Is there any provider at all on this deployment? Drives `/health` and the composer. */
export const anyProviderConfigured = () => PROVIDERS.some((p) => p.configured());

/** Test seam — the probe script resets health between runs. */
export const resetHealth = () => health.clear();
