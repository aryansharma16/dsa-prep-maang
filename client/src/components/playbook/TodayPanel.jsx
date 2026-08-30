import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLAN_WEEKS, SQL_WEEKS } from '../../playbook/plan.js';
import { usePlaybook } from '../../store/PlaybookContext.jsx';
import { IconCheck, IconChevronRight } from '../ui/Icons.jsx';

/**
 * Which slots belong to today, and which one is running right now.
 *
 * Two of the evening slots exist only on certain days of certain weeks — the
 * design hour on Tuesday and Thursday from week 13, the SQL block on Friday for
 * weeks 4 to 15. That is exactly the sort of rule that is easy to write into
 * prose and easy to forget on a Friday, so it is computed here rather than
 * described anywhere.
 */
function slotsForToday(timetable, week) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours() + now.getMinutes() / 60;

  const between = (from, to) => hour >= from && hour < to;
  const slot = (id, live) => ({ ...timetable.find((s) => s.id === id), live });

  if (day === 6) return [slot('sat', between(10, 17))];
  if (day === 0) return [slot('sun', between(10, 17))];

  /*
    Friday's SQL block replaces the evening rather than joining it, so it is
    swapped in, not appended — showing both would advertise four hours on the
    one night of the week that most needs to look finishable.
  */
  const evening =
    day === 5 && week >= SQL_WEEKS.from && week <= SQL_WEEKS.to ? 'fri-sql' : 'pm';

  const out = [slot('am', between(7, 9)), slot(evening, between(20, 23))];
  if (week >= 13 && (day === 2 || day === 4)) {
    out.splice(2, 0, slot('pm-sd', between(20, 21)));
  }
  return out;
}

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** One week's checklist, its focus patterns, and the retro line. */
function WeekCard({ week, patternProgress }) {
  const { isDone, toggle, plan, setNote } = usePlaybook();
  const noteKey = `w${String(week.n).padStart(2, '0')}`;
  const [draft, setDraft] = useState(plan.notes?.[noteKey] || '');

  return (
    <section className="pb-panel pb-week">
      <header className="pb-panel-head">
        <div>
          <span className="pb-eyebrow mono">THIS WEEK</span>
          <h2>{week.focus}</h2>
        </div>
        <span className="pb-week-target mono">
          {week.target > 0 ? `${week.target} problems` : 'no new problems'}
          {week.cp > 0 ? ` · ${week.cp} ladder` : ''}
        </span>
      </header>

      {week.patterns.length > 0 && (
        <div className="pb-patterns">
          {week.patterns.map((slug) => {
            const p = patternProgress[slug];
            const pct = p?.total ? Math.round((p.solved / p.total) * 100) : 0;
            return (
              <Link key={slug} to={`/?pattern=${slug}`} className="pb-pattern">
                <span className="pb-pattern-name">{p?.name || slug}</span>
                <span className="pb-bar">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="pb-pattern-frac mono">
                  {p ? `${p.solved}/${p.total}` : '—'}
                </span>
                <IconChevronRight size={13} />
              </Link>
            );
          })}
        </div>
      )}

      <ul className="pb-tasks">
        {week.tasks.map((task) => {
          const on = isDone(task.id);
          return (
            <li key={task.id}>
              <button
                type="button"
                className={`pb-task ${on ? 'on' : ''}`}
                onClick={() => toggle(task.id)}
                aria-pressed={on}
              >
                <span className="pb-box">{on && <IconCheck size={11} />}</span>
                <span>{task.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/*
        The retro line. Saved on blur rather than per keystroke — this is a
        sentence written once on a Sunday, not a field anyone types in live, and
        a PATCH per character would be forty requests for one thought.
      */}
      <label className="pb-note">
        <span className="pb-eyebrow mono">SUNDAY RETRO</span>
        <textarea
          rows={2}
          value={draft}
          placeholder="What actually happened this week — one honest line."
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== (plan.notes?.[noteKey] || '') && setNote(noteKey, draft)}
        />
      </label>
    </section>
  );
}

export function TodayPanel({ doc, week, patternProgress, leaks = [] }) {
  const { MILESTONES } = doc;
  const current = doc.weekAt(week);
  const slots = slotsForToday(doc.TIMETABLE, week);
  const today = DAY[new Date().getDay()];
  const phase = doc.phaseOf(week);
  // The next dated thing, or the last one once they are all behind you.
  const next =
    MILESTONES.find((m) => m.week >= week) ||
    (week >= PLAN_WEEKS ? MILESTONES[MILESTONES.length - 1] : null);

  return (
    <div className="pb-today-grid">
      <section className="pb-panel">
        <header className="pb-panel-head">
          <div>
            <span className="pb-eyebrow mono">TODAY</span>
            <h2>{today}</h2>
          </div>
        </header>

        <div className="pb-slots">
          {slots.filter(Boolean).map((slot) => (
            <div key={slot.id} className={`pb-slot ${slot.live ? 'live' : ''}`} data-kind={slot.kind}>
              <div className="pb-slot-time">
                <span className="mono">{slot.time}</span>
                {slot.live && <span className="pb-live mono">NOW</span>}
              </div>
              <div className="pb-slot-body">
                <h3>{slot.title}</h3>
                <p>{slot.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/*
          What this week is a part of, and what is next. Without it the Today
          column is three slots and a lot of nothing beside a much taller card —
          and the answer to "why am I doing sliding window this week" is the one
          thing a plan should never make you go looking for.
        */}
        {/*
          The plan is a fixed schedule; this is the one thing that argues with
          it. Two patterns costing you the most attempts beat whatever week 9
          said you would be doing — the schedule was written before any of this
          was known.
        */}
        {leaks.length > 0 && (
          <div className="pb-leak">
            <span className="pb-eyebrow mono">COSTING YOU THE MOST</span>
            <p>
              {leaks.map((l, i) => (
                <span key={l.slug}>
                  {i > 0 && ' · '}
                  <b>{l.name}</b> <span className="mono">{l.relearn.toFixed(1)}×</span>
                </span>
              ))}
            </p>
            <Link to="/stats">Full leak report</Link>
          </div>
        )}

        <div className="pb-orient">
          <span className="pb-eyebrow mono">WHERE THIS SITS</span>
          {phase && (
            <p>
              <b>
                Phase {phase.n} — {phase.name}
              </b>{' '}
              · weeks {phase.from}–{phase.to}. {phase.aim}
            </p>
          )}
          {next && (
            <span className="pb-next mono">
              NEXT · W{next.week} — {next.label}
              {next.week > week ? ` · ${next.week - week}w` : ''}
            </span>
          )}

          <div className="pb-jump">
            <Link to="/revision">Revision queue</Link>
            <Link to="/">Roadmap</Link>
            {/* Rule 4's trigger line, as an exercise. The plan asks you to write
                one per problem; this is the same skill, tested rather than
                written, and it fits in the gaps a schedule cannot fill. */}
            <Link to="/practice">Pattern drill</Link>
            <Link to="/cp">Ladder</Link>
            <Link to="/stats">Stats</Link>
          </div>
        </div>
      </section>

      {current && <WeekCard week={current} patternProgress={patternProgress} />}
    </div>
  );
}
