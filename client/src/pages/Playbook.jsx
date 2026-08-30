import { useEffect, useMemo, useState } from 'react';
import { cpApi, sqlApi, statsApi } from '../api/index.js';
import { DesignTrack } from '../components/playbook/DesignTrack.jsx';
import { MethodPanel } from '../components/playbook/MethodPanel.jsx';
import { PhasePlan } from '../components/playbook/PhasePlan.jsx';
import { PlanHeader } from '../components/playbook/PlanHeader.jsx';
import { SqlTrack } from '../components/playbook/SqlTrack.jsx';
import { TodayPanel } from '../components/playbook/TodayPanel.jsx';
import { PLAN_TOTALS, weekOf } from '../playbook/plan.js';
import { usePlan } from '../playbook/usePlan.js';
import { usePlaybook } from '../store/PlaybookContext.jsx';
import { useRoadmap } from '../store/RoadmapContext.jsx';

/**
 * Playbook — the owner's interview-prep plan, running.
 *
 * The page is a reader over three sources it does not own. The plan is authored
 * in `playbook/plan.js`; what has been ticked comes from PlaybookContext; and
 * every number that says how far along anything is comes from the roadmap and
 * ladder rows that already exist. Nothing here is a second copy of progress
 * that could disagree with the pages it came from.
 *
 * The ladder counts are fetched from `/cp/stats` rather than by mounting
 * CPProvider, which would pull all 800 rows to read seven numbers off the end
 * of them. A deployment with Pro Coder hidden simply 404s there and the plan
 * renders without those two figures, which is the honest degradation — the
 * ladder is a third of this plan, not the spine of it.
 */

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'The plan' },
  { id: 'design', label: 'Design' },
  { id: 'sql', label: 'SQL' },
  { id: 'method', label: 'Method' },
];

/** The three tiers the plan actually uses. Above Specialist is not in scope. */
const PLAN_TIERS = ['newbie', 'pupil', 'specialist'];

function useLadder() {
  const [ladder, setLadder] = useState({ solved: 0, total: 0, available: true });

  useEffect(() => {
    let live = true;
    cpApi
      .stats()
      .then((data) => {
        if (!live) return;
        const rows = (data?.byTier || []).filter((t) => PLAN_TIERS.includes(t.tier));
        setLadder({
          solved: rows.reduce((n, t) => n + t.solved, 0),
          total: rows.reduce((n, t) => n + t.total, 0),
          available: true,
        });
      })
      // Pro Coder off, or the ladder never seeded. Not an error worth a toast:
      // the plan is still a plan without its two ladder numbers.
      .catch(() => live && setLadder({ solved: 0, total: 0, available: false }));
    return () => {
      live = false;
    };
  }, []);

  return ladder;
}

/**
 * The SQL bank, solved against total.
 *
 * Read from `/sql/stats` rather than mounting SqlProvider, which would pull the
 * whole 117-problem bank and a WASM engine to add up two numbers. Same shape as
 * `useLadder` above, and the same degradation: SQL hidden or never seeded 404s
 * here, the meter drops out, and the twelve Fridays are still on the schedule.
 */
