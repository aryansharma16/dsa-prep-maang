import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'An alert is **an interruption of a human being**, and that is the only lens worth applying to it. Most alerting systems fail not by missing incidents but by firing so often that the one real page arrives among forty that did not matter.',
    ),

    h('Symptoms, not causes'),
    diagram(
      `
   CAUSE-BASED                       SYMPTOM-BASED

   CPU > 80%                         error rate > 1%
   disk > 90%                        p99 latency > 2s
   a pod restarted                   orders/min dropped 50%
   memory > 85%                      checkout success < 99%
   replica lag > 10s
                                     ✓ every one implies a user
   ✗ may be completely fine            is affected
   ✗ fires constantly                ✓ catches causes you never
   ✗ misses causes you never           thought to alert on
     anticipated                     ✓ far fewer of them

   CPU at 95% while everything is fast and correct is not
   an incident. it is a graph.
`,
      'Alert on what users feel',
    ),
    table(
      ['Page a human for', 'Do not page for'],
      [
        ['Users cannot complete a core action', 'A single server restarting'],
        ['Error rate above the SLO', 'CPU or memory thresholds'],
        ['Latency breaching the SLO', 'A transient blip that self-healed'],
        ['Data loss, or a risk of it', 'A backlog that is draining'],
        ['Security: unexpected privilege use', 'Anything with a documented "wait and see"'],
        ['A resource that will exhaust within hours', 'Something already automatically remediated'],
      ],
    ),
    tip(
      'The test: **"if this fires at 3am, is there something a human must do right now?"** If the answer is "look at it in the morning", it is a ticket. If it is "nothing, it recovers", it is a graph. Only the third case is a page.',
    ),

    h('Alert fatigue'),
    warn(
      'This is the failure mode that actually causes outages. An on-call receiving thirty pages a week **stops reading them carefully** — and the real one is acknowledged and dismissed along with the noise. Every non-actionable alert makes the system less safe, not more.',
    ),
    table(
      ['Symptom', 'Fix'],
      [
        ['Alerts nobody acts on', 'Delete them. Genuinely'],
        ['The same alert every night', 'Fix the cause, or change the threshold to reality'],
        ['Flapping', 'Require the condition to persist — "for 5 minutes"'],
        ['Twenty alerts for one incident', 'Group and suppress by dependency'],
        ['"We always ignore that one"', 'It is not an alert. Remove it'],
      ],
    ),

    h('Severity'),
    table(
      ['Level', 'Means', 'Response'],
      [
        ['**P1 / page**', 'Users are affected now', 'Wake someone. Minutes'],
        ['**P2 / ticket**', 'Degraded, or will be soon', 'Next working hours'],
        ['**P3 / log**', 'Worth knowing', 'A dashboard, reviewed weekly'],
      ],
    ),
    p(
      'Three levels is enough. **Five levels means the middle three are all treated as "probably ignore"**, and the distinction stops carrying information.',
    ),

    h('Error budgets as policy'),
    diagram(
      `
   SLO 99.9%  ──▶  43.8 minutes of budget per month

   budget
   remaining
     100% ┤████████████░░░░░░░░░░░░
      50% ┤            ▲
       0% ┤            │
          └────────────┴──────────────▶

   BUDGET REMAINING   ship freely, take risks, move fast
   BUDGET EXHAUSTED   feature freeze, reliability work only

   one number, agreed in advance, that ends the recurring
   argument between shipping and stability — because the
   answer is no longer an opinion.
`,
      'A number instead of an argument',
    ),
    tip(
      'The reason this works is that it makes reliability **negotiable in both directions**. A team well under budget is being told it is allowed to take more risk, not just less — which is why it is accepted rather than resented.',
    ),

    h('Runbooks'),
    table(
      ['Every alert links to a runbook with', 'Example'],
      [
        ['What this means in plain words', '"Checkout success is below SLO"'],
        ['Who is affected', '"Users cannot complete purchases"'],
        ['First three things to check', 'Dashboard, recent deploys, dependency status'],
        ['Known causes and their fixes', '"Usually a payment provider — check their status page"'],
        ['How to mitigate **before** diagnosing', '"Roll back the last deploy"'],
        ['Who to escalate to', 'The team and a name'],
      ],
    ),
    warn(
      '**Mitigate first, diagnose second.** Rolling back takes two minutes and root-causing takes an hour; doing them in the wrong order means the hour is spent while users are still affected. The runbook should say this explicitly, because at 3am nobody reasons well.',
    ),

    h('Incident response'),
    flow(['Detect', 'Acknowledge', 'Mitigate', 'Resolve', 'Review'], 'Mitigate before root cause'),
    table(
      ['Role', 'Does'],
      [
        ['**Incident commander**', 'Coordinates. Does not debug'],
        ['**Operations lead**', 'Makes the changes'],
        ['**Communications**', 'Status page and stakeholders'],
        ['**Scribe**', 'Timestamps everything — the postmortem depends on it'],
      ],
    ),
    p(
      'Blameless postmortems are not politeness. **A blameful culture produces people who hide near-misses**, and near-misses are the cheapest information a system ever generates about how it is going to fail.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Deciding what interrupts a human, and what they do then'],
      ['Why it matters', 'Alert fatigue causes outages more reliably than missing alerts'],
      ['Use when', 'Closing a design — "here is what I would page on"'],
      ['Trade-off', 'Fewer alerts risk a slower detection and buy a responder who reads them'],
      [
        '30-second answer',
        '"Alert on symptoms, not causes — error rate, latency, and the business metric — because CPU at 95% while everything is fast is a graph, not an incident. The test for a page is whether a human must act right now; otherwise it is a ticket or a dashboard. Every alert links to a runbook that says mitigate before diagnosing, because a rollback is two minutes and a root cause is an hour. And error budgets turn the ship-versus-stability argument into a number agreed in advance."',
      ],
    ]),
    asked([
      ['What should page someone at 3am?', 'Users cannot do a core action, an SLO is breaching, or data is at risk. Not a CPU threshold.'],
      ['Why alert on symptoms rather than causes?', 'Symptoms catch failures you never anticipated, and imply someone is actually affected.'],
      ['What is alert fatigue?', 'So many non-actionable alerts that the real one gets dismissed with the rest.'],
      ['What does an error budget do?', 'Turns reliability into a number: budget left means ship, budget spent means fix.'],
      ['What comes first in an incident?', 'Mitigation — usually a rollback. Root cause comes after users are served again.'],
    ]),

    links(
      wiki('Site_reliability_engineering', 'Site reliability engineering'),
      wiki('Postmortem_documentation', 'Postmortem'),
    ),
  ],
};
