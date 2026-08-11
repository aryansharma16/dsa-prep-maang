/**
 * A name, a bar, and the fraction it draws.
 *
 * Magnitude compared across a short list — the form a bar chart takes when the
 * categories are words and the rows are read down rather than across. Shared
 * between the learner stats page and the admin dashboard because they are asking
 * the same shape of question about different subjects.
 *
 * `muted` drops the fill to `--text-3` for a row that is context rather than the
 * subject, so a comparison row never competes with the one being compared.
 */
export function MeterRow({ name, value, total, muted }) {
  const pct = total ? Math.round((value / total) * 100) : 0;

  return (
    <div className="statrow">
      <span className="nm">{name}</span>
      <span className="bar">
        <span style={{ width: `${pct}%`, background: muted ? 'var(--text-3)' : undefined }} />
      </span>
      <span className="fr">
        {value}/{total}
      </span>
    </div>
  );
}