function useSqlBank() {
  const [bank, setBank] = useState(null);

  useEffect(() => {
    let live = true;
    sqlApi
      .stats()
      .then((data) => {
        if (!live || !data?.categories) return;
        setBank({
          solved: data.categories.reduce((n, c) => n + c.solved, 0),
          total: data.categories.reduce((n, c) => n + c.total, 0),
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return bank;
}

/**
 * The two patterns costing the most attempts per solve.
 *
 * The plan is a schedule written before any of this was known; this is the one
 * signal allowed to argue with it. Read from the same `/stats` endpoint the
 * Stats page uses rather than a second aggregation, so the two can never
 * disagree about which pattern is worst.
 */
function useLeaks() {
  const [leaks, setLeaks] = useState([]);

  useEffect(() => {
    let live = true;
    statsApi
      .get()
      .then((data) => {
        if (!live || !data?.byLeak) return;
        const named = Object.fromEntries((data.byPattern || []).map((p) => [p.slug, p.name]));
        setLeaks(
          data.byLeak
            // The same floor the Stats panel applies: two attempts on one
            // problem is a bad afternoon, not a weakness.
            .filter((r) => r.attempts >= 4 && r.touched >= 2)
            .map((r) => ({
              slug: r.slug,
              name: named[r.slug] || r.slug,
              relearn: r.attempts / Math.max(1, r.solved),
            }))
            .sort((a, b) => b.relearn - a.relearn)
            .slice(0, 2),
        );
      })
      // Stats hidden, or nothing logged yet. The plan reads fine without it.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return leaks;
}

export function Playbook() {
  const { plan, loading, loadError, doneCount } = usePlaybook();
  /*
    Two readings of the same document — personal for the account it was written
    for, generic for everyone else. Read here and passed down rather than
    re-derived in each panel, so one render can never mix the two.
  */
  const doc = usePlan();
  const { groups } = useRoadmap();
  const ladder = useLadder();
  const sql = useSqlBank();
  const leaks = useLeaks();
  const [tab, setTab] = useState('today');

  /** slug → { name, solved, total }, the roadmap's own counts. */
  const patternProgress = useMemo(() => {
    const map = {};
    for (const g of groups) map[g.slug] = { name: g.name, solved: g.solved, total: g.total };
    return map;
  }, [groups]);

  const roadmap = useMemo(
    () =>
      groups.reduce(
        (acc, g) => ({ solved: acc.solved + g.solved, total: acc.total + g.total }),
        { solved: 0, total: 0 },
      ),
    [groups],
  );

  const week = weekOf(plan.startedAt) || 1;

  /* Both tracks in one number — the header has one design meter, and splitting
     it would put two bars on the cockpit for one evening's worth of work. */
  const design = useMemo(() => {
    const ids = doc.DESIGN_TRACKS.flatMap((t) => t.blocks.flatMap((b) => b.items.map((i) => i.id)));
    return { done: doneCount(ids), total: ids.length };
  }, [doc, doneCount]);

  const checklist = useMemo(() => {
    const ids = doc.WEEKS.flatMap((w) => w.tasks.map((t) => t.id));
    return { done: doneCount(ids), total: ids.length };
  }, [doc, doneCount]);

  /*
    Before day one there is no "today" to show, so that tab is not offered and
    the plan is what opens instead. Derived rather than seeded into state: the
    start date is not known on the first render, and a useEffect that corrected
    the tab afterwards would flash the wrong panel.
  */
  const started = Boolean(plan.startedAt);
  const activeTab = started ? tab : tab === 'today' ? 'plan' : tab;

  if (loading) {
    return (
      <div className="pb-root pb-page">
        <div className="pb-arena skeleton-plan" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="pb-root pb-page">
        <div className="empty">
          <h3>Could not load the plan</h3>
          <p>{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-root pb-page">
      <PlanHeader
        doc={doc}
        week={started ? week : null}
        roadmap={{ ...roadmap, total: roadmap.total || PLAN_TOTALS.roadmap }}
        ladder={ladder}
        sql={sql}
        design={design}
        checklist={checklist}
      />

      <nav className="pb-tabs" aria-label="Playbook sections">
        {(started ? TABS : TABS.slice(1)).map((t) => (
          <button
            key={t.id}
            type="button"
            className={activeTab === t.id ? 'on' : ''}
            aria-pressed={activeTab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* The whole plan is readable before day one — you should be able to see
          what you are committing to before the clock starts. `week` is 0 then,
          which marks nothing as current. */}
      {activeTab === 'today' && (
        <TodayPanel doc={doc} week={week} patternProgress={patternProgress} leaks={leaks} />
      )}
      {activeTab === 'plan' && (
        <PhasePlan doc={doc} week={started ? week : 0} patternProgress={patternProgress} />
      )}
      {activeTab === 'design' && <DesignTrack doc={doc} week={started ? week : 0} />}
      {activeTab === 'sql' && <SqlTrack doc={doc} week={started ? week : 0} stats={sql} />}
      {activeTab === 'method' && <MethodPanel doc={doc} />}
    </div>
  );
}
