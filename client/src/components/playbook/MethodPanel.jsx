import { PLAN_TOTALS } from '../../playbook/plan.js';

/**
 * How the work is done — the tab that does not change.
 *
 * Everything else on this page moves as problems get solved. This is the part
 * that makes the movement mean anything, and it is written to be re-read on a
 * week that went badly rather than skimmed once in week one.
 *
 * The order is deliberate and it is not the order these were written in. The
 * week comes first because it is the only thing you have to act on today. Then
 * the loop for a single problem, then the ladder for a whole pattern, then what
 * a pattern costs once you have it, then revision, then how any of it is stored
 * — smallest unit of work outward. The eleven rules sit last: they are the
 * summary, and a summary read before the thing it summarises is just a list.
 */

/** The `pb-rules` shape — a numbered or labelled list of titled paragraphs. */
function Steps({ items, marker }) {
  return (
    <ol className="pb-rules">
      {items.map((item, i) => (
        <li key={item.id}>
          <span className="pb-rule-n mono">{marker(item, i)}</span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Panel({ eyebrow, title, lead, children }) {
  return (
    <section className="pb-panel">
      <header className="pb-panel-head">
        <div>
          <span className="pb-eyebrow mono">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </header>
      {lead && <p className="pb-lead">{lead}</p>}
      {children}
    </section>
  );
}

export function MethodPanel({ doc }) {
  const {
    MENTAL_MODELS,
    PATTERN_BUDGET,
    PATTERN_LADDER,
    REVISION_COST,
    REVISION_SCHEDULE,
    RULES,
    SOLVE_LOOP,
    TIMETABLE,
    COPY,
  } = doc;

  return (
    <div className="pb-method">
      <Panel eyebrow="THE WEEK" title={`${PLAN_TOTALS.hoursPerWeek} hours, where they go`}>
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
      </Panel>

      <Panel
        eyebrow="ONE PROBLEM"
        title="The ninety-minute morning, problem by problem"
        lead="Three or four of these and nothing else. Every step has a clock on it because the failure mode for a careful learner is not giving up too early — it is spending ninety minutes on one problem, getting it, and having learned a quarter of what four would have taught."
      >
        <Steps items={SOLVE_LOOP} marker={(item) => item.at} />
      </Panel>

      <Panel
        eyebrow="ONE PATTERN"
        title="Getting comfortable, in five stages"
        lead="Comfort is a stage you arrive at, not a feeling you wait for. It happens at stage four — and most people never reach it, because stage three feels like mastery while the label is still on."
      >
        <Steps items={PATTERN_LADDER} marker={(item) => item.cost} />

        <dl className="pb-budget">
          <div>
            <dt>What a pattern costs to learn</dt>
            <dd>{PATTERN_BUDGET.learn}</dd>
          </div>
          <div>
            <dt>When it counts as confident</dt>
            <dd>{PATTERN_BUDGET.confident}</dd>
          </div>
          <div>
            <dt>What it costs after that</dt>
            <dd>{PATTERN_BUDGET.maintain}</dd>
          </div>
          <div>
            <dt>What re-opens it</dt>
            <dd>{PATTERN_BUDGET.reopen}</dd>
          </div>
          <div>
            <dt>And the arithmetic</dt>
            <dd>{PATTERN_BUDGET.arithmetic}</dd>
          </div>
        </dl>
      </Panel>

      <Panel
        eyebrow="REVISION"
        title="Four intervals, and what they actually cost"
        lead={COPY.revisionLead}
      >
        <Steps items={REVISION_SCHEDULE} marker={(item) => item.when} />
        <p className="pb-note-line">
          <b>The weekly price.</b> {REVISION_COST.weekly}
        </p>
        <p className="pb-note-line">
          <b>The one rule that keeps it honest.</b> {REVISION_COST.queueRule}
        </p>
      </Panel>

      <Panel
        eyebrow="MENTAL MODELS"
        title="What actually gets stored"
        lead="An interview is a retrieval test under time pressure, not a derivation test. These four artefacts are the difference between four hundred problems solved and four hundred problems available."
      >
        <Steps items={MENTAL_MODELS} marker={(_, i) => String(i + 1).padStart(2, '0')} />
      </Panel>

      <Panel eyebrow="THE RULES" title={`${RULES.length}, and the first three matter most`}>
        <Steps items={RULES} marker={(_, i) => String(i + 1).padStart(2, '0')} />
      </Panel>
    </div>
  );
}
