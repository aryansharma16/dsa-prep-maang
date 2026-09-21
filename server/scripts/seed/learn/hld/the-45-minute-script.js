import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Minute by minute. The script is not there to be clever — it is there so that under pressure you are never deciding *what to do next*, only *what the answer is*. Most rounds are lost by spending twenty minutes on the wrong thing, not by not knowing something.',
    ),

    h('The shape'),
    flow(
      ['Requirements', 'Estimate', 'API', 'Data model', 'Draw it', 'Deep dive', 'Bottlenecks'],
      '45 minutes',
    ),
    diagram(
      `
   0 ─────5────────10──────15────────────────30──────────40───45
   │  REQS  │ SIZE  │ API+  │      HIGH       │  DEEP    │ WRAP
   │        │       │ DATA  │      LEVEL      │  DIVE    │  UP
   │        │       │       │                 │          │
   │ ask    │ maths │ draw  │  boxes, arrows  │ the one  │ what
   │ scope  │ out   │ the   │  and the data   │ hard     │ I'd
   │ + NFRs │ loud  │ nouns │  flow           │ part     │ fix
   └────────┴───────┴───────┴─────────────────┴──────────┴─────

   the two most common failures:
     ▸ starting to draw at minute 1      (no requirements)
     ▸ still drawing at minute 40        (no depth)
`,
      'Where the time goes',
    ),

    h('Minutes 0–5 · Requirements'),
    p(
      'Do not draw anything. Ask, write the answers where the interviewer can see them, and **get the scope cut down** — the biggest favour you can do yourself is turning "design Twitter" into "design the timeline, posting and follow graph; no DMs, no ads, no search".',
    ),
    table(
      ['Ask', 'Why it changes the design'],
      [
        ['Who uses this, and to do what?', 'Decides the read/write ratio, which decides almost everything'],
        ['How many users? Reads vs writes?', 'The difference between one database and a hundred'],
        ['What is in scope? What is explicitly not?', 'You cannot design all of Twitter in 45 minutes and should not try'],
        ['How fresh does data have to be?', 'Strong consistency or eventual — this one question rules out half the designs'],
        ['What latency is acceptable?', '200ms and 2s are different systems'],
        ['Global or one region?', 'Decides whether the hard part is replication'],
      ],
    ),
    tip(
      'Say the requirements back before moving on: *"So: 100M users, read-heavy at about 10:1, timeline can be a few seconds stale, and we are skipping DMs. Shall I size it?"* It takes ten seconds and it stops you designing the wrong system.',
    ),

    h('Minutes 5–10 · Estimate'),
    p(
      'Out loud, with round numbers. The point is not the number — it is that the number **justifies the architecture you are about to draw**. An estimate you never refer to again was a waste of five minutes.',
    ),
    table(
      ['Compute', 'And then say what it implies'],
      [
        ['Peak QPS, reads and writes separately', '"10:1 read-heavy, so this design is about caching"'],
        ['Storage per day, and per year', '"20TB a year, so one machine is out"'],
        ['Bandwidth out', '"That is a CDN, not an origin server"'],
        ['Anything obviously huge', '"Video is the cost here, not the metadata"'],
      ],
    ),

    h('Minutes 10–15 · API and data model'),
    p(
      'Three or four endpoints, and the two or three tables behind them. This is where you name the **nouns** of the system, and everything you draw afterwards is those nouns moving around.',
    ),
    table(
      ['Write down', 'Keep it to'],
      [
        ['The 3–4 endpoints that matter', '`POST /posts`, `GET /timeline`, `POST /follow`'],
        ['The core entities and their keys', 'What is the primary key, and what is it sharded on'],
        ['The one relationship that is hard', 'Usually the many-to-many one'],
      ],
    ),
    tip(
      'State the shard key here, not at minute 35. "Posts are keyed by `post_id`, sharded on `user_id`" is a sentence that pre-answers four later questions.',
    ),

    h('Minutes 15–30 · The high-level design'),
    flow(['Client', 'CDN', 'LB', 'Service', 'Cache', 'DB'], 'Start simple, then add'),
    p(
      'Draw the boxes. Then **walk a request through them out loud** — a read first, then a write — and add components only when the walk hits a problem. That narration is what is being scored.',
    ),
    table(
      ['Do', 'Do not'],
      [
        ['Start with the simplest thing that works', 'Open with Kafka and sharding'],
        ['Add a component and say what forced it', 'Add components because you know their names'],
        ['Trace one read and one write end to end', 'Draw twenty boxes and never follow a request'],
        ['Say what you are *not* doing and why', 'Leave gaps silently and hope'],
      ],
    ),
    warn(
      'If you are still adding boxes at minute 35, you have designed breadth instead of depth and there is no time left to show that you understand any of it. **Stop drawing at 30 whether it is finished or not.**',
    ),

    h('Minutes 30–40 · The deep dive'),
    p(
      'Pick the genuinely hard part — or take the one the interviewer points at — and go three levels down. One component done properly beats eight components named.',
    ),
    table(
      ['If the system is…', 'The hard part is usually…'],
      [
        ['A feed or timeline', 'Fan-out on write vs read, and the celebrity case'],
        ['Chat or real-time', 'Connection routing and delivery guarantees'],
        ['Payments or booking', 'Idempotency, double-spend, and the saga'],
        ['Search', 'The index, and how it stays fresh'],
        ['Video or media', 'Transcoding, storage cost, and the CDN'],
        ['Ride-hailing or delivery', 'Geospatial indexing and the matching loop'],
        ['Anything AI-shaped', 'Retrieval quality, GPU cost, and unbounded latency'],
      ],
    ),

    h('Minutes 40–45 · Wrap up'),
    p(
      'Volunteer the weaknesses before you are asked. It reads as judgement rather than as a gap, and it is the last thing the interviewer hears.',
    ),
    table(
      ['Say', 'Example'],
      [
        ['What breaks first at 10x', '"The fan-out worker. I would partition it by user id."'],
        ['What you traded away', '"Timelines can be 5 seconds stale. That is the whole reason this is cheap."'],
        ['What you would monitor', '"p99 timeline latency and fan-out lag — those two catch most of it."'],
        ['What you skipped and why', '"No multi-region. It doubles the cost and nothing here needs it yet."'],
      ],
    ),

    h('If you get stuck'),
    table(
      ['Stuck on', 'Say this'],
      [
        ['Which of two designs', '"Both work. A is simpler, B scales further. Given our numbers I would take A and note when to revisit."'],
        ['A number you do not know', '"I do not know it exactly — I would assume about X and measure. Does that sound right?"'],
        ['A technology you have not used', '"I have not run it in production. What it gives you here is X, and the alternative is Y."'],
        ['Total blank', 'Go back to the data flow. "Let me trace a write through this again" restarts the machine.'],
      ],
    ),
    tip(
      'The interviewer is a collaborator, not an examiner. **Thinking out loud is the deliverable** — a silent candidate with a perfect diagram scores below a talking candidate with a decent one.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A minute-by-minute plan for a 45-minute design round'],
      ['Why it matters', 'Most rounds are lost on time management, not knowledge'],
      ['Use when', 'Every design interview — the same script every time'],
      ['Trade-off', 'Structure costs a little spontaneity and buys never being lost'],
      [
        '30-second answer',
        '"Five minutes on requirements and scope, five on estimates, five on the API and data model, fifteen drawing the high-level design while tracing one read and one write, ten going deep on the hardest part, five on what breaks at 10x and what I traded away."',
      ],
    ]),
    asked([
      ['What do you do in the first five minutes?', 'Ask questions and cut the scope. Nothing gets drawn.'],
      ['How long on the high-level design?', 'About fifteen minutes, and stop at thirty regardless.'],
      ['What if you do not know something?', 'Say so, state your assumption, and ask. Guessing confidently is the worse failure.'],
      ['What is the most common mistake?', 'Drawing before asking, then having no time to go deep on anything.'],
      ['How do you end?', 'What breaks at 10x, what you traded away, what you would monitor.'],
    ]),

    links(wiki('Systems_design', 'Systems design')),
  ],
};
