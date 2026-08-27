import { PLAN_TOTALS, RULES, TIMETABLE } from '../../playbook/plan.js';

/**
 * How the work is done — the eight rules, and the week they are done in.
 *
 * This tab is the one that does not change. Everything else on the page moves
 * as problems get solved; these are the commitments that make the movement
 * mean anything, and they are here to be re-read on a week that went badly.
 */
export function MethodPanel() {
  return (
    <div className="pb-method">
      <section className="pb-panel">
        <header className="pb-panel-head">
          <div>
            <span className="pb-eyebrow mono">THE WEEK</span>
            <h2>{PLAN_TOTALS.hoursPerWeek} hours, where they go</h2>
          </div>
        </header>

        <div className="pb-slots">
          {TIMETABLE.map((slot) => (
            <div key={slot.id} className="pb-slot" data-kind={slot.kind}>
              <div className="pb-slot-time">
                <span className="pb-slot-days">{slot.days}</span>
                <span className="mono">{slot.time}</span>
              </div>
              <div className="pb-slot-body">
                <h3>{slot.title}</h3>
                <p>{slot.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="pb-panel">
        <header className="pb-panel-head">
          <div>
            <span className="pb-eyebrow mono">THE RULES</span>
            <h2>Eight, and the first three matter most</h2>
          </div>
        </header>

        <ol className="pb-rules">
          {RULES.map((rule, i) => (
            <li key={rule.id}>
              <span className="pb-rule-n mono">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{rule.title}</h3>
                <p>{rule.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
