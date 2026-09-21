import { asked, diagram, flow, h, links, p, quick, table, tip, tradeoff, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A load balancer spreads requests across a pool of servers and **takes the dead ones out of rotation**. The second half is the part that matters more: distribution is easy, and knowing which backend is actually able to serve is what turns a pool of machines into an available system.',
    ),

    flow(['Client', 'Load balancer', 'Healthy backend'], 'Plus health checks, always'),

    h('Layer 4 versus layer 7'),
    diagram(
      `
   L4 — transport                    L7 — application
   ─────────────────                 ───────────────────
   sees: IP, port                    sees: URL, headers, cookies,
   does: forwards packets                  method, body
                                     does: terminates TLS, reads the
   ┌────┐                                  request, decides, re-sends
   │ LB │──▶ backend
   └────┘  (connection passed        ┌────┐
            through)                 │ LB │──▶ /api/*   ▶ api pool
                                     └────┘──▶ /static/* ▶ cdn origin
   ✓ very fast, low CPU                     ──▶ /ws/*    ▶ socket pool
   ✓ protocol agnostic
   ✗ cannot route on path            ✓ content-based routing
   ✗ cannot terminate TLS            ✓ TLS termination, compression
                                     ✗ more CPU, higher latency
`,
      'How much of the request it understands',
    ),
    table(
      ['', 'L4', 'L7'],
      [
        ['Sees', 'IP and port', 'The whole HTTP request'],
        ['Routes on', 'Connection', 'Path, host, header, cookie'],
        ['TLS', 'Passes through', 'Usually terminates'],
        ['Throughput', 'Millions of connections', 'Lower — it parses everything'],
        ['Use for', 'Raw TCP, databases, extreme throughput', '**Almost all web traffic**'],
        ['Examples', 'AWS NLB, IPVS', 'AWS ALB, Nginx, Envoy, HAProxy'],
      ],
    ),
    tip(
      'Default to L7 for anything HTTP. You give up some throughput and get path-based routing, TLS termination, retries, header-based canaries and observability — **all of which you will want within a month**.',
    ),

    h('Algorithms'),
    table(
      ['Algorithm', 'How', 'Right when', 'Wrong when'],
      [
        ['**Round robin**', 'Next in the list', 'Requests cost roughly the same', 'They do not — a slow backend gets equal share'],
        ['**Least connections**', 'Fewest in-flight', '**Variable request cost**', 'Rarely wrong; a good default'],
        ['**Least response time**', 'Fastest recent latency', 'Backends differ in speed', 'Can oscillate under load'],
        ['**Weighted**', 'Proportional to capacity', 'Heterogeneous machines, canaries', 'Weights go stale'],
        ['**IP / consistent hash**', 'Same client → same backend', 'Cache locality, sticky need', 'Uneven distribution; breaks on scaling'],
        ['**Random two choices**', 'Pick 2, take the emptier', 'Very large pools', 'Almost never — it is surprisingly good'],
      ],
    ),
    warn(
      'Round robin is the default and is wrong more often than people expect. If one backend is slow — a GC pause, a cold cache — round robin **keeps sending it an equal share** and your p99 follows it. Least-connections routes around a struggling node automatically.',
    ),

    h('Health checks are the real feature'),
    diagram(
      `
   passive                          active
   ───────                          ──────
   watch real traffic:              poll an endpoint:
     5xx rate, timeouts               GET /health every 5s
        │                                │
        ▼                                ▼
   eject after N failures           eject after N failures
   re-admit slowly                  re-admit after M successes

   SHALLOW  /health  ──▶ 200 "the process is up"
   DEEP     /ready   ──▶ checks DB, cache, dependencies

   use SHALLOW for the load balancer.
   a deep check that fails on a slow database ejects EVERY
   backend at once and turns a degradation into an outage.
`,
      'And why the deep one is a trap',
    ),
    table(
      ['Setting', 'Too aggressive', 'Too lax'],
      [
        ['Interval', 'Health-check traffic becomes load', 'Slow to notice a dead node'],
        ['Failure threshold', 'One blip ejects a healthy node', 'Dead node keeps getting traffic'],
        ['Deep vs shallow', 'A shared dependency ejects the whole fleet', 'Broken backends stay in rotation'],
        ['Re-admission', 'A cold node gets full traffic and falls over', 'Capacity returns slowly after an incident'],
      ],
    ),

    h('Sticky sessions'),
    tradeoff([
      ['**Sticky**', 'In-memory session works; cache locality is good', 'Uneven load, disruptive deploys, node failure logs users out'],
      ['**Stateless**', 'Any request to any node; deploys and failures are invisible', 'Session state must live in Redis or a signed cookie'],
    ]),
    p(
      'Stickiness is a way to postpone making the service stateless. It is legitimate as a stopgap and it is not an architecture — **every scaling property you want depends on any request being servable by any node**.',
    ),

    h('Who balances the balancer'),
    table(
      ['Approach', 'How'],
      [
        ['**DNS multi-value**', 'Several A records; clients pick. Cheap, slow to fail over'],
        ['**Anycast**', 'One IP from many locations; the network routes. Fast failover'],
        ['**Managed LB**', 'The provider runs a redundant fleet behind one endpoint'],
        ['**Active-passive pair**', 'A floating IP moves on failure. Classic on-premise'],
      ],
    ),
    warn(
      'A single load balancer is a **single point of failure in front of your redundant fleet** — the most ironic outage available. It is also why managed load balancers are usually the right call: the redundancy is someone else\'s problem.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Distributes requests across backends and removes unhealthy ones'],
      ['Why it exists', 'Horizontal scaling and availability both need a front door'],
      ['Use when', 'Any time there is more than one server'],
      ['Trade-off', 'L7 gives routing and TLS and costs throughput; stickiness gives locality and costs flexibility'],
      [
        '30-second answer',
        '"L4 forwards packets on IP and port — fast and protocol-agnostic. L7 parses the request, so it can route on path or header, terminate TLS and retry, at more CPU. Default to L7 for HTTP. Least-connections beats round robin because it routes around a slow backend automatically. The real feature is health checking: shallow checks, because a deep check on a shared dependency ejects the whole fleet at once. And the load balancer itself must be redundant."',
      ],
    ]),
    asked([
      ['L4 or L7?', 'L7 for HTTP — you want path routing, TLS termination and retries. L4 for raw TCP or extreme throughput.'],
      ['Why not round robin?', 'It keeps feeding a slow backend an equal share. Least-connections routes around it.'],
      ['Why shallow health checks?', 'A deep check on a shared database fails on every node simultaneously, ejecting the whole fleet.'],
      ['Are sticky sessions bad?', 'They are a stopgap. They break even distribution and make deploys and node failures user-visible.'],
      ['What balances the load balancer?', 'DNS multi-value, anycast, or a managed service. It must not be a single point of failure.'],
    ]),

    seeAlso('Computer Networks', 'Load balancing', 'the packet-level mechanics and how NAT and connection tracking work'),
    links(
      wiki('Load_balancing_(computing)', 'Load balancing'),
      wiki('Health_check', 'Health check'),
    ),
  ],
};
