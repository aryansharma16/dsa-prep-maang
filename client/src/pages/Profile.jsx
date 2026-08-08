import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { statsApi } from '../api/index.js';
import { ActivityHeatmap } from '../components/stats/ActivityHeatmap.jsx';
import { SolvedRing } from '../components/stats/SolvedRing.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { useAuth } from '../store/AuthContext.jsx';
import { useRoadmap } from '../store/RoadmapContext.jsx';

const longDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

const shortDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function Profile() {
  const { user } = useAuth();
  const { groups } = useRoadmap();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    statsApi
      .get()
      .then(setData)
      .catch((err) => setError(errorMessage(err, 'Could not load your profile')));
  }, []);

  // Recent solves come from the roadmap that is already loaded — no extra call.
  const recent = useMemo(() => {
    const solved = [];
    for (const g of groups) {
      for (const p of g.problems) {
        if (p.progress?.status === 'solved' && p.progress.solvedAt) {
          solved.push({ ...p, patternName: g.name });
        }
      }
    }
    return solved
      .sort((a, b) => new Date(b.progress.solvedAt) - new Date(a.progress.solvedAt))
      .slice(0, 8);
  }, [groups]);

  const strongest = useMemo(() => {
    if (!data) return [];
    return [...data.byPattern]
      .filter((p) => p.solved > 0)
      .sort((a, b) => b.solved / b.total - a.solved / a.total || b.solved - a.solved)
      .slice(0, 5);
  }, [data]);

  if (error) {
    return (
      <div className="empty">
        <h3>Could not load your profile</h3>
        <p>{error}</p>
      </div>
    );
  }
  if (!data) return <div className="loading">Loading profile...</div>;

  const { totals, byDifficulty, byCompany, heatmap, activity } = data;
  const solved = byDifficulty.reduce((n, d) => n + d.solved, 0);
  const total = byDifficulty.reduce((n, d) => n + d.total, 0);
  const hours = Math.floor(totals.minutes / 60);

  return (
    <div className="profile">
      <aside className="profile-card">
        <div className="panel">
          <div className="panel-body">
            <div className="profile-id">
              <Avatar name={user?.name} email={user?.email} size={72} />
              <div>
                <h1>{user?.name}</h1>
                <p className="hint">{user?.email}</p>
              </div>
            </div>

            <dl className="profile-facts">
              <div>
                <dt>Joined</dt>
                <dd>{longDate(user?.createdAt)}</dd>
              </div>
              <div>
                <dt>Solved</dt>
                <dd className="mono">
                  {solved} / {total}
                </dd>
              </div>
              <div>
                <dt>Current streak</dt>
                <dd className="mono">
                  {activity.streak} {activity.streak === 1 ? 'day' : 'days'}
                </dd>
              </div>
              <div>
                <dt>Longest streak</dt>
                <dd className="mono">
                  {activity.maxStreak} {activity.maxStreak === 1 ? 'day' : 'days'}
                </dd>
              </div>
              <div>
                <dt>Active days</dt>
                <dd className="mono">{activity.activeDays}</dd>
              </div>
              <div>
                <dt>Time logged</dt>
                <dd className="mono">{hours ? `${hours}h` : `${totals.minutes}m`}</dd>
              </div>
            </dl>

            <div className="profile-links">
              <Link className="btn" to="/stats">
                Full stats
              </Link>
              <Link className="btn ghost" to="/revision">
                Revision queue
              </Link>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Strongest patterns</div>
          <div className="panel-body">
            {strongest.length === 0 ? (
              <p className="hint">Solve a few problems and your best patterns show up here.</p>
            ) : (
              strongest.map((p) => {
                const pct = p.total ? Math.round((p.solved / p.total) * 100) : 0;
                return (
                  <div className="statrow" key={p.slug}>
                    <span className="nm">{p.name}</span>
                    <span className="bar">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="fr">
                      {p.solved}/{p.total}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      <div className="profile-main">
        <div className="panel">
          <div className="panel-body">
            <SolvedRing byDifficulty={byDifficulty} />
          </div>
        </div>

        <ActivityHeatmap heatmap={heatmap} activity={activity} />

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">Recently solved</div>
            <div className="panel-body">
              {recent.length === 0 ? (
                <p className="hint">Nothing solved yet — the roadmap is a good place to start.</p>
              ) : (
                <ul className="recent">
                  {recent.map((p) => (
                    <li key={p._id}>
                      <a href={p.url || p.articleUrl} target="_blank" rel="noreferrer">
                        {p.title}
                      </a>
                      <span className={`diff ${p.difficulty}`}>{p.difficulty}</span>
                      <span className="hint">{p.patternName}</span>
                      <time className="due">{shortDate(p.progress.solvedAt)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">Company coverage</div>
            <div className="panel-body">
              {byCompany.length === 0 ? (
                <p className="hint">Solve a few problems and this fills in.</p>
              ) : (
                byCompany.slice(0, 8).map((c) => {
                  const pct = c.total ? Math.round((c.solved / c.total) * 100) : 0;
                  return (
                    <div className="statrow" key={c.name}>
                      <span className="nm">{c.name}</span>
                      <span className="bar">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span className="fr">
                        {c.solved}/{c.total}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
