import { useEffect, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { statsApi } from '../api/index.js';

const DIFF_ORDER = ['Easy', 'Medium', 'Hard'];

/**
 * 26 weeks of activity as a contribution grid. The CSS lays these out in
 * columns of seven, so the range has to start on a Sunday for the rows to line
 * up with weekdays.
 */
function buildHeatmap(heatmap) {
  const counts = new Map(heatmap.map((h) => [h.date, h.count]));

  // The server keys buckets by UTC day, so these must be UTC too or the grid
  // would be off by one for anyone east of Greenwich.
  const today = new Date();
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (26 * 7 - 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const days = [];
  for (const d = new Date(start); d.getTime() <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const count = counts.get(key) || 0;
    days.push({ key, count, level: count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : 3 });
  }
  return days;
}

function Meter({ name, solved, total }) {
  const pct = total ? Math.round((solved / total) * 100) : 0;
  return (
    <div className="statrow">
      <span className="nm">{name}</span>
      <div className="bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="fr">
        {solved}/{total}
      </span>
    </div>
  );
}

export function Stats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    statsApi
      .get()
      .then(setData)
      .catch((err) => setError(errorMessage(err, 'Could not load stats')));
  }, []);

  if (error) {
    return (
      <div className="empty">
        <h3>Could not load stats</h3>
        <p>{error}</p>
      </div>
    );
  }
  if (!data) return <div className="loading">Loading stats...</div>;

  const { totals, byDifficulty, byPattern, byCompany, heatmap, streak } = data;
  const hours = Math.floor(totals.minutes / 60);
  const solvedTotal = byDifficulty.reduce((n, d) => n + d.solved, 0);
  const allTotal = byDifficulty.reduce((n, d) => n + d.total, 0);
  const days = buildHeatmap(heatmap);

  return (
    <>
      <div className="page-head">
        <h1>Stats</h1>
        <p>Where you actually stand, by pattern, difficulty and company.</p>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="k">Solved</div>
          <div className="v">{solvedTotal}</div>
          <div className="sub">of {allTotal} problems</div>
        </div>
        <div className="tile">
          <div className="k">Streak</div>
          <div className="v">{streak}</div>
          <div className="sub">{streak === 1 ? 'day' : 'days'} in a row</div>
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

      <div className="panel">
        <div className="panel-head">Activity — last 26 weeks</div>
        <div className="panel-body">
          <div className="heat">
            {days.map((d) => (
              <i
                key={d.key}
                data-l={d.level}
                title={`${d.key} — ${d.count} ${d.count === 1 ? 'attempt' : 'attempts'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">By difficulty</div>
          <div className="panel-body">
            {DIFF_ORDER.map((label) => {
              const row = byDifficulty.find((d) => d.difficulty === label);
              return (
                <Meter
                  key={label}
                  name={label}
                  solved={row?.solved || 0}
                  total={row?.total || 0}
                />
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Solved by company</div>
          <div className="panel-body">
            {byCompany.length === 0 ? (
              <p className="hint">Solve a few problems and this fills in.</p>
            ) : (
              byCompany.slice(0, 10).map((c) => (
                <div className="statrow" key={c.name}>
                  <span className="nm">{c.name}</span>
                  <div className="bar">
                    <span
                      style={{ width: `${Math.round((c.solved / byCompany[0].solved) * 100)}%` }}
                    />
                  </div>
                  <span className="fr">{c.solved}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">By pattern</div>
        <div className="panel-body">
          {byPattern.map((p) => (
            <Meter key={p.slug} name={p.name} solved={p.solved} total={p.total} />
          ))}
        </div>
      </div>
    </>
  );
}
