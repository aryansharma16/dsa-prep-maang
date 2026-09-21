import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'The first ten minutes. **Requirements decide what you build; the estimate decides how.** Skip either and the rest of the round is a confident answer to a question nobody asked.',
    ),

    flow(['Scope', 'Functional', 'Non-functional', 'Estimate', 'Implication'], 'Minutes 0–10'),

    h('Functional versus non-functional'),
    table(
      ['', 'Functional', 'Non-functional'],
      [
        ['Asks', 'What does it do?', 'How well must it do it?'],
        ['Examples', 'Post, follow, search, pay', 'Latency, availability, consistency, scale, cost'],
        ['Decides', 'The API and the data model', '**The architecture**'],
        ['If you skip it', 'You build the wrong features', 'You build the wrong system'],
      ],
    ),
    tip(
      'Candidates gather functional requirements well and skip the non-functional ones. It is backwards: whether timelines may be five seconds stale is a **bigger architectural input** than whether users can edit posts.',
    ),

    h('The questions to ask'),
    table(
      ['Question', 'What the answer changes'],
      [
        ['Who uses this and for what?', 'The whole shape'],
        ['**Read-heavy or write-heavy?**', 'Caching and replication strategy — ask this one first'],
        ['How many users? Daily active?', 'Whether this is one box or a thousand'],
        ['How fresh must data be?', 'Strong vs eventual consistency; rules out half the designs'],
        ['What latency is acceptable?', '200ms and 2s are different systems'],
        ['Global or one region?', 'Whether replication is the hard part'],
        ['What is explicitly out of scope?', 'Buys you the time to do the rest properly'],
        ['What must never break?', 'Where to spend the reliability budget'],
      ],
    ),
    warn(
      'Scope-cutting is the highest-value question on that list. "Design Twitter" is a week of work; **"design posting, the timeline and the follow graph — no DMs, ads or search"** is forty-five minutes. Ask for the cut and you will usually get it.',
    ),

    h('Back of the envelope'),
    p('Four numbers, in this order. Round hard — being within an order of magnitude is the entire bar.'),
    diagram(
      `
   1. QPS        DAU × actions per day
                 ─────────────────────   then × 3 for peak
                      100,000 s

   2. STORAGE    writes/day × bytes per write × retention

   3. BANDWIDTH  QPS × bytes per response

   4. MEMORY     what fraction is hot?  (usually the 20% that
                 serves 80% of reads)

   then SAY WHAT IT MEANS:
     "20k reads/s, 2k writes/s — 10:1, so this is a caching problem"
     "60 GB/day, 22 TB/year — one machine is out"
`,
      'The order matters: each feeds the next',
    ),

    h('A worked example'),
    table(
      ['Step', 'Working', 'Result'],
      [
        ['Given', '100M daily users, 20 reads and 2 writes each', '—'],
        ['Reads/day', '100M × 20', '2B'],
        ['Read QPS', '2B ÷ 100,000', '**20,000/s**'],
        ['Peak read QPS', '× 3', '**60,000/s**'],
        ['Write QPS', '(100M × 2) ÷ 100,000', '**2,000/s**'],
        ['Ratio', '20,000 : 2,000', '**10:1 read-heavy**'],
        ['Storage/day', '200M writes × 1 KB', '**200 GB/day**'],
        ['Storage/year', '× 365', '**~73 TB**'],
      ],
    ),
    p(
      'Now the part that matters: **10:1 read-heavy means cache aggressively and add read replicas; 73TB a year means it will not sit on one machine, so pick a shard key now.** Two architectural decisions, both falling straight out of arithmetic.',
    ),

    h('The constants worth memorising'),
    table(
      ['Constant', 'Value', 'Use'],
      [
        ['Seconds in a day', '**~100,000**', 'Every QPS calculation'],
        ['Peak-to-average', '**3x**', 'Unless the traffic shape says otherwise'],
        ['A database row', '~1 KB', 'Storage estimates'],
        ['A photo', '~3 MB', 'Media storage'],
        ['A minute of video', '~50 MB', 'The cost driver in any video system'],
        ['One server', '~1,000–10,000 QPS', 'How many boxes'],
        ['One database', '~5,000 reads/s, ~1,000 writes/s', 'When you need a cache or a shard'],
      ],
    ),

    h('Common mistakes'),
    table(
      ['Mistake', 'Instead'],
      [
        ['Precise arithmetic', 'Round everything. 86,400 is 100,000'],
        ['Estimating and moving on', 'Say the implication out loud — that is the deliverable'],
        ['Forgetting peak', 'Design for peak; average capacity fails daily at 8pm'],
        ['Ignoring the read/write ratio', 'It is the single most useful number you compute'],
        ['Only counting storage', 'Bandwidth and memory are often the real constraints'],
        ['Taking too long', 'Five minutes, out loud, rounded'],
      ],
    ),
    tip(
      'Say the numbers as you go, and round visibly: *"call it 100,000 seconds in a day, so 2 billion reads is about 20,000 a second — times three for peak, 60,000."* Visible rounding signals fluency; a calculator-precise number signals the opposite.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Scoping the problem, then sizing it'],
      ['Why it exists', 'Non-functional requirements decide the architecture; the estimate justifies it'],
      ['Use when', 'The first ten minutes of every design round, without exception'],
      ['Trade-off', 'Time spent here is time not drawing — and it is always worth it'],
      [
        '30-second answer',
        '"First the functional scope, cut down explicitly. Then the non-functional requirements, because those decide the architecture — read/write ratio, freshness, latency, availability, geography. Then four numbers: QPS with a 3x peak, storage per day and per year, bandwidth, and what fraction is hot. And crucially, say what each number implies — 10:1 read-heavy means caching; 70TB a year means sharding."',
      ],
    ]),
    asked([
      ['What do you ask first?', 'Read-heavy or write-heavy. It shapes more of the design than any other single answer.'],
      ['How do you estimate QPS?', 'Daily actions divided by ~100,000 seconds, times 3 for peak.'],
      ['Why does the read/write ratio matter?', 'It decides whether the answer is caching and replicas, or sharding and queues.'],
      ['How precise should estimates be?', 'Order of magnitude. Round aggressively and say so.'],
      ['What if you are not given numbers?', 'State your assumptions out loud and proceed. "Assume 10M daily users" is a fine opening.'],
    ]),

    links(
      wiki('Back-of-the-envelope_calculation', 'Back-of-the-envelope calculation'),
      wiki('Non-functional_requirement', 'Non-functional requirement'),
    ),
  ],
};
