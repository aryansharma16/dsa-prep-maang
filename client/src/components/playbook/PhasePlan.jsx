import { PHASES, WEEKS } from '../../playbook/plan.js';
import { expectedBy } from './PlanHeader.jsx';
import { usePlaybook } from '../../store/PlaybookContext.jsx';
import { IconCheck } from '../ui/Icons.jsx';

/**
 * The four phases and the twenty-four weeks under them.
 *
 * A phase's bar is not a count of ticked boxes — it is the real solved count of
 * the patterns that phase owns, read out of the roadmap. That is the difference
 * between a plan that tracks itself and one you have to maintain: the only way
 * to move this bar is to actually solve the problems.
 */
export function PhasePlan({ week, patternProgress }) {
  const { doneCount } = usePlaybook();

  return (
    <div className="pb-phases">
      {PHASES.map((phase) => {
        const owned = phase.patterns.map((slug) => patternProgress[slug]).filter(Boolean);
        const solved = owned.reduce((n, p) => n + p.solved, 0);
        const total = owned.reduce((n, p) => n + p.total, 0);
        const pct = total ? Math.round((solved / total) * 100) : 0;
        const weeks = WEEKS.filter((w) => w.phase === phase.id);
        const state = week > phase.to ? 'past' : week >= phase.from ? 'now' : 'ahead';

        return (
          <section key={phase.id} className={`pb-phase ${state}`} data-hue={phase.hue}>
            <header className="pb-phase-head">
              <span className="pb-phase-n mono">{String(phase.n).padStart(2, '0')}</span>
              <div className="pb-phase-title">
                <h2>
                  {phase.name}
                  <span className="pb-phase-weeks mono">
                    weeks {phase.from}–{phase.to}
                  </span>
                  {state === 'now' && <span className="pb-here mono">HERE</span>}
                </h2>
                <p className="pb-phase-aim">{phase.aim}</p>
              </div>
              {total > 0 && (
                <span className="pb-phase-meter">
                  <span className="pb-bar">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="mono">
                    {solved}/{total}
                  </span>
                </span>
              )}
            </header>

            <p className="pb-phase-detail">{phase.detail}</p>

            <ol className="pb-weeks">
              {weeks.map((w) => {
                const ticks = doneCount(w.tasks.map((t) => t.id));
                const all = ticks === w.tasks.length;
                return (
                  <li
                    key={w.n}
                    className={`pb-week-row ${w.n === week ? 'now' : ''} ${w.n < week ? 'past' : ''}`}
                  >
                    <span className="pb-week-n mono">W{String(w.n).padStart(2, '0')}</span>
                    <span className="pb-week-focus">
                      {w.focus}
                      {w.milestone && <span className="pb-milestone">{w.milestone}</span>}
                    </span>
                    <span className="pb-week-nums mono">
                      {w.target > 0 ? `${w.target}p` : '—'}
                      {w.cp > 0 && <span className="dim"> · {w.cp}cp</span>}
                    </span>
                    <span className={`pb-week-ticks mono ${all ? 'all' : ''}`}>
                      {all ? <IconCheck size={11} /> : `${ticks}/${w.tasks.length}`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <p className="pb-foot-note">
        Cumulative target by the end of each phase:{' '}
        {PHASES.map((p) => `${p.name} ${expectedBy(p.to)}`).join(' · ')} problems. The two weeks with
        no new patterns — 13 and 18 — are not slack. They are what stops the middle of a plan like
        this from quietly falling apart, and they exist because you said you need revision to keep
        what you learn.
      </p>
    </div>
  );
}
