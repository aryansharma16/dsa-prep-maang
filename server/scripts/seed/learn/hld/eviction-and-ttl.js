import { asked, diagram, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A cache is a fixed amount of memory holding an unbounded amount of data, so something has to go. **Eviction decides what leaves when memory is full; TTL decides what leaves because it got old.** They are different mechanisms answering different questions, and confusing them produces both wrong data and wasted memory.',
    ),

    h('Eviction versus expiry'),
    table(
      ['', 'Eviction', 'Expiry (TTL)'],
      [
        ['Triggered by', 'Memory pressure', 'Time'],
        ['Answers', '"What do I have room for?"', '"How stale is too stale?"'],
        ['Is a', '**Capacity** decision', '**Correctness** decision'],
        ['If absent', 'Out-of-memory, or writes rejected', 'Stale data forever if invalidation has a bug'],
      ],
    ),
    warn(
      'A TTL is **not a memory-management tool**. Setting a short TTL to control memory means you also get a low hit rate and a lot of misses; setting a long TTL to raise the hit rate means you also accept long staleness. Size the cache with eviction, and choose the TTL from how stale the data may be.',
    ),

    h('The eviction policies'),
    diagram(
      `
   access order:  A B C A D B  (capacity = 3)

   LRU — evict least RECENTLY used
     A B C ──▶ A B C   (A again, moves to front)
     + D  ──▶ evicts C (oldest touch)  ──▶ A B D
     + B  ──▶ hit                      ──▶ A B D

   LFU — evict least FREQUENTLY used
     counts: A=2 B=2 C=1
     + D  ──▶ evicts C (lowest count)  ──▶ A B D
     ✓ resists a one-off scan flushing everything
     ✗ an old popular item never leaves

   FIFO — evict the oldest inserted, regardless of use
     ✓ trivial   ✗ evicts your hottest key if it was inserted first

   RANDOM — pick one
     ✓ no bookkeeping, no lock contention
     ✗ sometimes evicts the hot key
`,
      'Four policies, one access pattern',
    ),
    table(
      ['Policy', 'Good at', 'Bad at', 'Cost'],
      [
        ['**LRU**', 'Temporal locality — recent means likely again', 'A large scan evicts everything useful', 'A linked list + map'],
        ['**LFU**', 'Stable popularity; scan-resistant', 'Yesterday\'s hit stays forever without ageing', 'Counters, plus a decay mechanism'],
        ['**FIFO**', 'Nothing much', 'Ignores usage entirely', 'Almost none'],
        ['**Random**', 'Huge caches, avoiding lock contention', 'Occasionally evicts the hot key', 'None'],
        ['**TinyLFU / ARC**', 'Adapting between recency and frequency', 'Complexity', 'A sketch, or two lists'],
      ],
    ),
    tip(
      '**Approximate LRU is what you actually get.** Redis samples a handful of keys and evicts the oldest of those, because maintaining a true LRU ordering across millions of keys costs more than the imperfection saves. Knowing that it is sampled, not exact, is a good answer.',
    ),

    h('The scan problem'),
    diagram(
      `
   a batch job reads 10M rows once

   LRU                               LFU
   every read is "recent"            every read has count 1
        │                                 │
        ▼                                 ▼
   the entire working set is         the scanned keys never
   pushed out by data nobody         beat the real hot keys
   will ever read again                   │
        │                                 ▼
        ▼                            cache survives
   hit rate collapses to ~0
   and stays there for hours

   this is why LFU exists, and why batch jobs should use
   a SEPARATE cache — or none at all.
`,
      'One batch job, one flushed cache',
    ),

    h('Choosing a TTL'),
    table(
      ['Data', 'TTL', 'Why'],
      [
        ['Static config, feature flags', 'Minutes, plus explicit invalidation', 'Rarely changes, must not be very stale'],
        ['User profile', '5–15 min', 'Changes rarely; a brief stale read is harmless'],
        ['Product listing', '1–5 min', 'Prices change and staleness is visible'],
        ['Search results', '30–60 s', 'Expensive to compute, tolerable to be slightly old'],
        ['Session', 'Session length', 'Correctness, not caching'],
        ['Computed aggregate', 'Minutes to hours', 'Expensive, and approximate anyway'],
        ['Stock, balance', '**Do not cache**', 'Exactness is the requirement'],
      ],
    ),
    tip(
      '**Jitter every TTL.** Setting 300 seconds on ten thousand keys populated by the same deploy means ten thousand simultaneous expiries. `300 + random(0..60)` costs nothing and prevents a self-inflicted stampede.',
    ),

    h('Sizing'),
    diagram(
      `
   hit rate
      │                          ╭──────────────  diminishing
   95%┤                     ╭────╯
      │                 ╭───╯
   80%┤            ╭────╯
      │        ╭───╯
   50%┤    ╭───╯     ◀── the working set fits around here
      │  ╭─╯
      └──┴──────────────────────────────────▶ memory

   the curve has a knee. find it by measurement, then buy
   a little past it — capacity beyond the working set buys
   almost nothing.
`,
      'Hit rate against memory',
    ),
    table(
      ['Metric', 'Watch for'],
      [
        ['**Hit rate**', 'Below ~80%, the cache may not be earning its keep'],
        ['**Eviction rate**', 'High evictions with a low hit rate means it is too small'],
        ['**Memory used vs max**', 'Consistently at max means you are evicting live data'],
        ['**Key count and average size**', 'A few huge values can crowd out thousands of useful ones'],
        ['**Expired vs evicted**', 'Mostly expired is healthy; mostly evicted means under-provisioned'],
      ],
    ),
    p(
      'That last row is the most useful diagnostic. **Expired means the TTL decided; evicted means memory decided.** If almost everything is being evicted before its TTL, the cache is too small and every tuning decision you make about TTLs is being overridden.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Eviction frees memory; TTL bounds staleness'],
      ['Why it matters', 'They are different decisions and get conflated'],
      ['Use when', 'Sizing a cache, or explaining why the hit rate collapsed'],
      ['Trade-off', 'Long TTL gives hit rate and staleness; short gives freshness and misses'],
      [
        '30-second answer',
        '"Eviction is a capacity decision, TTL is a correctness one. LRU suits temporal locality but a batch scan flushes it entirely, which is why LFU exists — though it needs ageing or yesterday\'s hit never leaves. Real caches use approximate LRU by sampling, because exact ordering costs more than it saves. TTLs come from how stale the data may be, always with jitter so thousands of keys do not expire together. And watch evicted versus expired: mostly evicted means the cache is too small."',
      ],
    ]),
    asked([
      ['LRU or LFU?', 'LRU by default. LFU when a batch scan would otherwise flush your working set.'],
      ['Why is Redis LRU approximate?', 'It samples a few keys and evicts the oldest. Exact LRU across millions of keys costs more than it saves.'],
      ['How do you choose a TTL?', 'From how stale the data may be, not from memory pressure. Eviction handles memory.'],
      ['Why jitter TTLs?', 'Otherwise keys populated together expire together and stampede the origin.'],
      ['How do you know a cache is too small?', 'Evictions outnumber expiries, and the hit rate is low while memory sits at max.'],
    ]),

    links(
      wiki('Cache_replacement_policies', 'Cache replacement policies'),
      wiki('Least_frequently_used', 'Least frequently used'),
    ),
  ],
};
