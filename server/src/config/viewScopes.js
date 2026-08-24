/**
 * The surfaces that may save a filter set, and how big one is allowed to get.
 *
 * The endpoint behind this stores whatever bag of keys a client sends, which is
 * the whole point — the roadmap gained a topic filter without the server
 * learning what a topic is, and the next module will do the same. That is the
 * argument `prefsSchema` already makes about accent names: the meaning lives
 * next to the UI that paints it, and pinning the list here would make adding a
 * filter a two-repo change.
 *
 * What the server does owe is a boundary. Without one this is a per-account
 * key-value store that anything with a session can write arbitrary documents
 * into — so the scope is an allowlist and the bag is bounded on every axis a
 * caller controls: how many filters, how long a name, how long a value, and how
 * many values a multi-select may hold.
 *
 * The limits are far above any real filter set. `values` at 60 is more companies
 * than the roadmap has; `fields` at 24 is three times what the roadmap uses. They
 * are here to stop a loop, not to shape a feature.
 */
export const VIEW_SCOPES = ['roadmap', 'revision', 'problems', 'tasks'];

export const VIEW_LIMITS = {
  /** Distinct filters in one saved view. */
  fields: 24,
  /** Length of a filter's name — `companies`, `difficulty`. */
  key: 40,
  /** Length of one selected value — a company or tag name. */
  value: 80,
  /** Selected values in a single multi-select. */
  values: 60,
};
