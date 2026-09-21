import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'High-level design is deciding **what the boxes are and what flows between them**. Not the classes, not the function signatures — the components, the data that moves, where it is stored, and what happens when one of the boxes stops answering.',
    ),

    flow(['Client', 'Edge', 'Service', 'Data store'], 'The smallest honest diagram'),

    h('HLD versus LLD'),
    table(
      ['', 'High-level design', 'Low-level design'],
      [
        ['Unit of thought', 'Services, stores, queues', 'Classes, methods, interfaces'],
        ['Question', '**Where does the data live and how does it move?**', '**How is this one component built?**'],
        ['Output', 'A box-and-arrow diagram with trade-offs', 'Class diagrams, patterns, method signatures'],
        ['Typical prompt', '"Design Twitter"', '"Design a parking lot" / "Design an LRU cache"'],
        ['Scale is', 'The whole point', 'Usually assumed away'],
        ['Failure is', 'A first-class concern', 'Mostly exception handling'],
        ['Round length', '45–60 minutes', '45–60 minutes, but you write code'],
      ],
    ),
    tip(
      'They are separate rounds and separate skills. If an HLD interview drifts into class design you have misread it, and vice versa. The tell is the prompt: **a named product is HLD; a named object is LLD.**',
    ),

    h('What is actually being scored'),
    p(
      'Not whether you produce the "right" architecture — there is no answer key. The interviewer is watching a much narrower thing: **can you make reasoned decisions under incomplete information, and can you say why?**',
    ),
    table(
      ['Signal', 'What it looks like', 'What it looks like when absent'],
      [
        ['**Requirements first**', 'Asks before drawing; cuts scope explicitly', 'Draws a diagram in minute one'],
        ['**Justified components**', '"A queue here, because the spike would reach the DB"', '"And then Kafka" with no reason given'],
        ['**Trade-off awareness**', 'States the cost of every choice unprompted', 'Only lists benefits'],
        ['**Numbers**', 'Sizes it, and uses the number to decide', 'Estimates, then ignores the result'],
        ['**Failure thinking**', '"If this dies, that degrades to…"', 'Assumes everything stays up'],
        ['**Depth on demand**', 'Goes three levels into one component', 'Stays at box level everywhere'],
        ['**Communication**', 'Narrates continuously; invites pushback', 'Silence, then a finished diagram'],
      ],
    ),
    warn(
      'The most common failure is not a knowledge gap. It is **designing before understanding** — twenty minutes of confident architecture for a system the interviewer never asked for.',
    ),

    h('The building blocks'),
    p('Almost every design in this track is assembled from these. There are not many, and each one exists to solve one problem.'),
    diagram(
      `
   EDGE            COMPUTE          STATE            GLUE
   ─────────       ─────────        ─────────        ─────────
   DNS             app servers      SQL database     queue / log
   CDN             workers          NoSQL store      pub/sub
   load balancer   serverless       cache            event bus
   API gateway                      object storage
   reverse proxy                    search index
                                    data warehouse

   plus, running across all of them:

   OBSERVE         PROTECT          SURVIVE
   ─────────       ─────────        ─────────
   logs            auth             replication
   metrics         rate limiting    failover
   traces          encryption       multi-region
`,
      'Roughly twenty boxes, and that is the whole vocabulary',
    ),

    h('What every answer has to contain'),
    table(
      ['Element', 'Why it is non-negotiable'],
      [
        ['**Requirements**', 'Otherwise you are designing something nobody asked for'],
        ['**A rough size**', 'One server and a thousand servers are different designs'],
        ['**A data model**', 'The shape of the data decides the shape of the system'],
        ['**A diagram**', 'A design you cannot draw is a design you have not made'],
        ['**The data flow**', 'Trace one read and one write out loud; this is where gaps surface'],
        ['**Trade-offs**', 'The actual content of the interview'],
        ['**Failure modes**', '"What if that dies?" is asked in every round'],
      ],
    ),

    h('Two ways to be wrong'),
    tradeoff([
      ['**Under-engineering**', 'Simple, cheap, fast to build', 'Falls over at the scale you were told to design for'],
      ['**Over-engineering**', 'Impresses nobody', 'Distributed transactions and operational cost you did not need'],
    ]),
    p(
      'Over-engineering is the more common mistake in interviews and the more damaging one, because it signals that you reach for complexity by reflex. **Start with the simplest thing that meets the stated requirements**, then add under pressure — and say that is what you are doing.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Designing the components of a system and the data flowing between them'],
      ['Why it exists', 'Architecture decisions are expensive to reverse; interviews test whether you make them deliberately'],
      ['Use when', 'Any "design X" prompt naming a product rather than an object'],
      ['Trade-off', 'There is no right answer — only choices with stated costs'],
      [
        '30-second answer',
        '"HLD is about components and data flow: what the boxes are, what moves between them, where state lives, and what happens when one fails. LLD is inside one box — classes and interfaces. The round is scored on reasoning, not on a correct diagram: ask requirements first, size it, justify every component by the problem it solves, state the cost of each choice, and go deep on the hardest part."',
      ],
    ]),
    asked([
      ['What is the difference between HLD and LLD?', 'HLD is components and data flow between them. LLD is the internals of one component.'],
      ['What is the interviewer looking for?', 'Reasoning under incomplete information, and trade-offs stated without being asked.'],
      ['Is there a right answer?', 'No. There are defensible answers with the costs acknowledged.'],
      ['Where do you start?', 'Requirements and scope. Never with a diagram.'],
      ['Simple or sophisticated?', 'Simplest design that meets the stated requirements, then add under pressure and say why.'],
    ]),

    links(wiki('Systems_design', 'Systems design'), wiki('Software_architecture', 'Software architecture')),
  ],
};
