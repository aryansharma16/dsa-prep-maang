import { asked, diagram, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Most outages are deploys. So the question is never "will this release be fine" — it is **"how few users see it if it is not, and how fast can we undo it?"**',
    ),

    h('Release strategies'),
    diagram(
      `
   ROLLING                    BLUE-GREEN               CANARY

   v1 v1 v1 v1                BLUE  (v1) ◀─ traffic    v1 v1 v1 v1
   v2 v1 v1 v1                GREEN (v2)               v2 v1 v1 v1
   v2 v2 v1 v1                    │                      ▲ 1% of
   v2 v2 v2 v1                    ▼ switch                 traffic
   v2 v2 v2 v2                BLUE  (v1)                    │
                              GREEN (v2) ◀─ traffic    watch metrics
   ✓ no extra capacity                                      │
   ✗ both versions live       ✓ instant rollback        5% ─▶ 25% ─▶ 100%
     at once                  ✗ 2x capacity
   ✗ slow to roll back        ✗ both share the DB      ✓ tiny blast radius
                                                       ✗ slowest
                                                       ✗ needs good metrics
`,
      'Three ways to replace v1 with v2',
    ),
    table(
      ['', 'Rolling', 'Blue-green', 'Canary'],
      [
        ['Extra capacity', 'None', '**2x**', 'Minimal'],
        ['Rollback speed', 'Another rolling deploy', '**Instant**', 'Instant'],
        ['Blast radius if broken', 'Grows as it proceeds', '**Everyone, at once**', '**1% of users**'],
        ['Both versions live', 'Yes, briefly', 'Yes, during the switch', 'Yes, for a while'],
        ['Needs', 'Nothing special', 'Double capacity', 'Per-version metrics'],
        ['Default for', 'Most services', 'Big-bang cutovers', '**High-risk changes**'],
      ],
    ),
    tip(
      'Canary plus automatic rollback on an error-rate regression is the strongest answer. **The rollback should not wait for a human** — four minutes a month of error budget is less time than it takes someone to read an alert.',
    ),

    h('Both versions run at once — always'),
    warn(
      'Every strategy above has v1 and v2 live simultaneously, so **every change must be backward compatible with the version it is replacing.** This is the constraint people forget, and it is why a deploy and a schema change must never ship together.',
    ),
    table(
      ['Change', 'Do it as'],
      [
        ['Add a column', 'Nullable, deploy code that tolerates both, backfill, then require it'],
        ['Remove a column', 'Stop reading, deploy, wait, **then** drop'],
        ['Rename a field', 'Add the new one, dual write, migrate readers, remove the old'],
        ['Change an API response', 'Add fields; never remove or repurpose one'],
        ['Change a queue message', 'Version it; consumers handle both for one release'],
      ],
    ),
    p(
      'The rule underneath all five: **expand, then contract.** Add the new thing, move everything onto it, and only then remove the old one — with a deploy boundary between each step so any of them can be rolled back.',
    ),

    h('Feature flags'),
    tradeoff([
      ['**Feature flags**', 'Deploy and release become separate events; roll back a feature without a deploy; test on 1% of real users', 'Every flag is a branch in production; stale flags accumulate into unreadable code paths'],
    ]),
    tip(
      'Flags decouple **deploy** from **release**, which is the real win: code ships dark, is switched on for staff, then 1%, then everyone — and switching it off is a config change, not a rollback. Give every flag an owner and a removal date, or they never leave.',
    ),

    h('Autoscaling'),
    table(
      ['Scale on', 'Good', 'Bad'],
      [
        ['**CPU**', 'The default; easy', 'Meaningless for I/O-bound services'],
        ['**Request rate**', 'Direct and predictable', 'Ignores requests of varying cost'],
        ['**Queue depth**', '**The right metric for workers**', 'Needs a queue'],
        ['**Concurrency / in-flight**', 'Tracks real saturation well', 'Needs instrumentation'],
        ['**p99 latency**', 'Closest to user experience', 'Lagging — you scale after it hurts'],
        ['**Schedule**', '**Best for predictable peaks**', 'Useless for surprises'],
      ],
    ),
    diagram(
      `
   WHY AUTOSCALING MISSES A SPIKE

   traffic  ──┐
              │ spike arrives in 10s
              ▼
   t=0   ████████████████  load jumps
   t=30  metric window closes, scaling decision made
   t=60  instance provisioned
   t=90  container pulled and started
   t=120 warm — caches, JIT, connection pools
         │
         └──▶ two minutes of being overloaded

   ──▶ pre-scale for known events
   ──▶ keep warm headroom for unknown ones
   ──▶ shed load to survive the gap
`,
      'The warm-up gap',
    ),
    table(
      ['Setting', 'Guidance'],
      [
        ['**Scale up fast, down slowly**', 'Being over-provisioned is cheap; being under is an outage'],
        ['**Cooldown**', 'Long enough to avoid flapping between scale events'],
        ['**Minimum instances**', 'Never so low that the next spike starts from cold'],
        ['**Maximum**', 'A cost guardrail — and a limit on how far a bug can scale'],
        ['**Warm-up grace**', 'Do not route to an instance until it is genuinely ready'],
      ],
    ),
    warn(
      'Autoscaling can **amplify** a failure. A slow dependency raises latency, latency triggers scale-up, more instances open more connections to the struggling dependency, and it gets slower. Scale on a metric that reflects your own saturation, not on someone else\'s.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Replacing a running version safely, and matching capacity to load'],
      ['Why it matters', 'Deploys cause most outages; scaling decides whether spikes do'],
      ['Use when', 'Every release, and any variable traffic'],
      ['Trade-off', 'Canary is slow and safe; blue-green is instant and doubles cost'],
      [
        '30-second answer',
        '"Canary for anything risky — 1% of traffic, watch error rate and latency per version, and roll back automatically rather than waiting for a human. Blue-green gives instant rollback at double the capacity. All of them run both versions at once, so every change must be backward compatible: expand then contract, with a deploy boundary between steps. Autoscale on queue depth for workers, and pre-scale for known peaks — the warm-up gap is a couple of minutes."',
      ],
    ]),
    asked([
      ['Blue-green or canary?', 'Canary for risky changes — the blast radius is 1% of users. Blue-green when you need an instant full cutover.'],
      ['Why must changes be backward compatible?', 'Both versions serve traffic simultaneously during every deploy strategy.'],
      ['How do you change a schema safely?', 'Expand then contract: add, dual write, backfill, switch reads, then drop — each with its own deploy.'],
      ['What should you autoscale on?', 'Queue depth for workers, request rate or concurrency for services. CPU only when it reflects saturation.'],
      ['Why is autoscaling not a spike answer?', 'It takes one to two minutes to provision and warm an instance. Pre-scale or shed load.'],
    ]),

    links(
      wiki('Canary_release', 'Canary release'),
      wiki('Blue%E2%80%93green_deployment', 'Blue-green deployment'),
    ),
  ],
};
