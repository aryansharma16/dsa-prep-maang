import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { sprintApi } from '../api/index.js';
import { useRoadmap } from '../store/RoadmapContext.jsx';
import { useToast } from '../store/ToastContext.jsx';

/**
 * Interview Helper → 30-Day Sprint. Two plans, switchable at the top:
 * "Sprint 300" (the AI 300, easy to hard per pattern) and "Kit 360" (the
 * resource kit's own list and order; most of its problems are `extra` rows,
 * loaded through RoadmapContext.loadExtras).
 *
 * The plan comes from the `sprints` collection; your length and start date from
 * your enrollment. Solved status is the roadmap's own progress, read from
 * RoadmapContext and written through it, so ticking a problem here ticks it on
 * the roadmap too, and the other way round.
 *
 * Days are an even split of the list: day i gets items
 * [floor(i·n/days), floor((i+1)·n/days)), so 30 days is 10 a day and 90 days is
 * 3–4 a day, with no empty days at the end.
 */
const PLANS = [
  { key: 'sprint-300', label: 'Sprint 300' },
  { key: 'kit-360', label: 'Kit 360' },
];
const PLAN_KEY = 'sprint-plan';
const readPlan = () => {
  try {
    const v = localStorage.getItem(PLAN_KEY);
    return PLANS.some((p) => p.key === v) ? v : PLANS[0].key;
  } catch {
    return PLANS[0].key;
  }
};
const DAY_MS = 86400000;

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const fmt = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function SprintPage() {
  const { toast } = useToast();
  const { groups, extraGroups, loadExtras, setProgress, loading: roadmapLoading } = useRoadmap();
  const [KEY, setPlanKey] = useState(readPlan);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pickDays, setPickDays] = useState(30);
  const [selected, setSelected] = useState(null); // day number, or 'stretch'
  const [busy, setBusy] = useState(false);

  // The kit plan is mostly extra problems; load them once.
  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setSelected(null);
    try {
      localStorage.setItem(PLAN_KEY, KEY);
    } catch {
      // Remembering the plan is a convenience only.
    }
    sprintApi
      .get(KEY)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setPickDays(res.enrollment ? res.enrollment.days : 30);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'Could not load the sprint')));
    return () => {
      cancelled = true;
    };
  }, [KEY]);

  // Every roadmap problem by id, with its progress.
  const byId = useMemo(() => {
    const map = new Map();
    for (const g of [...(groups || []), ...(extraGroups || [])]) for (const p of g.problems) map.set(p._id, p);
    return map;
  }, [groups, extraGroups]);

  const enrollment = data?.enrollment;
  const items = data?.sprint.items || [];
  const stretch = data?.sprint.stretch || [];
  const days = enrollment?.days || pickDays;
  const n = items.length;

  const dayRange = (d) => [Math.floor(((d - 1) * n) / days), Math.floor((d * n) / days)];
  const isSolved = (item) => byId.get(item.problemId)?.progress?.status === 'solved';

  const today = enrollment
    ? Math.min(days, Math.max(1, Math.floor((startOfDay(new Date()) - startOfDay(enrollment.startedAt)) / DAY_MS) + 1))
    : 1;
  const finished = enrollment && startOfDay(new Date()) - startOfDay(enrollment.startedAt) >= days * DAY_MS;

  const solvedCount = items.filter(isSolved).length;
  const dueBy = enrollment ? dayRange(today)[1] : 0;
  const behind = enrollment ? items.slice(0, dueBy).filter((i) => !isSolved(i)).length : 0;
  const pct = n ? Math.round((solvedCount / n) * 100) : 0;

  const activeDay = selected ?? (enrollment ? today : 1);
  const dayItems =
    activeDay === 'stretch' ? stretch : items.slice(...dayRange(activeDay));
  const dayDone = dayItems.filter(isSolved).length;
  const dayDate = enrollment && activeDay !== 'stretch'
    ? new Date(startOfDay(enrollment.startedAt).getTime() + (activeDay - 1) * DAY_MS)
    : null;
  const dayPatterns = [...new Set(dayItems.map((i) => i.pattern))];

  const start = async (lengthDays, restart = false) => {
    setBusy(true);
    try {
      const body = { days: lengthDays };
      if (restart || !enrollment) body.startedAt = startOfDay(new Date()).toISOString();
      const next = await sprintApi.enroll(KEY, body);
      setData((d) => ({ ...d, enrollment: next }));
      setPickDays(next.days);
      setSelected(null);
      toast(restart ? 'Sprint restarted from today' : enrollment ? `Now a ${next.days}-day sprint` : 'Sprint started', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not save'), 'error');
    }
    setBusy(false);
  };

  const stop = async () => {
    setBusy(true);
    try {
      await sprintApi.leave(KEY);
      setData((d) => ({ ...d, enrollment: null }));
      setSelected(null);
      toast('Sprint stopped. Solved problems stay solved.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not stop it'), 'error');
    }
    setBusy(false);
  };

  const toggle = (item) => {
    const p = byId.get(item.problemId);
    if (!p) return;
    setProgress(p._id, { status: isSolved(item) ? 'todo' : 'solved' });
  };

  if (error) return <p className="sp-empty">{error}</p>;
  const planSwitch = (
    <div className="sp-seg" role="radiogroup" aria-label="Plan">
      {PLANS.map((p) => (
        <button
          key={p.key}
          type="button"
          role="radio"
          aria-checked={KEY === p.key}
          className={KEY === p.key ? 'active' : ''}
          onClick={() => setPlanKey(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  if (!data || roadmapLoading) return <p className="sp-empty">Loading the sprint…</p>;

  return (
    <div className="sp">
      <header className="sp-head">
        <div>
          <h1>30-Day Sprint</h1>
          <p>
            {data.sprint.summary} Ticks sync with the <Link to="/">roadmap</Link>.
          </p>
        </div>
        <div className="sp-controls">
          {planSwitch}
          <div className="sp-seg" role="radiogroup" aria-label="Sprint length">
            {data.sprint.lengths.map((len) => (
              <button
                key={len}
                type="button"
                role="radio"
                aria-checked={days === len}
                className={days === len ? 'active' : ''}
                disabled={busy}
                onClick={() => (enrollment ? len !== days && start(len) : setPickDays(len))}
              >
                {len}d
              </button>
            ))}
          </div>
          {enrollment ? (
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => start(days, true)}>
                Restart
              </button>
              <button type="button" className="btn" disabled={busy} onClick={stop}>
                Stop
              </button>
            </>
          ) : (
            <button type="button" className="btn primary" disabled={busy} onClick={() => start(pickDays)}>
              Start {pickDays}-day sprint
            </button>
          )}
        </div>
      </header>

      <div className="sp-stats">
        <div className="sp-stat sp-progress">
          <div className="sp-stat-top">
            <b>{solvedCount}</b>
            <span>/ {n} solved</span>
            <em>{pct}%</em>
          </div>
          <div className="sp-bar">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="sp-stat">
          <b>{enrollment ? (finished ? 'Done' : `Day ${today}`) : '—'}</b>
          <span>{enrollment ? `of ${days} · started ${fmt(new Date(enrollment.startedAt))}` : 'not started'}</span>
        </div>
        <div className="sp-stat">
          <b>{Math.ceil(n / days)}</b>
          <span>problems a day</span>
        </div>
        <div className={`sp-stat ${behind ? 'warn' : enrollment ? 'ok' : ''}`}>
          <b>{enrollment ? (behind ? behind : '✓') : '—'}</b>
          <span>{enrollment ? (behind ? 'behind schedule' : 'on track') : 'start to track pace'}</span>
        </div>
      </div>

      <div className="sp-body">
        <aside className="sp-days" aria-label="Days">
          <div className="sp-grid">
            {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
              const [a, b] = dayRange(d);
              const slice = items.slice(a, b);
              const done = slice.filter(isSolved).length;
              const state = done === slice.length && slice.length ? 'done' : done ? 'part' : '';
              return (
                <button
                  key={d}
                  type="button"
                  className={`sp-day ${state} ${activeDay === d ? 'active' : ''} ${enrollment && d === today ? 'today' : ''}`}
                  onClick={() => setSelected(d)}
                  title={`Day ${d}: ${done}/${slice.length} solved`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {stretch.length > 0 && (
            <button
              type="button"
              className={`sp-stretch-btn ${activeDay === 'stretch' ? 'active' : ''}`}
              onClick={() => setSelected('stretch')}
            >
              <b>Stretch</b>
              <span>
                {stretch.filter(isSolved).length}/{stretch.length} · extra Hard problems
              </span>
            </button>
          )}
          <ul className="sp-legend">
            <li>
              <i className="done" /> done
            </li>
            <li>
              <i className="part" /> started
            </li>
            <li>
              <i className="today" /> today
            </li>
          </ul>
        </aside>

        <section className="sp-list">
          <div className="sp-list-head">
            <div>
              <h2>
                {activeDay === 'stretch' ? 'Stretch problems' : `Day ${activeDay}`}
                {dayDate && <small>{fmt(dayDate)}</small>}
              </h2>
              <p>
                {activeDay === 'stretch'
                  ? 'Hard problems from the resource kit that are in our bank but not in the 300. Do them after the sprint, or when a pattern feels easy.'
                  : dayPatterns.join(' · ')}
              </p>
            </div>
            <span className="sp-count">
              {dayDone}/{dayItems.length}
            </span>
          </div>

          <ul className="sp-problems">
            {dayItems.map((item) => {
              const p = byId.get(item.problemId);
              const solved = isSolved(item);
              return (
                <li key={item.problemId} className={solved ? 'solved' : ''}>
                  <button
                    type="button"
                    className="sp-check"
                    onClick={() => toggle(item)}
                    disabled={!p}
                    aria-pressed={solved}
                    aria-label={solved ? 'Mark not solved' : 'Mark solved'}
                  >
                    {solved ? '✓' : ''}
                  </button>
                  <div className="sp-title">
                    {p ? (
                      <a href={p.url || '#'} target="_blank" rel="noreferrer">
                        {p.title}
                      </a>
                    ) : (
                      <span>{item.slug}</span>
                    )}
                    <small>{item.pattern}</small>
                  </div>
                  {item.kit && (
                    <span className="sp-kit" title="Also on the resource kit's 30-day list">
                      KIT
                    </span>
                  )}
                  <span className={`sp-diff ${item.difficulty.toLowerCase()}`}>{item.difficulty}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
