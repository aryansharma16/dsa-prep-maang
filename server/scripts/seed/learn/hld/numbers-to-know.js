import { asked, diagram, h, links, note, p, quick, table, tip, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Everything an estimate needs, on one page. None of these are precise and none of them need to be — they are **order-of-magnitude anchors**, and their whole job is to let you say "that is about 50GB a day" out loud without a calculator.',
    ),

    h('Latency, by orders of magnitude'),
    diagram(
      `
   1ns      │ CPU cycle, L1 cache
   10ns     │ L2 cache
   100ns    │ main memory (RAM)
            │
   1µs      │ ─────────── 1,000x slower than RAM ───────────
   10µs     │ compress 1KB
   100µs    │ SSD random read
            │
   1ms      │ ─────────── 1,000x slower again ──────────────
            │ round trip within a data centre (~0.5ms)
   10ms     │ disk seek (spinning), 1MB read from SSD
   100ms    │ round trip across a continent (~50-150ms)
            │
   1s       │ ─────────── human patience starts here ───────
`,
      'Each band is ~1000x the one above',
    ),
    table(
      ['Operation', 'Roughly', 'Remember it as'],
      [
        ['L1 cache reference', '**1 ns**', '—'],
        ['Main memory reference', '**100 ns**', '100x slower than L1'],
        ['Read 1MB sequentially from memory', '**~50 µs**', '—'],
        ['SSD random read', '**~100 µs**', '1,000x slower than RAM'],
        ['Read 1MB sequentially from SSD', '**~1 ms**', '—'],
        ['Round trip within one data centre', '**~0.5 ms**', 'A service call is half a millisecond of network'],
        ['Disk seek (spinning)', '**~10 ms**', '—'],
        ['India → US round trip', '**~150 ms**', 'The reason regions exist'],
        ['India → Europe round trip', '**~110 ms**', '—'],
        ['Within one region', '**~1–5 ms**', '—'],
      ],
    ),
    tip(
      'The one to actually memorise: **memory is 100ns, SSD is 100µs, a cross-continent round trip is 100ms.** Three numbers, each a thousand times the last. Everything else can be reasoned from those.',
    ),

    h('What one machine does'),
    table(
      ['Component', 'Rough ceiling, one node', 'What moves it'],
      [
        ['Web / app server', '**1,000–10,000 req/s**', 'Work per request; 10k assumes it is nearly free'],
        ['Nginx as a proxy', '**~50,000 req/s**', 'It is doing almost nothing per request'],
        ['Redis', '**~100,000 ops/s**', 'Single-threaded per core; pipelining raises it a lot'],
        ['Memcached', '**~1,000,000 ops/s**', 'Multi-threaded, simpler than Redis'],
        ['PostgreSQL / MySQL reads', '**~5,000–15,000 q/s**', 'Whether it is served from the buffer pool'],
        ['PostgreSQL / MySQL writes', '**~1,000–5,000 w/s**', 'Durability settings, index count'],
        ['Kafka broker', '**~100,000+ msg/s**', 'Message size; it is sequential disk writes'],
        ['Elasticsearch queries', '**~1,000 q/s**', 'Query complexity, shard count'],
      ],
    ),
    note(
      'These are the numbers to *estimate* with, not to promise. Real throughput depends entirely on what the request does — an app server doing one indexed lookup and an app server rendering a PDF differ by three orders of magnitude.',
    ),

    h('Sizes'),
    table(
      ['Thing', 'Roughly'],
      [
        ['A UUID', '**16 bytes** binary, 36 as a string'],
        ['A timestamp', '**8 bytes**'],
        ['A typical database row', '**~1 KB**'],
        ['A tweet-sized text post', '**~300 bytes**'],
        ['A JSON API response', '**1–10 KB**'],
        ['A web page with assets', '**~2 MB**'],
        ['A phone photo', '**~3 MB**'],
        ['A minute of 1080p video', '**~50 MB**'],
        ['A minute of audio (128kbps)', '**~1 MB**'],
        ['A 1536-dimension embedding', '**6 KB** at float32, 1.5 KB at int8'],
      ],
    ),

    h('The conversions you actually use'),
    table(
      ['From', 'To', 'Multiply by'],
      [
        ['Requests/second', 'Requests/day', '**~100,000** (86,400)'],
        ['1 million/day', 'Requests/second', '**~12/s**'],
        ['1 billion/day', 'Requests/second', '**~12,000/s**'],
        ['Average QPS', 'Peak QPS', '**2–10x**, use 3x unless told otherwise'],
        ['Bytes/day', 'Bytes/year', '**~365**'],
        ['1 KB × 1M/day', 'Per day', '**~1 GB/day**'],
        ['1 GB/day', 'Per year', '**~365 GB**'],
      ],
    ),
    tip(
      'The single most useful one: **a day is about 100,000 seconds.** So one million events a day is about 12 per second, and a billion is about 12,000. Almost every capacity estimate starts there.',
    ),

    h('Powers of two, for storage'),
    table(
      ['Power', 'Exact-ish', 'Name'],
      [
        ['2¹⁰', '~1 thousand', 'KB'],
        ['2²⁰', '~1 million', 'MB'],
        ['2³⁰', '~1 billion', 'GB'],
        ['2⁴⁰', '~1 trillion', 'TB'],
        ['2⁵⁰', '~1 quadrillion', 'PB'],
      ],
    ),

    h('Availability, in time'),
    table(
      ['Nines', 'Per year', 'Per month', 'Per day'],
      [
        ['**99%**', '3.65 days', '7.2 hours', '14.4 min'],
        ['**99.9%**', '8.77 hours', '43.8 min', '1.44 min'],
        ['**99.95%**', '4.38 hours', '21.9 min', '43 sec'],
        ['**99.99%**', '52.6 min', '4.38 min', '8.6 sec'],
        ['**99.999%**', '5.26 min', '26 sec', '0.86 sec'],
      ],
    ),
    note(
      'Three nines is a comfortable target for most products. Four nines rules out any manual intervention — 4 minutes a month is less than it takes to read a page. Five nines is a number people put in slides.',
    ),

    h('Rough costs, to reason about trade-offs'),
    table(
      ['Resource', 'Order of magnitude'],
      [
        ['Object storage (S3-class)', '**~$0.02 / GB / month**'],
        ['Block storage (SSD)', '**~$0.10 / GB / month** — 5x object storage'],
        ['Egress to the internet', '**~$0.05–0.09 / GB** — usually the surprise on the bill'],
        ['Traffic between regions', 'Charged. Within an AZ, usually not'],
        ['A mid-size VM', '**~$50–100 / month**'],
        ['A GPU (A100-class)', '**~$1–3 / hour** — 30x a CPU box'],
        ['Managed cache / DB', '**2–3x** the raw instance, for not operating it'],
      ],
    ),
    tip(
      'Egress is the line item that surprises people. Serving 100TB a month to users is roughly $5,000 in bandwidth alone — which is the entire financial argument for a CDN.',
    ),

    h('A worked estimate, end to end'),
    diagram(
      `
   "Design Twitter"     100M daily active users

   reads    100M users × 20 timeline views   = 2B reads/day
                                             ÷ 100,000 s
                                             = 20,000 reads/sec
                                             × 3 peak
                                             = 60,000 reads/sec

   writes   100M users × 2 posts             = 200M writes/day
                                             = 2,000 writes/sec
                                             × 3 peak
                                             = 6,000 writes/sec

            read:write is 10:1  ──▶  cache the reads, and it is
                                     a read-optimised design

   storage  200M posts × 300 bytes           = 60 GB/day
                                             × 365
                                             = ~22 TB/year  (text only)
`,
      'Every number came from the tables above',
    ),

    h('Interview'),
    quick([
      ['What it is', 'The order-of-magnitude anchors an estimate is built from'],
      ['Why it matters', 'A design round opens with sizing, and a calculator is not allowed'],
      ['Use when', 'Minutes 5–10: after requirements, before you draw anything'],
      ['Trade-off', 'Precision is neither expected nor useful — being within 10x is the bar'],
      [
        '30-second answer',
        '"A day is 100,000 seconds, so a million a day is about 12 per second. Peak is 3x average. Memory is 100ns, SSD 100µs, cross-continent 100ms. One app server does a few thousand requests a second, one database a few thousand queries. From those I can size almost anything to within an order of magnitude."',
      ],
    ]),
    asked([
      ['How many seconds in a day?', '86,400 — call it 100,000 and the arithmetic gets easy.'],
      ['What peak-to-average ratio should I assume?', '3x unless the traffic shape says otherwise. A live event is 10x or more.'],
      ['How many QPS can one server handle?', 'A few thousand for real work, tens of thousands if it is only proxying.'],
      ['Memory vs SSD vs network?', '100ns, 100µs, 100ms cross-continent. Three orders of magnitude apart each time.'],
      ['Why does 99.99% matter?', 'It is 4 minutes a month — too little for a human to respond, so recovery must be automatic.'],
    ]),

    links(
      wiki('Orders_of_magnitude_(time)', 'Orders of magnitude (time)'),
      wiki('High_availability', 'High availability'),
    ),
  ],
};
