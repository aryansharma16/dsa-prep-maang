import { AuditLog } from '../models/AuditLog.js';

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
