import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'A proxy sits in the middle of a request and does something useful with it. **Which direction it faces decides what it is called**: a forward proxy acts for the client, a reverse proxy acts for the server, and an API gateway is a reverse proxy that has learned about your APIs.',
    ),

    diagram(
      `
   FORWARD PROXY                     REVERSE PROXY
   acts for the CLIENT               acts for the SERVER

   client ──▶ [proxy] ──▶ internet   internet ──▶ [proxy] ──▶ servers

   the SERVER does not know           the CLIENT does not know
   who the client is                  which server answered

   corporate egress filtering         TLS termination
   caching, anonymity                 caching, compression
   VPN-ish                            load balancing, routing
`,
      'Same machine, opposite direction',
    ),

    h('Reverse proxy versus API gateway'),
    table(
      ['', 'Reverse proxy', 'API gateway'],
      [
        ['Thinks in', 'Requests and paths', '**APIs, clients and quotas**'],
        ['TLS termination', 'Yes', 'Yes'],
        ['Routing', 'Path and host', 'Path, version, consumer'],
        ['Auth', 'Basic, or pass through', '**Token validation, scopes, per-consumer identity**'],
        ['Rate limiting', 'Crude, by IP', '**Per API key, per plan, per endpoint**'],
        ['Transformation', 'Headers', 'Request/response shape, protocol translation'],
        ['Aggregation', 'No', 'Sometimes — fan out to several services'],
        ['Examples', 'Nginx, HAProxy, Envoy', 'Kong, AWS API Gateway, Apigee'],
      ],
    ),
    p(
      'The boundary is blurry and getting blurrier — Envoy configured with auth and rate limiting **is** an API gateway. The useful distinction is not the software but whether the thing knows about **consumers**: an API gateway can answer "who is calling and what are they allowed to do", and a plain reverse proxy cannot.',
    ),

    h('What an API gateway takes off your services'),
    diagram(
      `
   WITHOUT                           WITH

   ┌────────┐ auth, rate limit,      ┌─────────────────────┐
   │ svc A  │ TLS, logging,          │    API gateway      │
   ├────────┤ CORS, versioning       │  auth · rate limit  │
   │ svc B  │ ...all of it,          │  TLS · CORS · logs  │
   ├────────┤ implemented            └──┬────────┬─────────┘
   │ svc C  │ THREE times,              ▼        ▼
   └────────┘ slightly                ┌────┐  ┌────┐
              differently             │svcA│  │svcB│  ← just business
                                      └────┘  └────┘     logic
   ✗ three auth bugs to fix
   ✗ three rate limiters to tune     ✓ one place to change
                                     ✗ one place to break
`,
      'Cross-cutting concerns, centralised',
    ),
    table(
      ['Concern', 'Why it belongs at the edge'],
      [
        ['**Authentication**', 'Validate the token once; services trust an internal header'],
        ['**Rate limiting**', 'Reject before consuming any service capacity'],
        ['**TLS termination**', 'Certificates in one place'],
        ['**Routing and versioning**', 'Move traffic without redeploying services'],
        ['**Request logging**', 'One consistent access log for everything'],
        ['**CORS, compression, size limits**', 'Nobody wants this code three times'],
      ],
    ),
    warn(
      'The gateway becomes a **single point of failure and a deployment bottleneck**. Every team needs a config change to ship, and every request in the system depends on it. Run it redundantly, keep its logic thin, and resist the urge to put business logic in it — that is how a gateway becomes a distributed monolith.',
    ),

    h('Backend for frontend'),
    p(
      'One gateway per client type rather than one for everyone. A mobile app wants small, aggregated responses on a slow network; a web app wants richer ones; a partner API wants stability. **A single gateway serving all three ends up serving none of them well.**',
    ),
    diagram(
      `
   ┌────────┐   ┌────────┐   ┌─────────┐
   │ mobile │   │  web   │   │ partner │
   └───┬────┘   └───┬────┘   └────┬────┘
       ▼            ▼             ▼
   ┌────────┐   ┌────────┐   ┌─────────┐
   │ mobile │   │  web   │   │ public  │   each owned by the
   │  BFF   │   │  BFF   │   │   API   │   team that owns
   └───┬────┘   └───┬────┘   └────┬────┘   that client
       └────────────┼─────────────┘
                    ▼
         ┌─────────────────────┐
         │ shared services     │
         └─────────────────────┘
`,
      'One per client, not one per service',
    ),
    tip(
      'The BFF is owned by the **client team**, which is the whole point: they can change the shape of their own responses without negotiating with every backend team. The cost is duplicated aggregation logic across BFFs, which is usually the cheaper problem.',
    ),

    h('Ordering at the edge'),
    flow(['TLS', 'WAF', 'Rate limit', 'Auth', 'Route', 'Service'], 'Cheapest rejection first'),
    p(
      'The order is a performance decision. **Reject as early and as cheaply as possible**: dropping a flood at the rate limiter costs almost nothing, and validating its tokens first would cost a signature check per request.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'A server-side intermediary that handles cross-cutting concerns'],
      ['Why it exists', 'So auth, rate limiting and TLS are not reimplemented in every service'],
      ['Use when', 'More than a couple of services, or more than one client type'],
      ['Trade-off', 'Centralising buys consistency and creates a shared failure and deploy bottleneck'],
      [
        '30-second answer',
        '"A forward proxy acts for the client, a reverse proxy for the server. An API gateway is a reverse proxy that understands consumers — it can authenticate a token, apply a per-key quota, version routes and transform responses, so services only contain business logic. The cost is a shared single point of failure and a deploy bottleneck, so keep it thin and redundant. When client types differ enough, split it into a backend-for-frontend per client."',
      ],
    ]),
    asked([
      ['Reverse proxy or API gateway?', 'A gateway knows about consumers — per-key quotas, token validation, versioning. A proxy just routes.'],
      ['What belongs at the gateway?', 'Auth, rate limiting, TLS, routing, logging, CORS. Never business logic.'],
      ['What is a BFF?', 'A gateway per client type, owned by that client team, shaping responses for its needs.'],
      ['Is the gateway a single point of failure?', 'Yes. Run it redundantly and keep its logic thin so it rarely needs changing.'],
      ['Why rate limit before auth?', 'Rejecting is cheaper than verifying a signature. Order the edge cheapest-rejection-first.'],
    ]),

    seeAlso('Computer Networks', 'Proxies', 'the connection-level mechanics of forward and reverse proxying'),
    links(
      wiki('Reverse_proxy', 'Reverse proxy'),
      wiki('API_management', 'API management'),
    ),
  ],
};
