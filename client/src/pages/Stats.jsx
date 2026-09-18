import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { statsApi } from '../api/index.js';
import { ActivityHeatmap } from '../components/stats/ActivityHeatmap.jsx';
import { FunnelPanel } from '../components/applications/FunnelPanel.jsx';
import { CPStats } from '../components/stats/CPStats.jsx';
import { SolvedRing } from '../components/stats/SolvedRing.jsx';
import { MeterRow } from '../components/ui/MeterRow.jsx';
import { MotivationLine } from '../components/ui/MotivationLine.jsx';
import { reasonOf } from '../components/problem/attempts.js';
import { useAuth } from '../store/AuthContext.jsx';
import { moduleVisible } from '../store/modules.js';

export function Stats() {
  const { modules } = useAuth();
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

  /**
   * Which patterns are hard *for you*, as opposed to unfinished.
   *
   * `nextUp` above ranks by coverage, and coverage is the plan's question — it
   * cannot tell a pattern you have not started from one you fought through
   * twice. This ranks by relearn rate: attempts per solved problem, so 1.0 is
   * clean and 2.4 means everything in there took two or three goes.
   *
   * Guarded by a minimum. Two attempts on one problem is a bad afternoon, not a
   * weakness, and letting it top the list would make the panel noise for the
   * first month of using it.
   */
  const leaks = useMemo(() => {
    if (!data?.byLeak) return [];
    const named = Object.fromEntries((data.byPattern || []).map((p) => [p.slug, p.name]));

    return data.byLeak
      .filter((row) => row.attempts >= 4 && row.touched >= 2)
      .map((row) => {
        const counts = {};
        for (const r of row.reasons || []) counts[r] = (counts[r] || 0) + 1;
        const [topReason] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
        return {
          ...row,
          name: named[row.slug] || row.slug,
          // Never divide by zero: a pattern with attempts and no solves is the
          // worst case, not an undefined one, so it counts as one solve short.
          relearn: row.attempts / Math.max(1, row.solved),
          topReason,
        };
      })
      .sort((a, b) => b.relearn - a.relearn || b.attempts - a.attempts)
      .slice(0, 6);
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

      <MotivationLine surface="stats" />

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
        {/*
          Two different questions that used to share one panel's name.

          "Weakest" meant *least complete*, which is a fact about the plan and
          not about you — a pattern at 0/27 is untouched, not hard. The leak
          report answers the other one, out of the attempt log, and it only has
          anything to say once there are attempts in there to read. Until then
          the coverage view stands alone, which is the honest order: you cannot
          know what is hard for you before you have tried any of it.
        */}
        <div className="panel">
          <div className="panel-head">
            {leaks.length > 0 ? 'Where you actually struggle' : 'Least complete'}
          </div>
          <div className="panel-body">
            {leaks.length > 0 ? (
              <>
                <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
                  Attempts per problem solved. <b>1.0</b> means it went in first time; anything
                  above <b>2</b> is a pattern you are re-learning, not learning.
                </p>
                <ul className="leak-list">
                  {leaks.map((row) => (
                    <li key={row.slug}>
                      <span className="leak-name">{row.name}</span>
                      <span className="leak-rate mono" title={`${row.attempts} attempts over ${row.solved} solved`}>
                        {row.relearn.toFixed(1)}×
                      </span>
                      <span className="leak-detail">
                        {row.assisted > 0 && (
                          <span title="Solves that needed a hint, a video or the editorial">
                            {row.assisted} assisted
                          </span>
                        )}
                        {row.failed > 0 && (
                          <span title="Sittings that ended without a solve">{row.failed} failed</span>
                        )}
                        {row.topReason && (
                          <span className="leak-reason" title="The most common reason it went wrong">
                            {reasonOf(row.topReason)?.label}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="hint leak-foot">
                  Two or three at the top of this list is next week&rsquo;s revision, whatever the
                  schedule says.
                </p>
              </>
            ) : nextUp.length === 0 ? (
              <p className="hint">Every pattern is complete. Nothing left to shore up.</p>
            ) : (
              <>
                <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
                  Least complete first — a reasonable place to go next. Once you have logged a few
                  attempts this becomes the patterns that are actually costing you the most.
                </p>
                {nextUp.map((p) => (
                  <MeterRow key={p.slug} name={p.name} value={p.solved} total={p.total} />
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
                  <MeterRow key={c.name} name={c.name} value={c.solved} total={c.total} />
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
              <MeterRow key={p.slug} name={p.name} value={p.solved} total={p.total} />
            ))
          )}
        </div>
      </div>

      {/*
        Last, and self-effacing: it fetches its own endpoint and renders nothing
        at all when the module is hidden or the ladder is untouched, so this page
        is unchanged for anyone not using Pro Coder.
      */}
      <CPStats />

      {/*
        The job hunt, beside the practice that is for it. Gated on the module
        rather than fetched and hidden, so an account the module is off for never
        asks `/applications/stats` — which would answer 404 while it is hidden —
        and it renders nothing until at least one application has been sent.
      */}
      {moduleVisible(modules, 'applications') && <FunnelPanel title="Job hunt" hideWhenEmpty />}
    </>
  );
}
