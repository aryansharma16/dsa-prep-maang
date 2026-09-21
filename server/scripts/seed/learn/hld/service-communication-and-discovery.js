import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Instances come and go constantly — autoscaling, deploys, crashes — so **hardcoded addresses are stale within minutes**. Service discovery is how a caller finds a healthy instance right now, and the shape of that answer decides how much of your network code lives in your application.',
    ),

    flow(['Service starts', 'Registers', 'Caller looks up', 'Picks an instance', 'Calls'], 'And deregisters on stop'),

    h('Client-side versus server-side discovery'),
    diagram(
      `
   CLIENT-SIDE                       SERVER-SIDE

   caller ──▶ registry "where is B?"  caller ──▶ load balancer ──▶ B
          ◀── [ip1, ip2, ip3]                   (LB asks the
   caller picks one ──▶ B                        registry)

   ✓ one fewer hop                   ✓ callers know nothing
   ✓ smart client-side balancing     ✓ language-agnostic
   ✗ a client library per language   ✗ an extra hop
   ✗ discovery logic in every app    ✗ the LB is a dependency

   SERVICE MESH — server-side, without the shared hop
   caller ──▶ [sidecar] ──▶ [sidecar] ──▶ B
              every pod gets its own proxy: discovery, retries,
              mTLS, circuit breaking, tracing — outside your code
`,
      'Three answers to one question',
    ),
    table(
      ['Approach', 'Discovery lives in', 'Good for'],
      [
        ['**DNS**', 'The platform', 'Simple setups; caching makes failover slow'],
        ['**Registry + client library**', 'Your application', 'One language, full control'],
        ['**Load balancer / Kubernetes Service**', 'The platform', '**The common default**'],
        ['**Service mesh**', 'A sidecar proxy', 'Many services, many languages, uniform policy'],
      ],
    ),
    tip(
      'In Kubernetes this is mostly solved for you: a Service is a stable name and virtual IP, and the platform keeps the endpoint list in step with healthy pods. **Reach for a mesh when you want retries, mTLS and circuit breaking applied uniformly**, not just to find an address.',
    ),

    h('Health checks drive it'),
    table(
      ['Check', 'Asks', 'Used by'],
      [
        ['**Liveness**', '"Is the process wedged?"', 'The orchestrator, to restart it'],
        ['**Readiness**', '"Can it take traffic right now?"', 'Discovery, to add or remove it'],
        ['**Startup**', '"Has it finished booting?"', 'To avoid killing a slow starter'],
      ],
    ),
    warn(
      'Readiness must be **shallow**. A readiness probe that checks the database fails on every instance at once when the database is slow — and discovery removes your entire fleet, turning a degradation into a complete outage.',
    ),

    h('Sync or async between services'),
    table(
      ['Use a synchronous call', 'Use an event'],
      [
        ['The caller needs the answer to respond', 'The caller does not need the result'],
        ['A query for data you do not own', 'Announcing something happened'],
        ['Reserving a contended resource', 'Triggering downstream work'],
        ['', 'Anything that may be slow or unavailable'],
      ],
    ),
    p(
      'A chain of synchronous calls **multiplies failure and adds latency**: five services at 99.9% each give 99.5%, and five 20ms hops are 100ms before any work happens. Breaking the chain with an event where the answer is not needed is usually the biggest available win.',
    ),
    tip(
      'Watch for the **distributed monolith**: services that must all be deployed together and call each other synchronously in a chain. It has every cost of microservices and none of the independence — and it is the most common way a split goes wrong.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Finding a healthy instance of another service, and calling it safely'],
      ['Why it exists', 'Instances change constantly; addresses cannot be static'],
      ['Use when', 'More than one service, anywhere'],
      ['Trade-off', 'Client-side saves a hop and puts logic in every app; server-side is simpler and adds one'],
      [
        '30-second answer',
        '"Instances change constantly, so callers resolve a name at call time. Client-side discovery queries a registry and picks an instance — one fewer hop, but a library per language. Server-side puts a load balancer or Kubernetes Service in front, which is the usual default. A mesh pushes discovery, retries, mTLS and circuit breaking into a sidecar. Readiness probes drive it and must be shallow, or a slow database ejects the whole fleet at once."',
      ],
    ]),
    asked([
      ['How do services find each other?', 'A registry updated by health checks, queried by the client or fronted by a load balancer.'],
      ['Client-side or server-side discovery?', 'Server-side by default. Client-side when you want smarter balancing and control one language.'],
      ['What does a service mesh give you?', 'Discovery, retries, mTLS, circuit breaking and tracing in a sidecar, uniformly and outside your code.'],
      ['Why must readiness checks be shallow?', 'A deep check fails on every instance simultaneously when a shared dependency is slow.'],
      ['What is a distributed monolith?', 'Services that must deploy together and call each other synchronously — all the cost, none of the independence.'],
    ]),

    links(
      wiki('Service_discovery', 'Service discovery'),
      wiki('Service_mesh', 'Service mesh'),
    ),
  ],
};
