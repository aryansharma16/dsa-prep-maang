import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { statsApi } from '../api/index.js';
import { ActivityHeatmap } from '../components/stats/ActivityHeatmap.jsx';
import { SolvedRing } from '../components/stats/SolvedRing.jsx';

function Meter({ name, solved, total, muted }) {
  const pct = total ? Math.round((solved / total) * 100) : 0;
  return (
    <div className="statrow">
      <span className="nm">{name}</span>
      <span className="bar">
        <span style={{ width: `${pct}%`, background: muted ? 'var(--text-3)' : undefined }} />
      </span>
      <span className="fr">
        {solved}/{total}
      </span>
    </div>
  );
}

export function Stats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [table, setTable] = useState(false);

  useEffect(() => {
    statsApi
      .get()
      .then(setData)
      .catch((err) => setError(errorMessage(err, 'Could not load stats')));
  }, []);

  const nextUp = useMemo(() => {
    if (!data) return [];
    // Where the curriculum is thinnest — started but far from finished first,
    // then untouched patterns.
    return [...data.byPattern]
      .filter((p) => p.solved < p.total)
      .sort((a, b) => a.solved / a.total - b.solved / b.total || b.total - a.total)
      .slice(0, 5);
  }, [data]);

  if (error) {
    return (
      <div className="empty">
        <h3>Could not load stats</h3>
        <p>{error}</p>
      </div>
    );
  }
  if (!data) return <div className="loading">Loading stats...</div>;

  const { totals, byDifficulty, byPattern, byCompany, heatmap, activity } = data;
  const hours = Math.floor(totals.minutes / 60);
  const solvedTotal = byDifficulty.reduce((n, d) => n + d.solved, 0);

  return (
    <>
      <div className="page-head">
        <h1>Stats</h1>
        <p>Where you actually stand, by pattern, difficulty and company.</p>
      </div>

      <div className="panel">
        <div className="panel-body">
          <SolvedRing byDifficulty={byDifficulty} />
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="k">Current streak</div>
          <div className="v">{activity.streak}</div>
          <div className="sub">longest {activity.maxStreak}</div>
        </div>
        <div className="tile">
          <div className="k">Active days</div>
          <div className="v">{activity.activeDays}</div>
          <div className="sub">{activity.events} attempts logged</div>
        </div>
        <div className="tile">
          <div className="k">In progress</div>
          <div className="v">{totals.attempted}</div>
          <div className="sub">attempted, not solved</div>
        </div>
        <div className="tile">
          <div className="k">Needs revision</div>
          <div className="v">{totals.needsRevision}</div>
          <div className="sub">{totals.flagged} flagged</div>
        </div>
        <div className="tile">
          <div className="k">Time logged</div>
          <div className="v">{hours ? `${hours}h` : `${totals.minutes}m`}</div>
          <div className="sub">across logged attempts</div>
        </div>
      </div>

      <ActivityHeatmap heatmap={heatmap} activity={activity} />

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">Weakest patterns</div>
          <div className="panel-body">
            {nextUp.length === 0 ? (
              <p className="hint">Every pattern is complete. Nothing left to shore up.</p>
            ) : (
              <>
                <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
                  Least complete first — a reasonable place to go next.
                </p>
                {nextUp.map((p) => (
                  <Meter key={p.slug} name={p.name} solved={p.solved} total={p.total} />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Coverage by company</div>
          <div className="panel-body">
            {byCompany.length === 0 ? (
              <p className="hint">Solve a few problems and this fills in.</p>
            ) : (
              byCompany
                .slice(0, 10)
                .map((c) => (
                  <Meter key={c.name} name={c.name} solved={c.solved} total={c.total} />
                ))
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head heat-head">
          <span>By pattern</span>
          <button className="link-btn" onClick={() => setTable((t) => !t)}>
            {table ? 'Show chart' : 'Show table'}
          </button>
        </div>
        <div className="panel-body">
          {table ? (
            <table className="datatable">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Solved</th>
                  <th>Total</th>
                  <th>Complete</th>
                </tr>
              </thead>
              <tbody>
                {byPattern.map((p) => (
                  <tr key={p.slug}>
                    <td>{p.name}</td>
                    <td className="mono">{p.solved}</td>
                    <td className="mono">{p.total}</td>
                    <td className="mono">
                      {p.total ? Math.round((p.solved / p.total) * 100) : 0}%
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>All patterns</b>
                  </td>
                  <td className="mono">{solvedTotal}</td>
                  <td className="mono">{byPattern.reduce((n, p) => n + p.total, 0)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          ) : (
            byPattern.map((p) => (
              <Meter key={p.slug} name={p.name} solved={p.solved} total={p.total} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
