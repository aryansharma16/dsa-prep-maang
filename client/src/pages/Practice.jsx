import { useEffect, useState } from 'react';
import { practiceApi } from '../api/index.js';
import { Drill } from '../components/practice/Drill.jsx';
import { Mock } from '../components/practice/Mock.jsx';
import { useRoadmap } from '../store/RoadmapContext.jsx';

/**
 * Practice — training against the curriculum rather than working through it.
 *
 * The roadmap and the ladder are lists you finish. This is the room where you
 * rehearse: the pattern drill today, the mock harness beside it next. Neither
 * writes to a problem row — a drill answer is a recognition, not an attempt, and
 * the attempt log is supposed to mean "I sat down with this".
 */

const MODES = [
  { id: 'drill', label: 'Pattern drill' },
  { id: 'mock', label: 'Mock interview' },
];

export function Practice() {
  const { groups } = useRoadmap();
  const [stats, setStats] = useState(null);
  const [mode, setMode] = useState('drill');

  useEffect(() => {
    let live = true;
    practiceApi
      .stats()
      // A first-ever visit has no runs, and the module can be freshly enabled.
      // Neither is worth a toast — the page is the same page without a history.
      .then((data) => live && setStats(data))
      .catch(() => live && setStats(null));
    return () => {
      live = false;
    };
  }, []);

  const nameOf = (slug) => groups.find((g) => g.slug === slug)?.name || slug;
  const accuracy = stats?.totals?.asked
    ? Math.round((stats.totals.correct / stats.totals.asked) * 100)
    : null;

  return (
    <div className="pr-root">
      <header className="pr-head">
        <div>
          <h1>Practice</h1>
          <p>
            Recognising the pattern is what an interview tests in the first ninety seconds. Solving
            trains the typing; this trains the recognition, at about three seconds a go.
          </p>
        </div>

        {accuracy != null && (
          <div className="pr-stat">
            <span className="pr-stat-value mono">{accuracy}%</span>
            <span className="pr-stat-label">
              {stats.totals.correct} of {stats.totals.asked} · {stats.totals.runs}{' '}
              {stats.totals.runs === 1 ? 'run' : 'runs'}
            </span>
          </div>
        )}
      </header>

      <nav className="pb-tabs pr-tabs" aria-label="Practice mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={mode === m.id ? 'on' : ''}
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </nav>

      <div className="pr-grid">
        {mode === 'drill' ? <Drill /> : <Mock />}

        {/*
          What you keep missing. Server-side across every run, so it is a claim
          about you rather than about the last twenty questions — and it is the
          one weakness the rest of the app genuinely cannot see, because a
          pattern you never recognise is a pattern you never attempt.
        */}
        {mode === 'drill' && stats?.byPattern?.length > 0 && (
          <aside className="pr-panel pr-leaks">
            <span className="pr-eyebrow mono">MOST MISSED</span>
            <ul className="pr-leak-list">
              {stats.byPattern.map((row) => (
                <li key={row.slug}>
                  <span className="pr-leak-name">{nameOf(row.slug)}</span>
                  <span className="pr-leak-count mono">{row.missed}</span>
                </li>
              ))}
            </ul>
            <p className="hint">
              Counted across every run you have finished. Two or three at the top of this list is
              next week&rsquo;s revision, whatever the schedule says.
            </p>
          </aside>
        )}

        {/* The last few sittings, so a Saturday you skipped is visible. */}
        {mode === 'mock' && stats?.mocks?.length > 0 && (
          <aside className="pr-panel pr-leaks">
            <span className="pr-eyebrow mono">RECENT MOCKS</span>
            <ul className="pr-leak-list">
              {stats.mocks.map((m) => (
                <li key={m._id}>
                  <span className="pr-leak-name">
                    {new Date(m.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {' · '}
                    {m.finished}/{m.problems} out
                  </span>
                  <span className="pr-leak-count mono">{m.minutes}m</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
