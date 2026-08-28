import { asked, awsDoc, cheat, h, links, note, p, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A load balancer takes one stream of incoming requests and spreads it across several servers. It is the box that makes horizontal scaling possible, and it does three jobs at once: **distribute** the work, **detect** dead servers, and give the outside world **one address** that does not change when you replace everything behind it.',
    ),

    h('L4 vs L7 — the comparison they ask for'),
    table(
      ['', 'Layer 4', 'Layer 7'],
      [
        ['Sees', 'IP addresses and ports', 'The whole HTTP request'],
        ['Routes on', 'The connection', 'Path, host, header, cookie, method'],
        ['TLS', 'Passes it through — cannot read it', '**Terminates** it, or re-encrypts'],
        ['Speed', 'Very fast — millions of connections, ~microseconds', 'Slower — it parses and re-serialises'],
        ['Protocol', 'Anything over TCP/UDP', 'HTTP(S), gRPC, WebSocket'],
        ['Can do', 'Nothing clever', 'Path routing, header rewriting, caching, auth, WAF'],
        ['On AWS', '**NLB**', '**ALB**'],
      ],
    ),
    p(
      'The rule of thumb: **L7 unless you have a reason.** Path-based routing is what lets `/api` reach one service and `/images` another, and that flexibility is why the ALB is the default choice. Reach for L4 when you need raw throughput, a non-HTTP protocol, a static IP address, or end-to-end encryption the balancer must not be able to read.',
    ),

    h('The algorithms'),
    table(
      ['Algorithm', 'How', 'Good for'],
      [
        ['**Round robin**', 'Each server in turn', 'Uniform servers and uniform requests'],
        ['Weighted round robin', 'In turn, but bigger servers get more', 'Mixed instance sizes; canary releases'],
        ['**Least connections**', 'Whoever is handling fewest right now', '**Uneven request durations — usually the best default**'],
        ['Least response time', 'Fewest connections *and* fastest lately', 'Latency-sensitive services'],
        ['**IP hash / consistent hash**', 'Hash of the client address decides', 'Sticky routing, cache locality'],
        ['Random with two choices', 'Pick two at random, take the less loaded', 'Large fleets — nearly as good as least-connections, far cheaper'],
      ],
    ),
    tip(
      '“Round robin” is the answer everyone gives; **least connections** is the answer that shows you have thought about it. With round robin, one server that receives a few slow requests keeps getting new ones anyway — the balancer is not looking at what it is already doing.',
    ),

    h('Health checks — the part that actually saves you'),
    p(
      'A load balancer polls each target — say `GET /health` every 30 seconds — and stops sending traffic after N consecutive failures, resuming after M consecutive successes. Without this, a crashed instance keeps receiving a third of your traffic.',
    ),
    ul(
      '**Shallow check** — “is the process up”. Cheap, and it lies: an app with a dead database still returns 200.',
      '**Deep check** — verify the database and cache too. Honest, but a slow dependency can then take your whole fleet out of rotation at once.',
      '**The usual compromise:** a shallow `/health` for the load balancer and a deeper `/ready` for deployment gating and dashboards. Kubernetes formalises exactly this split as liveness and readiness probes.',
    ),
    warn(
      'A deep health check that queries the database, on every instance, every few seconds, is also a load generator — and if the database wobbles, every instance fails its check simultaneously and you have taken the entire service down in response to a partial degradation. Cache the result, and prefer failing *open* on shared dependencies.',
    ),

    h('Sticky sessions'),
    p(
      'Stickiness pins a client to one instance, usually with a cookie the balancer injects. It exists to support servers that keep per-user state in memory.',
    ),
    table(
      ['Cost', 'Why it hurts'],
      [
        ['Uneven load', 'Long-lived clients pile onto one instance'],
        ['Lost sessions on deploy', 'The instance goes away and so does the state'],
        ['Broken autoscaling', 'New instances receive only new users'],
      ],
    ),
    p(
      'The right answer in a design interview is to **make the servers stateless** — session state in Redis or in a signed token — and use stickiness only where the protocol forces it, which in practice means WebSockets, since a socket genuinely lives on one instance.',
    ),

    h('Who balances the balancer'),
    p(
      'The obvious follow-up question, and it has a clean answer: **DNS**. A managed load balancer is not one machine — it is a fleet behind a DNS name that resolves to several addresses, in several availability zones, scaling itself. That is why AWS gives you a **name** for an ALB and not an IP, and why hardcoding the address you got from `dig` is a mistake that works until it does not.',
    ),
    note(
      'The NLB is the exception and it is deliberate: it can have a **static IP per availability zone**, which is what you use when a partner needs to allowlist your addresses in a firewall.',
    ),

    h('Connection draining, and deploys'),
    p(
      'When an instance is removed — a deploy, a scale-in — in-flight requests must be allowed to finish. **Deregistration delay** (AWS) or **connection draining** stops new traffic while giving existing requests, say, 30 seconds. Set it slightly above your slowest normal request, and make sure your app handles `SIGTERM` by closing the server rather than exiting immediately, or you will drop the last few requests of every deploy.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Route by URL path or hostname', 'L7 — an ALB, nginx'],
      ['Handle raw TCP, or need a static IP', 'L4 — an NLB'],
      ['Pick a default algorithm', 'Least connections'],
      ['Stop traffic to a dead instance', 'Health checks with a failure threshold'],
      ['Avoid sticky sessions', 'Keep state in Redis or a token'],
      ['Keep WebSockets working', 'Stickiness plus an idle timeout above your heartbeat'],
      ['Deploy without dropping requests', 'Connection draining plus graceful `SIGTERM` shutdown'],
    ]),

    h('Interview'),
    asked([
      ['L4 vs L7 load balancer?', 'L4 forwards by IP and port without reading the payload; L7 parses HTTP and can route on path, host or cookie — and must terminate TLS.'],
      ['Which algorithms do you know?', 'Round robin, weighted, least connections, least response time, IP/consistent hash, and power-of-two-choices.'],
      ['Which would you choose and why?', 'Least connections by default, because request durations vary and round robin ignores what a server is already doing.'],
      ['How does it know a server is dead?', 'Periodic health checks with failure and success thresholds before removing or restoring a target.'],
      ['What is a sticky session and why avoid it?', 'Pinning a client to one instance; it unbalances load and loses state on deploy — keep servers stateless instead.'],
      ['What balances the load balancer?', 'DNS across a managed, multi-AZ fleet — which is why you get a name, not an IP.'],
      ['How do you deploy without dropping requests?', 'Deregistration delay plus a graceful shutdown that stops accepting and finishes in-flight work.'],
    ]),

    links(
      wiki('Load_balancing_(computing)', 'Load balancing'),
      awsDoc('elasticloadbalancing/latest/userguide/what-is-load-balancing.html', 'Elastic Load Balancing'),
    ),
  ],
};
