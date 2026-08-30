import { PLAN_TOTALS, PLAN_WEEKS } from '../../playbook/plan.js';
import { usePlaybook } from '../../store/PlaybookContext.jsx';
import { IconCalendar, IconRotate } from '../ui/Icons.jsx';

/*
  `expectedBy` used to live here and be imported by PhasePlan. It reads the
  week targets, and the weeks now come in two readings, so it moved onto the
  resolved document in plan.js where it can only ever see one of them.
*/

const iso = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '');
const addWeeks = (date, weeks) => new Date(new Date(date).getTime() + weeks * 7 * 86_400_000);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86_400_000);

function Meter({ label, value, total, note, hue }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="pb-meter" data-hue={hue}>
      <span className="pb-meter-label">{label}</span>
      <span className="pb-meter-value mono">
        {value}
        <span className="pb-meter-total"> / {total}</span>
      </span>
      <span className="pb-bar">
        <span style={{ width: `${pct}%` }} />
      </span>
      {note && <span className="pb-meter-note">{note}</span>}
    </div>
  );
}

/**
 * The cockpit: which week it is, how the four counters stand, and — the number
 * that actually governs the next seven days — how far ahead or behind the plan
 * you are.
 *
 * "Behind" is computed against the schedule, not against the calendar, and it
 * is stated plainly rather than softened. A plan that cannot tell you it is
 * slipping is a wall poster.
 */
export function PlanHeader({ doc, week, roadmap, ladder, sql, design, checklist }) {
  const { plan, setDates } = usePlaybook();
  const { PHASES, expectedBy } = doc;
  const phase = week ? doc.phaseOf(week) : null;

  if (!plan.startedAt) {
    return (
      <header className="pb-arena pb-start">
        <div className="pb-brand">
          <span className="pb-brand-mark mono">P</span>
          <div>
            <h1>Playbook</h1>
            <p className="mono">{PLAN_WEEKS} WEEKS · {PLAN_TOTALS.roadmap} PROBLEMS · {PLAN_TOTALS.hoursPerWeek}H A WEEK</p>
          </div>
        </div>

        <p className="pb-start-copy">{doc.COPY.start}</p>

        <div className="pb-start-row">
          <label className="field">
            <span>Day one</span>
            <input
              type="date"
              defaultValue={iso(Date.now())}
              onChange={(e) => e.target.value && setDates({
                startedAt: new Date(e.target.value).toISOString(),
                targetDate: addWeeks(e.target.value, PLAN_WEEKS).toISOString(),
              })}
            />
          </label>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              setDates({
                startedAt: new Date().toISOString(),
                targetDate: addWeeks(Date.now(), PLAN_WEEKS).toISOString(),
              })
            }
          >
            Start today
          </button>
        </div>
      </header>
    );
  }

  const left = plan.targetDate ? daysBetween(Date.now(), plan.targetDate) : null;
  const expected = expectedBy(Math.max(0, (week || 1) - 1));
  const drift = roadmap.solved - expected;

  return (
    <header className="pb-arena">
      <div className="pb-arena-top">
        <div className="pb-brand">
          <span className="pb-brand-mark mono">P</span>
          <div>
            <h1>Playbook</h1>
            <p className="mono">
              WEEK {String(week).padStart(2, '0')} OF {PLAN_WEEKS}
              {phase ? ` · PHASE ${phase.n} — ${phase.name.toUpperCase()}` : ''}
            </p>
          </div>
        </div>

        <div className="pb-countdown">
          {left != null && (
            <span className="pb-days">
              <b className="mono">{left > 0 ? left : 0}</b> days to target
            </span>
          )}
          <label className="pb-date">
            <IconCalendar size={12} />
            <input
              type="date"
              value={iso(plan.targetDate)}
              onChange={(e) =>
                setDates({ targetDate: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
              title="The date you want to be interviewing by"
            />
          </label>
          <button
            type="button"
            className="chip-clear"
            title="Reset the plan — clears the start date, keeps every tick"
            aria-label="Reset start date"
            onClick={() => setDates({ startedAt: null })}
          >
            <IconRotate size={12} />
          </button>
        </div>
      </div>

      {/*
        The one line that changes what you do this week. Stated as a count of
        problems rather than days, because days are not the unit anything here
        is measured in.
      */}
      <p className={`pb-drift ${drift < -12 ? 'behind' : drift > 8 ? 'ahead' : 'ontrack'}`}>
        {drift < -12
          ? `${Math.abs(drift)} problems behind the schedule. Use Sunday’s buffer hour, and cut the ladder before you cut revision.`
          : drift > 8
            ? `${drift} problems ahead. Do not pull next week forward — spend it on the flagged ones instead.`
            : 'On schedule. Keep the evening queue running and this stays true.'}
      </p>

      <div className="pb-meters">
        <Meter
          label="Roadmap"
          value={roadmap.solved}
          total={roadmap.total || PLAN_TOTALS.roadmap}
          note={`${expected} expected by now`}
          hue="blue"
        />
        <Meter
          label="Ladder · Foundations→Specialist"
          value={ladder.solved}
          /*
            562 is the fallback only — the live count comes from the CP stats
            endpoint above. It moved from 409 when the ladder grew to 1,100, and
            a stale fallback here is a meter that reads over 100% for anyone
            whose stats request fails.
          */
          total={ladder.total || 562}
          note={`plan asks for ${PLAN_TOTALS.cp}`}
          hue="teal"
        />
        {/*
          Dropped entirely rather than shown at 0/117 when the stats request
          fails or the SQL module is off — a meter that reads zero because it
          could not ask is worse than no meter, because it looks like work you
          have not done.
        */}
        {sql && (
          <Meter
            label="SQL bank"
            value={sql.solved}
            total={sql.total}
            note="weeks 4–15, Fridays"
            hue="teal"
          />
        )}
        <Meter
          label="Design · HLD + LLD"
          value={design.done}
          total={design.total}
          note="from week 13"
          hue="violet"
        />
        <Meter
          label="Plan checklist"
          value={checklist.done}
          total={checklist.total}
          note={`${PHASES.length} phases · ${PLAN_WEEKS} weeks`}
          hue="amber"
        />
      </div>
    </header>
  );
}
