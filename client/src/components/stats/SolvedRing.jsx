const SIZE = 132;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const GAP = 2; // surface gap between segments, not a border

const ORDER = [
  { key: 'Easy', token: 'var(--easy)' },
  { key: 'Medium', token: 'var(--medium)' },
  { key: 'Hard', token: 'var(--hard)' },
];

/**
 * Part-to-whole at a glance: how much of the curriculum is done, split by
 * difficulty. Three segments, thin stroke, and the headline number in the
 * middle — the per-difficulty comparison is done by the meters beside it, not
 * by eyeballing arc lengths.
 */
export function SolvedRing({ byDifficulty }) {
  const rows = ORDER.map((d) => ({
    ...d,
    ...(byDifficulty.find((x) => x.difficulty === d.key) || { solved: 0, total: 0 }),
  }));

  const solved = rows.reduce((n, r) => n + r.solved, 0);
  const total = rows.reduce((n, r) => n + r.total, 0);
  const pct = total ? Math.round((solved / total) * 100) : 0;

  let offset = 0;
  const arcs = rows.map((row) => {
    const length = total ? (row.solved / total) * CIRC : 0;
    const arc = { ...row, length: Math.max(0, length - GAP), start: offset };
    offset += length;
    return arc;
  });

  return (
    <div className="ring-block">
      <div className="ring-wrap">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE}
          />
          {arcs
            .filter((a) => a.length > 0)
            .map((a) => (
              <circle
                key={a.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={a.token}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${a.length} ${CIRC - a.length}`}
                strokeDashoffset={-a.start}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            ))}
        </svg>

        <div className="ring-center">
          <strong>{solved}</strong>
          <span>of {total}</span>
        </div>
      </div>

      <div className="ring-legend">
        <div className="ring-headline">
          <b className="mono">{pct}%</b> of the curriculum solved
        </div>
        {rows.map((row) => {
          const rowPct = row.total ? Math.round((row.solved / row.total) * 100) : 0;
          return (
            <div className="statrow" key={row.key}>
              <span className="nm">
                <i className="swatch" style={{ background: row.token }} />
                {row.key}
              </span>
              <span className="bar">
                <span style={{ width: `${rowPct}%`, background: row.token }} />
              </span>
              <span className="fr">
                {row.solved}/{row.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
