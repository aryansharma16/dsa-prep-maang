import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'DNS turns a name into an address. In a system design it is also **the first routing decision you get to make** — before a packet reaches any of your infrastructure, DNS has already chosen which region, which data centre, and sometimes which provider will serve the user.',
    ),

    flow(['Browser cache', 'OS cache', 'Resolver', 'Root → TLD → authoritative', 'IP'], 'Resolution, once'),

    h('Where it sits'),
    diagram(
      `
   user types app.example.com
        │
        ▼ cached? at four levels, so usually yes
   ┌──────────────┐
   │   resolver   │
   └──────┬───────┘
          │ miss
          ▼
   root ──▶ .com ──▶ authoritative (yours)
                         │
                         │ and here is the interesting part:
                         │ the answer can DEPEND on the asker
                         ▼
            ┌──────────────────────────┐
            │ where are they?  ──▶ eu  │
            │ is eu healthy?   ──▶ yes │
            │ weighted split?  ──▶ 90% │
            └──────────┬───────────────┘
                       ▼
                 203.0.113.10
`,
      'The answer is computed, not looked up',
    ),

    h('Routing policies'),
    table(
      ['Policy', 'Answers with', 'Use for'],
      [
        ['**Simple**', 'The same record every time', 'One region, no cleverness'],
        ['**Weighted**', 'A split by percentage', 'Canary releases, gradual migrations'],
        ['**Latency / geo**', 'The closest healthy region', 'Multi-region user-facing systems'],
        ['**Failover**', 'Primary unless it is unhealthy', 'Active-passive disaster recovery'],
        ['**Multi-value + health**', 'Several healthy records', 'Poor-man\'s load balancing'],
      ],
    ),
    tip(
      'Geo-routing is **geography, not latency** — it answers by where the resolver appears to be. Latency-based routing uses measured network times and is usually the better default, because the nearest region is not always the fastest.',
    ),

    h('The hard part — TTL'),
    p(
      'A DNS answer is cached at four levels, and **you cannot invalidate any of them.** The TTL is a promise you made in the past about how long you are willing to wait for a change to take effect.',
    ),
    diagram(
      `
   TTL = 300s (5 min)           TTL = 86400s (24 h)

   failover takes ~5 min        failover takes up to a DAY
   more resolver queries        almost no query load
   more agility                 more caching, lower cost

   and in both cases:
     ▸ some resolvers ignore your TTL
     ▸ some clients cache for the process lifetime
     ▸ some stub resolvers cache forever

   ──▶ DNS is a SLOW failover mechanism. treat it as
       minutes-to-hours, never seconds.
`,
      'The trade you cannot take back',
    ),
    warn(
      'Never design a fast failover on DNS alone. Clients and resolvers routinely ignore short TTLs, and a Java process may cache a lookup for its entire lifetime. **For seconds-level failover you need anycast or a load balancer**, which move traffic without changing the name.',
    ),

    h('Anycast'),
    p(
      'One IP address announced from many locations at once; the network routes each user to the topologically nearest one. **No DNS change is involved**, so failover is at BGP speed rather than TTL speed — which is why CDNs and public resolvers use it.',
    ),
    table(
      ['', 'Geo DNS', 'Anycast'],
      [
        ['Granularity', 'Per resolver', 'Per network path'],
        ['Failover speed', 'TTL — minutes to hours', '**Seconds**'],
        ['Cost / complexity', 'A DNS provider feature', 'Needs your own IP space and BGP, or a provider'],
        ['Best for', 'Steering between regions', 'The edge: CDNs, DNS itself, DDoS absorption'],
      ],
    ),

    h('Record types worth knowing'),
    table(
      ['Type', 'Maps to', 'Note'],
      [
        ['`A` / `AAAA`', 'An IPv4 / IPv6 address', 'The actual answer'],
        ['`CNAME`', 'Another name', 'Cannot exist at the zone apex'],
        ['`ALIAS` / `ANAME`', 'Another name, at the apex', 'Provider-specific; resolves server-side'],
        ['`NS`', 'The authoritative servers', 'Delegation'],
        ['`MX`', 'Mail servers', '—'],
        ['`TXT`', 'Arbitrary text', 'Domain verification, SPF, DKIM'],
      ],
    ),

    h('Failures'),
    table(
      ['What happens', 'Effect', 'Mitigation'],
      [
        ['Your DNS provider is down', '**Total outage** — nobody can resolve you', 'Two providers, both authoritative. This has taken down large parts of the internet'],
        ['A region is unhealthy', 'Users still sent there until TTL expires', 'Health checks plus a short TTL; anycast for real speed'],
        ['DNS propagation delay', 'A change takes effect unevenly', 'Lower the TTL *before* the change, not during'],
        ['Resolver ignores TTL', 'Stale answers for far longer than planned', 'Do not rely on DNS for fast failover'],
      ],
    ),
    tip(
      'Lowering the TTL **before** a planned migration is the operational trick worth remembering: drop it to 60 seconds a day ahead, migrate, then raise it again. Lowering it at the moment of the change does nothing, because the old long TTL is already cached.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Name to address, and the first routing decision in the request path'],
      ['Why it matters', 'It chooses the region before any of your infrastructure is involved'],
      ['Use when', 'Multi-region routing, canary splits, active-passive failover'],
      ['Trade-off', 'Short TTL gives agility and query load; long TTL gives caching and slow failover'],
      [
        '30-second answer',
        '"DNS is the first routing decision — the authoritative answer can depend on where the resolver is, region health, or a weighted split, so it steers users between regions before a packet reaches you. The catch is TTL: answers are cached at four levels you cannot invalidate, and some resolvers ignore the TTL entirely, so DNS failover is minutes to hours. For seconds-level failover use anycast or a load balancer, which move traffic without changing the name."',
      ],
    ]),
    asked([
      ['How does DNS route users to the nearest region?', 'Latency or geo routing policies — the authoritative server answers differently based on the resolver.'],
      ['Why does TTL matter for failover?', 'It bounds how long stale answers are cached, and you cannot invalidate a cached record.'],
      ['Is DNS a good failover mechanism?', 'For minutes, yes. For seconds, no — use anycast or a load balancer.'],
      ['What is anycast?', 'One IP announced from many locations; the network picks the nearest, so failover is BGP-fast.'],
      ['What if your DNS provider fails?', 'Total outage. Use two independent authoritative providers.'],
    ]),

    seeAlso('Computer Networks', 'DNS', 'resolution step by step, record types and the resolver chain'),
    links(wiki('Domain_Name_System', 'Domain Name System'), wiki('Anycast', 'Anycast')),
  ],
};
