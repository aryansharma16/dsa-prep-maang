const AUDIT_LABEL = {
  'user.create': 'created the account',
  'user.update': 'updated details for',
  'user.role': 'changed the role of',
  'user.password': 'set a new password for',
  'user.revoke': 'signed out every device of',
  'user.avatar.remove': 'removed the photo of',
  'user.delete': 'deleted the account',
  'problem.create': 'created problem',
  'problem.update': 'edited problem',
  'problem.delete': 'deleted problem',
  'pattern.update': 'edited pattern',
  'guide.save': 'saved the guide for',
  'guide.unlock': 'handed back to the seeder',
  'system.superadmin.pin': 'promoted to super admin',
};

const when = (value) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * One line of history.
 *
 * The actor's email comes from the row itself rather than a join, so an entry
 * stays readable after the account that made it has been deleted — which is
 * exactly when you most want to read it.
 */
export function AuditRow({ entry }) {
  const changes = Object.entries(entry.meta || {}).filter(
    ([, v]) => v && typeof v === 'object' && 'from' in v,
  );

  return (
    <div className="audit-row">
      <time className="audit-when mono">{when(entry.createdAt)}</time>
      <span className="audit-who">{entry.actorEmail}</span>
      <span className="audit-what">
        {AUDIT_LABEL[entry.action] || entry.action}{' '}
        <b>{entry.targetLabel || entry.targetType}</b>
        {changes.length > 0 && (
          <span className="audit-diff">
            {changes.map(([field, { from, to }]) => (
              <span key={field}>
                {field}: <s>{from || '—'}</s> → {to || '—'}
              </span>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}
