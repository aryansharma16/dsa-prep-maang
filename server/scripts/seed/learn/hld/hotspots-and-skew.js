import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'You sharded, and one shard is at 95% CPU while the rest are idle. **Even distribution of keys is not even distribution of traffic**, and the gap between those two is where every sharded system eventually hurts.',
    ),

    diagram(
      `
   WHAT YOU DESIGNED            WHAT YOU GOT

   s1 ████████ 25%             s1 ████████████████████████ 78%
   s2 ████████ 25%             s2 ███ 8%
   s3 ████████ 25%             s3 ██ 6%
   s4 ████████ 25%             s4 ███ 8%

   capacity is now bounded by ONE shard.
   the other three are paid for and idle.
`,
      'The shape of the problem',
    ),

    h('Four causes'),
    table(
      ['Cause', 'Example', 'Tell'],
      [
        ['**Celebrity key**', 'One account with 100M followers', 'One key, enormous read volume'],
        ['**Sequential key**', 'Sharding by auto-increment id or timestamp', 'The newest shard takes every write'],
        ['**Low cardinality**', 'Sharding by `country` or `status`', 'A handful of shards hold everything'],
        ['**Natural skew**', 'Mumbai has more users than most countries', 'Geographic sharding, uneven populations'],
      ],
    ),
    warn(
      'Sequential keys are the most common self-inflicted version. `shard = id % N` looks like hash sharding and is not — **consecutive ids spread evenly, but a timestamp prefix or a monotonically increasing key concentrates every new write** on whichever shard owns the top of the range.',
    ),

    h('The celebrity problem'),
    p(
      'One entity gets orders of magnitude more traffic than any other, and it lives on one shard. No hashing scheme helps, because **the problem is one key, not the distribution of keys.**',
    ),
    diagram(
      `
   normal user       celebrity
   1k followers      100M followers

   read  ▏           read  ████████████████████████
   write ▏           write ▏

   the KEY is one point. the TRAFFIC to it is not.

   FIXES

   1. REPLICATE the key          2. SPECIAL-CASE it
      cache it on every node        detect hot keys at runtime
      ──▶ reads scale                and route them differently
      ──▶ writes still to one        ──▶ dedicated capacity

   3. DO NOT FAN OUT             4. SPLIT the key
      handle celebrities by         celeb:1 .. celeb:10
      pull, not push                ──▶ writes spread, reads
      (see the Twitter design)          must merge 10 buckets
`,
      'Four answers, and the third is usually the best',
    ),

    h('Splitting a hot key'),
    table(
      ['Technique', 'How', 'Cost'],
      [
        ['**Suffix / salt**', '`counter:video42:0..9`, pick one at random per write', 'A read must sum all 10 buckets'],
        ['**Local aggregation**', 'Buffer in the app, flush a total every second', 'The value is a second stale'],
        ['**Replicate reads**', 'Copy the key to every cache node', 'Memory × nodes; invalidation is fan-out'],
        ['**Dedicated shard**', 'Give the hot tenant its own hardware', 'Operational work; the standard SaaS answer'],
      ],
    ),
    tip(
      'The suffix trick is the standard answer for a **hot counter** — a viral video\'s view count, a flash-sale stock counter. Ten buckets give ten times the write throughput, and reading ten keys instead of one is a rounding error compared to the contention you removed.',
    ),

    h('Fixing a bad shard key'),
    table(
      ['Bad key', 'Why', 'Better'],
      [
        ['`created_at`', 'All new writes hit one shard', 'Hash of `user_id`'],
        ['`auto_increment id` by range', 'Same problem', 'Hash of the id, or Snowflake ids'],
        ['`country`', 'Cardinality too low; one value dominates', 'Hash of `user_id`; keep country as a column'],
        ['`status`', '95% share one value', 'Almost anything else'],
        ['`tenant_id` (SaaS)', 'One tenant is 40% of your data', 'Composite key, or isolate large tenants'],
      ],
    ),
    p(
      'The last row is worth its own note: **`tenant_id` is the natural shard key for a B2B product and it is almost always skewed**, because customer sizes follow a power law. The usual answer is a composite key for small tenants and dedicated shards for the largest handful.',
    ),

    h('Detecting it'),
    flow(['Per-shard metrics', 'Top-K key sampling', 'Alert', 'Rebalance or split'], 'You cannot fix what you cannot see'),
    table(
      ['Signal', 'What to watch'],
      [
        ['Per-shard CPU, QPS, latency', 'The basic one — and it must be **per shard**, not averaged'],
        ['Max/median shard ratio', 'Above ~2x, you have skew worth investigating'],
        ['Top-K key sampling', 'Count-min sketch or sampled logs to find the actual hot keys'],
        ['Per-shard error rate', 'A hot shard starts timing out before it saturates'],
      ],
    ),
    warn(
      'Averaged metrics **hide this entirely**. A fleet at 30% average CPU with one shard at 95% looks healthy on every dashboard until that shard starts returning errors. Per-shard breakdowns are not optional in a sharded system.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'One shard or key receiving disproportionate traffic'],
      ['Why it happens', 'Real-world data follows power laws; even key distribution is not even load'],
      ['Use when', 'Any sharded design — expect to be asked about the celebrity case'],
      ['Trade-off', 'Splitting a hot key buys write throughput and costs read complexity'],
      [
        '30-second answer',
        '"Hashing distributes keys evenly, not traffic. Four causes: a celebrity key, a sequential shard key that sends every new write to one shard, low cardinality, and natural geographic skew. For a hot counter, salt the key into ten buckets and sum on read. For a celebrity in a feed, stop fanning out and merge at read time. For a large tenant, give them their own shard. And monitor per shard — averaged metrics hide it completely."',
      ],
    ]),
    asked([
      ['What is the celebrity problem?', 'One key gets orders of magnitude more traffic than any other. Hashing cannot help, because it is one key.'],
      ['How do you fix a hot counter?', 'Salt it into N buckets, write to a random one, sum all N on read.'],
      ['Why are sequential IDs a bad shard key?', 'Under range sharding every new write lands on the newest shard.'],
      ['How do you detect skew?', 'Per-shard metrics and top-K key sampling. Averages hide it.'],
      ['What about a huge tenant in a SaaS?', 'A composite key for small tenants, and dedicated shards for the largest few.'],
    ]),

    links(
      wiki('Power_law', 'Power law'),
      wiki('Count%E2%80%93min_sketch', 'Count–min sketch'),
    ),
  ],
};
