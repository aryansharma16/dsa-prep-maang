import mongoose from 'mongoose';

/**
 * Every kind of thing an audit row can point at.
 *
 * Exported so `services/audit.service.js` can check a call against it before
 * writing — see the note on `targetType` below for why a silent enum failure is
 * the worst shape this bug can take. The dependency runs model → service and
 * never the other way: the service already imports from here, and the reverse
 * would be a cycle.
 *
 * `learn` covers both a track and a topic. Not two values, because this field is
 * a filter facet in the activity feed and the question a human asks is "what
 * happened to Learn", never "track edits but not topic edits" — `targetLabel`
 * carries `sql` or `sql/joins` and answers that when it is actually asked.
 */
export const AUDIT_TARGET_TYPES = Object.freeze([
  'user',
  'problem',
  'pattern',
  'guide',
  'learn',
  'motivation',
  'feedback',
  'module',
  // An account request, which is not a `user`: the row it points at may never
  // become one, and after a rejection there is nothing for a `user` id to mean.
  'signup',
  'settings',
  'system',
]);

/**
 * Who changed what, and when.
 *
 * The actor's email and role are copied in rather than looked up. An audit row
 * that reads "65f3… changed 65a1…" after both accounts are deleted records
 * nothing, and a `$lookup` to a deleted user returns an empty array — so these
 * rows are written to stand alone. Deleting a user deliberately does *not*
 * cascade into this collection; the denormalised email is exactly what keeps
 * the history readable afterwards.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Null for actions the server takes on its own, e.g. the boot-time
    // super-admin reconciliation.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorEmail: { type: String, default: 'system' },
    actorRole: { type: String, default: 'system' },

    action: { type: String, required: true, index: true },
    /**
     * Every value a controller passes has to be listed here.
     *
     * `recordAudit` swallows its own failures on purpose — a logging error must
     * not fail the action it describes — so a missing value is not an exception
     * anyone sees. It is a row that silently never gets written, and a gap in
     * the activity feed nobody notices until they go looking for what happened.
     * `module` was exactly that until it was added here.
     */
    targetType: {
      type: String,
      enum: AUDIT_TARGET_TYPES,
      required: true,
    },
    targetId: { type: String, default: '' },
    // Email or slug — readable after the target itself is gone.
    targetLabel: { type: String, default: '' },

    /**
     * A diff of the scalar fields that changed, never whole documents. A guide
     * is two thousand words; storing before and after on every save would put
     * hundreds of kilobytes per row into Mongo for a record nobody reads that
     * closely. Guides record which fields changed and a block count.
     */
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    ip: { type: String, default: '' },
  },
  // No updatedAt: an audit row is written once and never edited.
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The activity feed, and its two filters.
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
// "what has happened to this user/problem"
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
