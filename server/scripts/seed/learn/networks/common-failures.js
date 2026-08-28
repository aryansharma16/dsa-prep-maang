import { asked, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Network errors are more informative than they look. Each one rules out a different set of causes, and reading them as **evidence** rather than as noise is most of the skill. This page is that reading, as a decision tree — and it is also the shape of a good answer to “how would you debug this in production”.',
    ),

    h('The five messages that matter'),
    table(
      ['Error', 'What definitely happened', 'What to check'],
      [
        ['**`ECONNREFUSED`**', 'You **reached the host**; it sent RST because nothing listens on that port', 'Is the process running? Bound to `0.0.0.0` or only `127.0.0.1`? Right port?'],
        ['**Timeout** / `ETIMEDOUT`', 'Packets went out and **nothing came back**', 'Security group, NACL, route table, host firewall, wrong subnet'],
        ['**`ECONNRESET`**', 'The connection was **torn down mid-flight**', 'The peer crashed, a proxy timed out, a keep-alive was reaped'],
        ['**`ENOTFOUND` / `EAI_AGAIN`**', 'DNS failed — no record, or no resolver answer', '`dig` the name; check the resolver; check the search domain'],
        ['**`EHOSTUNREACH` / `ENETUNREACH`**', 'No route to the destination at all', 'Route table, default gateway, VPN'],
      ],
    ),
    note(
      '**Refused versus timeout is the single most useful distinction in this track.** Refused is a *reply*: the network path works, the host is up, and your problem is the application or its bind address. A timeout is *silence*: something dropped your packet and the culprit is a firewall, a security group or a missing route. Reversing these two costs everybody an hour at least once.',
    ),

    h('502 vs 503 vs 504'),
    p('All three come from something in front of your app, and each names a different failure:'),
    table(
      ['Code', 'The proxy is saying', 'Usual cause'],
      [
        ['**502 Bad Gateway**', '“I asked upstream and got garbage, or nothing at all”', 'The app crashed, is not listening, or returned an invalid response; wrong target port'],
        ['**503 Service Unavailable**', '“I have no healthy target to ask”', 'All targets failing health checks; a deploy with nothing registered; deliberate maintenance'],
        ['**504 Gateway Timeout**', '“I asked and gave up waiting”', 'A slow query, a deadlock, an upstream timeout shorter than the request'],
      ],
    ),
    tip(
      '502 and 504 point in opposite directions. **502 → look at whether the app is up and answering.** **504 → look at how long the app takes.** And 503 from a load balancer almost always means health checks: nothing is in the pool.',
    ),
    warn(
      'A common self-inflicted 504: the load balancer’s idle timeout is 60 seconds and your app takes 75 on a slow report. The user sees a gateway timeout, and your logs show the request completing successfully — because it did, into a connection nobody was listening on any more. Timeouts must decrease outward: client > load balancer > app > database.',
    ),

    h('The decision tree'),
    code(
      sh(`
Does the name resolve?          dig name
  no  -> DNS: record missing, wrong resolver, typo, propagation
  yes v

Does the port accept?           nc -zv host port
  refused -> reached the host. Process down? Wrong port? Bound to 127.0.0.1?
  timeout -> dropped. Security group / NACL / route table / host firewall
  ok      v

Does HTTP answer?               curl -v https://host/health
  TLS error   -> certificate expired, wrong name, missing intermediate
  502 / 503   -> app down, or no healthy targets
  504         -> app too slow, or a timeout ordering problem
  200         v

Is it slow?                     curl -w  (dns / connect / tls / ttfb / total)
  high dns     -> resolver
  high connect -> distance or packet loss
  high ttfb    -> your application or its database
  high total   -> payload size, compression, bandwidth
`),
    ),

    h('“It works locally and hangs in the VPC”'),
    p('The most common production-only failure, and it is nearly always one of these, in this order:'),
    ul(
      '**Security group inbound** on the destination does not allow the port from the source group.',
      '**The subnet has no route** — a private subnet with no NAT gateway cannot reach the internet, so an outbound API call hangs forever.',
      '**The app is bound to `127.0.0.1`** and the container or load balancer therefore cannot reach it. `ss -lntp` on the instance settles this in one line.',
      '**A NACL is missing the ephemeral return range**, so requests leave and replies are dropped.',
      '**Wrong availability zone** — a load balancer without a subnet in the target’s AZ has no path to it.',
      '**DNS inside the VPC** — a private hosted zone that does not resolve from that VPC, or a search-domain difference.',
    ),

    h('Intermittent failures, which are the hard ones'),
    table(
      ['Symptom', 'Likely cause'],
      [
        ['Fails roughly 1 in N, N = instance count', '**One bad instance** still passing health checks'],
        ['Fails only for large requests or responses', '**MTU / path MTU black hole** — see `encapsulation`'],
        ['Fails after exactly 60 seconds, always', 'An **idle timeout** somewhere — load balancer, NAT gateway, proxy'],
        ['Works, then fails after a deploy, then works', 'Connection draining too short, or no graceful shutdown'],
        ['Slow only for some users', 'Geography — no CDN, or DNS steering them to a far region'],
        ['Fails under load only', 'Connection or port exhaustion, thread pool, or a database connection limit'],
        ['Fails at the same time daily', 'A cron job, a batch load, a certificate or token refresh'],
      ],
    ),
    p(
      'The "exactly 60 seconds" row is worth internalising. **A failure at a suspiciously round number is a timeout, not a bug** — and the number tells you which box owns it: 60 s is an ALB idle default, 350 s is a NAT gateway’s, 30 s is many client libraries.',
    ),

    h('What to say in an interview'),
    p(
      'When asked to debug something, narrate the elimination rather than guessing the answer. “First I would check whether the name resolves; then whether the port accepts a connection, because refused and timeout point in different directions; then curl the health endpoint; then split the timing to see whether it is DNS, connect, TLS or the server.” That structure is the thing being tested, and it is the same structure you would actually use at 3am.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Reached the host, nothing listening', '`ECONNREFUSED` — check the process and its bind address'],
      ['Nothing came back at all', 'Timeout — check firewalls, security groups, routes'],
      ['Torn down mid-request', '`ECONNRESET` — peer crash or proxy timeout'],
      ['Proxy got a bad answer', '502 — the app is down or misconfigured'],
      ['Proxy has no healthy targets', '503 — health checks'],
      ['Proxy gave up waiting', '504 — the app is too slow, or timeouts are ordered wrongly'],
      ['Fails at a round number of seconds', 'Find the idle timeout that owns that number'],
      ['Large requests only', 'Path MTU'],
    ]),

    h('Interview'),
    asked([
      ['Connection refused vs connection timed out?', 'Refused is an RST from a reachable host with nothing listening; a timeout means packets were silently dropped — firewall, security group or route.'],
      ['502 vs 504?', '502 is an invalid or missing upstream response; 504 is upstream not answering in time.'],
      ['What causes a 503 from a load balancer?', 'No healthy targets — usually failing health checks or a deploy with nothing registered.'],
      ['Requests fail after exactly 60 seconds — why?', 'An idle or request timeout, commonly a load balancer default; timeouts must decrease outward.'],
      ['One in five requests fails — what is your first guess?', 'One unhealthy instance in the pool that health checks are not catching.'],
      ['Small requests work, large ones hang — why?', 'Path MTU: the oversized packet needs fragmenting and the ICMP telling the sender is being dropped.'],
      ['It works locally but hangs in the VPC.', 'Security group inbound, a missing route or NAT, binding to 127.0.0.1, or a NACL missing ephemeral return ports.'],
    ]),

    links(
      wiki('List_of_HTTP_status_codes', 'HTTP status codes'),
      wiki('Path_MTU_Discovery', 'Path MTU discovery'),
    ),
  ],
};
