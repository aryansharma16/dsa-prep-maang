import { AUDIT_TARGET_TYPES, AuditLog } from '../models/AuditLog.js';

/**
 * The action vocabulary. Kept as constants so the activity filter can be built
 * from this list rather than a `distinct()` scan over the collection, which
 * would only ever offer the actions someone happens to have performed.
 */
export const AUDIT = Object.freeze({
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_ROLE: 'user.role',
  USER_PASSWORD: 'user.password',
  USER_REVOKE: 'user.revoke',
  USER_AVATAR_REMOVE: 'user.avatar.remove',
  USER_DELETE: 'user.delete',

  PROBLEM_CREATE: 'problem.create',
  PROBLEM_UPDATE: 'problem.update',
  PROBLEM_DELETE: 'problem.delete',

  PATTERN_UPDATE: 'pattern.update',

  GUIDE_SAVE: 'guide.save',
  GUIDE_UNLOCK: 'guide.unlock',

  /*
    Learn's content, once it lives in Mongo rather than the client bundle.

    The same two verbs a guide has, because Learn borrows the same ownership
    model: the seed files are the source of truth until a human takes a topic
    over, and `unlock` is the way back. A track is separate from a topic here —
    unlike in `targetType`, where they share one value — because these are
    *actions* and editing a track's blurb is not editing 1,400 words of prose.
  */
  LEARN_TOPIC_SAVE: 'learn.topic.save',
  LEARN_TOPIC_UNLOCK: 'learn.topic.unlock',
  LEARN_TRACK_SAVE: 'learn.track.save',

  MOTIVATION_CREATE: 'motivation.create',
  MOTIVATION_UPDATE: 'motivation.update',
  MOTIVATION_DELETE: 'motivation.delete',

  /*
    One action for the whole PATCH rather than a status one and a reply one.
    The granularity here follows routes — USER_ROLE and USER_PASSWORD are
    separate because they are separate endpoints, while USER_UPDATE covers a
    whole PATCH and puts the detail in `meta`. Triaging a submission is one
    request that sets a status, writes a reply, or both.

    Submitting feedback is deliberately absent. This collection records what
    staff do to the app; no learner action is in it, and putting this one in
    would fill the activity feed with the one kind of event it leaves out.
  */
  FEEDBACK_UPDATE: 'feedback.update',

  SETTINGS_UPDATE: 'settings.update',
  CHAT_PURGE: 'chat.purge',

  MODULE_VISIBILITY: 'module.visibility',

  SUPERADMIN_PIN: 'system.superadmin.pin',
});

export const AUDIT_ACTIONS = Object.values(AUDIT);

/** Human labels for the activity feed, so the UI does not parse dotted strings. */
export const AUDIT_LABEL = {
  [AUDIT.USER_CREATE]: 'created the account',
  [AUDIT.USER_UPDATE]: 'updated details for',
  [AUDIT.USER_ROLE]: 'changed the role of',
  [AUDIT.USER_PASSWORD]: 'set a new password for',
  [AUDIT.USER_REVOKE]: 'signed out every device of',
  [AUDIT.USER_AVATAR_REMOVE]: 'removed the photo of',
  [AUDIT.USER_DELETE]: 'deleted the account',
  [AUDIT.PROBLEM_CREATE]: 'created problem',
  [AUDIT.PROBLEM_UPDATE]: 'edited problem',
  [AUDIT.PROBLEM_DELETE]: 'deleted problem',
  [AUDIT.PATTERN_UPDATE]: 'edited pattern',
  [AUDIT.GUIDE_SAVE]: 'saved the guide for',
  [AUDIT.GUIDE_UNLOCK]: 'handed back to the seeder',
  [AUDIT.LEARN_TOPIC_SAVE]: 'edited the Learn topic',
  [AUDIT.LEARN_TOPIC_UNLOCK]: 'handed the Learn topic back to the seeder',
  [AUDIT.LEARN_TRACK_SAVE]: 'edited the Learn track',
  [AUDIT.MOTIVATION_CREATE]: 'wrote the line',
  [AUDIT.MOTIVATION_UPDATE]: 'edited the line',
  [AUDIT.MOTIVATION_DELETE]: 'deleted the line',
  [AUDIT.FEEDBACK_UPDATE]: 'answered the feedback',
  [AUDIT.SETTINGS_UPDATE]: 'changed the site settings',
  [AUDIT.CHAT_PURGE]: 'deleted all chat history',
  [AUDIT.MODULE_VISIBILITY]: 'changed who can see',
  [AUDIT.SUPERADMIN_PIN]: 'promoted to super admin',
};

const TRUNCATE = 200;

const show = (value) => {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(', ').slice(0, TRUNCATE);
  if (typeof value === 'object') return undefined; // not worth recording
  return String(value).slice(0, TRUNCATE);
};

/**
 * `{ field: { from, to } }` for the fields that actually changed.
 *
 * Scalars and string arrays only, truncated — enough to answer "who changed
 * this title and what was it before", without turning the log into a second
 * copy of the database.
 */
export function diff(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    const from = show(before?.[field]);
    const to = show(after?.[field]);
    if (from === undefined || to === undefined) continue;
    if (from !== to) changes[field] = { from, to };
  }
  return changes;
}

/**
 * Writes one audit row. Never throws.
 *
 * A logging failure must not fail the action it describes — the same contract
 * `destroyAsset` uses for Cloudinary. It is awaited rather than fired and
 * forgotten, though: an unawaited rejection inside an async handler takes the
 * process down on modern Node, and one insert on a route three people use is
 * not worth optimising away.
 *
 * Call it *after* the operation succeeds, so the log can never claim something
 * that did not happen. Deletions are the exception — the target's label has to
 * be read before it stops existing.
 */
export async function recordAudit(req, { action, targetType, targetId, targetLabel, meta = {} }) {
  /*
    Named before it is swallowed.

    The enum on the model is the real gate, but it fails as a ValidationError
    inside the catch below — which prints, and is then indistinguishable from a
    dropped connection to anyone skimming the log. Every audit row this app has
    ever failed to write failed this way, and `module` sat unrecorded until
    somebody went looking. Saying the word "targetType" out loud costs one
    lookup on a route three people use.
  */
  if (!AUDIT_TARGET_TYPES.includes(targetType)) {
    console.error(
      `[audit] unknown targetType '${targetType}' for ${action} — add it to AUDIT_TARGET_TYPES in models/AuditLog.js`,
    );
  }

  try {
    await AuditLog.create({
      actor: req?.actor?._id ?? null,
      actorEmail: req?.actor?.email ?? 'system',
      actorRole: req?.actor?.role ?? 'system',
      action,
      targetType,
      targetId: targetId ? String(targetId) : '',
      targetLabel: targetLabel || '',
      meta,
      ip: req?.ip || '',
    });
  } catch (error) {
    console.error('[audit] could not record', action, error.message);
  }
}
