import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Splitting a system into services buys **independent deployment and independent scaling**, and costs you the network. Every in-process call that becomes a network call can now be slow, fail, or arrive twice — and no amount of tooling makes that free.',
    ),

    h('The trade'),
    tradeoff([
      ['**Monolith**', 'One deploy, real transactions, a stack trace that spans the whole flow, no network between modules, trivially easy to run locally', 'Teams block each other on releases; everything scales together; a memory leak anywhere affects everything'],
      ['**Microservices**', 'Teams deploy independently, hot paths scale alone, failures are isolated, technology choices are per service', 'Network failure, distributed transactions, much harder debugging, and an operational burden that is not optional'],
    ]),

    h('What actually changes'),
    diagram(
      `
   MONOLITH                          MICROSERVICES

   ┌────────────────────┐            ┌─────┐  ┌─────┐  ┌─────┐
   │  orders            │            │order│──│ pay │──│ship │
   │    ↓ function call │            └──┬──┘  └──┬──┘  └──┬──┘
   │  payments          │               │        │        │
   │    ↓               │            ┌──▼──┐  ┌──▼──┐  ┌──▼──┐
   │  shipping          │            │ db  │  │ db  │  │ db  │
   └────────┬───────────┘            └─────┘  └─────┘  └─────┘
            ▼
        ┌───────┐                    a function call became an
        │  db   │                    HTTP request that can:
        └───────┘                      ▸ be slow
                                       ▸ fail
   one transaction spans all three     ▸ succeed but never reply
   a stack trace shows all three       ▸ arrive twice

                                     and the transaction is gone —
                                     it is a saga now.
`,
      'The network is the whole difference',
    ),
    warn(
      'The transaction is the one people underestimate. In a monolith, "reserve stock and charge the card" is **one `BEGIN` and one `COMMIT`**. Split across services it becomes a saga with compensating actions, and that is a substantial amount of code and a permanent source of edge cases.',
    ),

    h('When to split'),
    table(
      ['Good reason', 'Bad reason'],
      [
        ['Teams block each other on releases', '"Microservices are modern"'],
        ['One component needs to scale very differently', '"The monolith is messy" — a split makes mess distributed'],
        ['Genuinely different reliability requirements', '"We might need it later"'],
        ['A component needs a different runtime', '"Each team wants their own language"'],
        ['Regulatory isolation of some data', '"It will be easier to understand"'],
        ['One component destabilises the rest', '"Netflix does it"'],
      ],
    ),
    tip(
      'The honest interview answer for most systems is **"start with a monolith, split when a specific pain appears"** — and saying so is a stronger signal than proposing six services, because it shows you know what the split costs.',
    ),

    h('Where the seams go'),
    p(
      'Split along **business capabilities**, not technical layers. A "database service" and an "API service" are not microservices; they are a monolith with a network in the middle, and every feature still touches both.',
    ),
    diagram(
      `
   WRONG — split by layer            RIGHT — split by capability

   ┌──────────────────┐              ┌────────┐ ┌────────┐ ┌────────┐
   │   API service    │              │ orders │ │payments│ │shipping│
   ├──────────────────┤              │ ─ api  │ │ ─ api  │ │ ─ api  │
   │  logic service   │              │ ─ logic│ │ ─ logic│ │ ─ logic│
   ├──────────────────┤              │ ─ data │ │ ─ data │ │ ─ data │
   │  data service    │              └────────┘ └────────┘ └────────┘
   └──────────────────┘
                                     each owns its data end to end
   every change touches all
   three. you have three             a change to orders touches
   deploys and one feature.          ONE service.
`,
      'Vertical slices, not horizontal ones',
    ),
    table(
      ['Sign the seam is right', 'Sign it is wrong'],
      [
        ['Most changes touch one service', 'Every feature needs three deploys'],
        ['It owns its data exclusively', 'Two services write the same table'],
        ['It can be understood alone', 'You must read three services to follow one flow'],
        ['It has one team', 'Three teams share it'],
        ['The interface is stable', 'The API changes with every feature'],
      ],
    ),
    warn(
      '**Two services sharing a database is not two services.** They are coupled at the tightest possible layer — neither can change its schema without the other — with all the costs of a split and none of the benefits. If the split is real, the data splits with it.',
    ),

    h('The modular monolith'),
    flow(['Modular monolith', 'Extract one service', 'Extract another', 'Stop when it hurts'], 'The path that works'),
    p(
      'Enforce module boundaries **inside** one deployable: separate schemas, no cross-module table access, communication through defined interfaces. You get most of the discipline of services with none of the network — and when a module genuinely needs to be extracted, the boundary already exists.',
    ),
    tip(
      'This is the answer that ages best. **A monolith that is already modular can be split in a week; one that is not takes a year** — and the work of making it modular is the same work either way, minus the distributed systems.',
    ),

    h('What you must build before splitting'),
    table(
      ['Prerequisite', 'Without it'],
      [
        ['**Distributed tracing**', 'A failing request is unexplainable'],
        ['**Centralised logging**', 'Debugging means SSH into five machines'],
        ['**Automated deployment**', 'Ten services means ten manual releases'],
        ['**Service discovery**', 'Hardcoded addresses that go stale'],
        ['**Contract testing**', 'Every deploy risks breaking a caller'],
        ['**Circuit breakers and timeouts**', 'One slow service takes down the rest'],
      ],
    ),
    p(
      'That list is the real cost of microservices, and it is paid up front. **A team that splits before building it has traded a messy codebase for an unobservable distributed system**, which is a considerably worse place to be.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'One deployable versus many independently deployed services'],
      ['Why it matters', 'It is asked in almost every design round, and usually answered by reflex'],
      ['Use when', 'Teams block each other, or one component must scale or fail differently'],
      ['Trade-off', 'Independent deploys and scaling, for network failure and lost transactions'],
      [
        '30-second answer',
        '"Splitting buys independent deployment and scaling, and costs you the network — every function call becomes something that can be slow, fail, or arrive twice, and the transaction becomes a saga. So split for a specific pain: teams blocking each other, or a component needing very different scaling. Split by business capability with its own data, never by layer and never sharing a database. In practice, start with a modular monolith — a modular one splits in a week, a tangled one takes a year."',
      ],
    ]),
    asked([
      ['When should you use microservices?', 'When teams block each other on deploys, or a component genuinely needs different scaling or reliability.'],
      ['Where do the boundaries go?', 'Along business capabilities, each owning its data. Never by technical layer.'],
      ['Can two services share a database?', 'Then they are not two services. They are coupled at the schema and cannot change independently.'],
      ['What is a modular monolith?', 'Enforced module boundaries inside one deployable — the discipline of services without the network.'],
      ['What do you need before splitting?', 'Tracing, centralised logs, automated deploys, service discovery, contract tests and circuit breakers.'],
    ]),

    links(
      wiki('Microservices', 'Microservices'),
      wiki('Monolithic_application', 'Monolithic application'),
    ),
  ],
};
