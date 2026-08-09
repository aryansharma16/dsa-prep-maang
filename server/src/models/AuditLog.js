import mongoose from 'mongoose';

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
    targetType: {
      type: String,
      enum: ['user', 'problem', 'pattern', 'guide', 'system'],
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
