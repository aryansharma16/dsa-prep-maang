import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Availability is **the fraction of time a system answers correctly**. It is written in nines, it multiplies in unhelpful ways through a chain of dependencies, and it is the number that decides how much of your reliability budget goes where.',
    ),

    h('Nines, in time'),
    table(
      ['Nines', 'Per year', 'Per month', 'What it rules out'],
      [
        ['**99%**', '3.65 days', '7.2 hours', 'Nothing. This is a hobby project'],
        ['**99.9%**', '8.8 hours', '**43.8 min**', 'Long manual recoveries'],
        ['**99.95%**', '4.4 hours', '21.9 min', 'Most manual intervention'],
        ['**99.99%**', '52.6 min', '**4.4 min**', '**All** human response — recovery must be automatic'],
        ['**99.999%**', '5.3 min', '26 sec', 'Almost everything. Rarely a real target'],
      ],
    ),
    tip(
      'Three nines is a sensible target for most products and is achievable with good practice. **Four nines is an architectural decision, not an operational one** — four minutes a month is less than it takes a human to read a page, so everything must fail over on its own.',
    ),

    h('Availability multiplies'),
    diagram(
      `
   IN SERIES — every component must work

   client ──▶ LB ──▶ app ──▶ cache ──▶ DB
             99.9   99.9    99.9     99.9

   0.999 ^ 4 = 0.996  ──▶  99.6%   (~3 hours/month)

   four "three nines" components make a TWO nines system.


   IN PARALLEL — any one is enough

              ┌── replica A  99.9 ──┐
   client ──▶ ┤                     ├──▶
              └── replica B  99.9 ──┘

   1 - (0.001 × 0.001) = 0.999999  ──▶  99.9999%

   redundancy is the only thing that adds nines.
`,
      'Series multiplies down, parallel multiplies up',
    ),
    warn(
      'This is the result people find surprising: **adding a component always lowers availability unless it is redundant.** A cache in front of your database makes the system less available than the database alone, unless a cache failure is survivable.',
    ),
    table(
      ['Design', 'Effect on availability'],
      [
        ['Add a required dependency', 'Multiplies down — strictly worse'],
        ['Add a redundant replica', 'Multiplies up — substantially better'],
        ['Make a dependency **optional**', 'Removes it from the series chain entirely'],
        ['Add a circuit breaker', 'Converts a slow failure into a fast, survivable one'],
      ],
    ),
    p(
      'The third row is the cheapest reliability win available. **A cache that is optional does not reduce availability** — if it is down you go to the database and get slower. A cache your code cannot proceed without is a new single point of failure you installed on purpose.',
    ),

    h('SLA, SLO, SLI'),
    flow(['SLI (measured)', 'SLO (target)', 'SLA (promised)'], 'Inward to outward'),
    table(
      ['Term', 'Is', 'Example', 'Who it is for'],
      [
        ['**SLI**', 'An **indicator** you measure', 'p99 latency; success rate', 'Engineering'],
        ['**SLO**', 'An internal **objective**', '99.95% of requests succeed, monthly', 'Your team'],
        ['**SLA**', 'A contractual **agreement**, with penalties', '99.9% or we refund 10%', 'Customers and lawyers'],
      ],
    ),
    tip(
      'Set the **SLO stricter than the SLA**. The gap is your margin: you start responding when you breach the internal target, well before you owe anyone money. An SLO equal to the SLA means the first sign of trouble is a refund.',
    ),

    h('Error budgets'),
    p(
      'If the SLO is 99.9%, you may be unavailable for **43 minutes a month**. That is not a failure allowance — it is a budget, and it is what makes shipping and reliability negotiable against each other instead of an argument.',
    ),
    diagram(
      `
   monthly error budget at 99.9% = 43.8 minutes

   budget
   remaining
     100% ┤████████████████░░░░░░░░░░░
      50% ┤                ▲
       0% ┤                │
          └────────────────┴──────────────▶ time

   budget left     ──▶ ship freely, take risks
   budget spent    ──▶ freeze features, fix reliability

   one number that ends the "ship vs stability" argument.
`,
      'The budget as a policy',
    ),

    h('Where the nines actually come from'),
    table(
      ['Technique', 'Buys'],
      [
        ['**Redundancy at every tier**', 'The only thing that genuinely adds nines'],
        ['**Automatic failover**', 'Turns hours of downtime into seconds'],
        ['**Optional dependencies**', 'Shortens the series chain for free'],
        ['**Graceful degradation**', 'Partial service instead of an outage'],
        ['**Fast rollback**', 'Most outages are deploys; undo beats debug'],
        ['**Multi-AZ, then multi-region**', 'Survives a data centre, then a region'],
        ['**Load shedding**', 'Serving 90% of traffic beats serving none'],
      ],
    ),
    warn(
      'Most downtime is **self-inflicted** — a deploy, a config change, a migration. Redundancy does not protect you from shipping a bug to every replica at once, which is why canary deploys and fast rollback buy more availability in practice than another replica does.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'The fraction of time a system correctly serves requests'],
      ['Why it matters', 'It decides where reliability effort and money go'],
      ['Use when', 'Stating targets, and whenever asked "what if this dies?"'],
      ['Trade-off', 'Each extra nine costs roughly an order of magnitude more'],
      [
        '30-second answer',
        '"Availability is measured in nines — three nines is 43 minutes a month, four is 4 minutes, which rules out human response entirely. Components in series multiply down, so every required dependency makes the system worse; redundancy in parallel multiplies up. The cheapest win is making dependencies optional. SLI is what you measure, SLO is your internal target, SLA is the contractual promise — and the gap between SLO and SLA is your error budget."',
      ],
    ]),
    asked([
      ['How much downtime is 99.9%?', 'About 43 minutes a month, or 8.8 hours a year.'],
      ['SLA vs SLO vs SLI?', 'Indicator you measure, objective you target internally, agreement you promise externally.'],
      ['Why does adding a component reduce availability?', 'Components in series multiply. Four 99.9% dependencies give 99.6%.'],
      ['How do you get more nines?', 'Redundancy and automatic failover. Making dependencies optional is the cheap version.'],
      ['What is an error budget?', 'The downtime your SLO permits, used as a policy: budget left means ship, budget spent means fix.'],
    ]),

    links(
      wiki('High_availability', 'High availability'),
      wiki('Service-level_objective', 'Service-level objective'),
    ),
  ],
};
