import { asked, awsDoc, cheat, code, h, links, note, p, rfc, sh, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The longest topic in the track, and it earns it: DNS is the one piece of
  infrastructure a developer configures personally, breaks personally, and is
  asked about in every interview. The TTL section is the part that changes what
  a reader does on a Monday morning, so it is not squeezed to the bottom.
*/
export const doc = {
  blocks: [
    p(
      '**DNS** is the internet’s phone book: it turns `api.example.com` into `93.184.216.34`. That is the sentence everyone gives. The reason it takes a whole page is that DNS is also a distributed, heavily cached, hierarchical database — and the caching is why a change you make now might not take effect for two days, which is a fact that has ruined a great many deployments.',
    ),

    h('The hierarchy'),
    p('A name is read **right to left**, and each part is served by a different set of machines:'),
    code(
      sh(`
        api  .  example  .  com  .
         │        │         │     └── root         (13 logical root server clusters)
         │        │         └──────── TLD          (.com, run by Verisign)
         │        └────────────────── domain       (your authoritative nameservers)
         └─────────────────────────── subdomain    (a record in your zone)
`),
    ),
    p(
      'The trailing dot is the real root and is normally invisible. `api.example.com.` is a **fully qualified domain name** — the full path, no guessing.',
    ),

    h('A full lookup, from a cold cache'),
    p('Four caches are checked before any of this happens; the walk below is what occurs when all four miss:'),
    table(
      ['Step', 'Question', 'Answer'],
      [
        ['1', 'Browser cache, OS cache, `hosts` file, router', 'Usually a hit — done'],
        ['2', 'Your **recursive resolver** (ISP, `1.1.1.1`, `8.8.8.8`)', 'Also cached? Done'],
        ['3', 'Resolver asks a **root** server', '“I don’t know, but `.com` is served by these 13 hosts”'],
        ['4', 'Resolver asks a **`.com` TLD** server', '“I don’t know, but `example.com` is served by `ns1.registrar.net`”'],
        ['5', 'Resolver asks the **authoritative** server', '“`api.example.com` is `93.184.216.34`, TTL 300”'],
        ['6', 'Resolver caches it for the TTL and answers you', 'Everyone after you gets it instantly'],
      ],
    ),
    p(
      'The client asks **one** question and gets one answer: that is a **recursive** query. The resolver does the legwork with a series of **iterative** queries, each answered with a referral rather than an answer. Knowing which word goes where is a stock interview question.',
    ),
    note(
      'Almost every real lookup stops at step 1 or 2. The full walk is rare — which is exactly why DNS survives serving trillions of queries a day on a modest amount of hardware.',
    ),

    h('The record types'),
    table(
      ['Type', 'Maps to', 'Example', 'Use'],
      [
        ['**A**', 'An IPv4 address', '`example.com → 93.184.216.34`', 'The basic one'],
        ['**AAAA**', 'An IPv6 address', '`example.com → 2606:2800::1`', 'IPv6, said “quad A”'],
        ['**CNAME**', 'Another **name**', '`www → example.com`', 'Aliasing; costs an extra lookup'],
        ['**MX**', 'A mail server, with a priority', '`10 mail.example.com`', 'Email delivery'],
        ['**TXT**', 'Arbitrary text', '`v=spf1 include:...`', 'Domain verification, SPF/DKIM'],
        ['**NS**', 'The authoritative nameservers', '`ns1.registrar.net`', 'Delegation'],
        ['**SOA**', 'Zone metadata', 'serial, refresh, TTLs', 'One per zone'],
        ['**PTR**', 'An IP back to a name', 'Reverse lookup', 'Mail server reputation'],
        ['**SRV**', 'A service’s host **and port**', '`_sip._tcp`', 'Service discovery'],
        ['**CAA**', 'Who may issue certificates', '`0 issue "letsencrypt.org"`', 'Certificate control'],
      ],
    ),
    warn(
      '**A CNAME cannot exist at the zone apex.** `example.com` itself must be an A or AAAA record, because the apex also carries NS and SOA records and the spec forbids a CNAME alongside anything else. This is why `www.example.com` can CNAME to a load balancer but `example.com` cannot — and why cloud providers invented non-standard alias records to solve it: **Route 53 ALIAS**, Cloudflare’s CNAME flattening.',
    ),
    tip(
      'A Route 53 **ALIAS** record behaves like a CNAME at the apex, resolves to the target’s current addresses, is answered by Route 53 itself with no extra round trip, and is **free** to query. Prefer it over a CNAME for anything pointing at AWS — an ALB, CloudFront, an S3 website bucket.',
    ),

    h('TTL — the field that decides your deployment'),
    p(
      'Every record carries a **TTL** in seconds: how long a resolver may cache it. The trade is direct — a long TTL means fewer lookups and faster page loads; a short one means changes propagate quickly.',
    ),
    table(
      ['TTL', 'Suits', 'Costs'],
      [
        ['`60`–`300`', 'Records you might need to change fast; failover', 'More queries, slightly slower first hits'],
        ['`3600` (1h)', 'A sensible default for most records', 'An hour of staleness after a change'],
        ['`86400` (24h)', 'Records that never change — MX, TXT verification', 'A whole day to undo a mistake'],
      ],
    ),
    p('The migration procedure is the same every time, and it is worth having memorised:'),
    ul(
      '**Days before**: lower the TTL to 60 seconds. Wait for the *old* TTL to expire everywhere — if it was 24h, wait a full day.',
      '**At the cutover**: change the record. The world picks it up within a minute.',
      '**Keep the old server running** anyway. Some resolvers ignore TTLs, and some clients cache forever. Java famously cached DNS for the life of the JVM by default.',
      '**Afterwards**: put the TTL back up.',
    ),
    warn(
      'Lowering the TTL *at* cutover time does nothing — resolvers already hold the old record with the old, long TTL and will not ask again until it expires. The lowering has to happen a full old-TTL in advance. This is the single most common DNS mistake in a migration.',
    ),

    h('Seeing it yourself'),
    code(
      sh(`
dig example.com                    # the answer, with TTL
dig example.com +short             # just the address
dig example.com MX                 # a specific record type
dig example.com +trace             # the whole walk: root -> TLD -> authoritative
dig @8.8.8.8 example.com           # ask a specific resolver, skipping yours
dig @ns1.example.com example.com   # ask the authoritative server: the real truth
`),
    ),
    p(
      'The last two are the working pair. If the authoritative server has the new value and `8.8.8.8` has the old one, the change is correct and you are waiting on cache. If the authoritative server has the old one, you have not actually saved your change.',
    ),

    h('Transport, and privacy'),
    ul(
      'DNS runs on **port 53**, over **UDP** for speed — one small packet each way, no handshake.',
      'It falls back to **TCP** when the response is over 512 bytes (large records, DNSSEC, zone transfers).',
      '**DNSSEC** signs records so a resolver can verify they were not tampered with. It does not encrypt anything.',
      '**DoH/DoT** — DNS over HTTPS or TLS — encrypt the query so your ISP cannot read or modify it. This is what your browser may be doing instead of the OS resolver, which is worth remembering when a `hosts` file entry is mysteriously ignored.',
    ),

    h('DNS as infrastructure'),
    p('Because every client asks before connecting, DNS is also a control point — which is what these features are:'),
    table(
      ['Feature', 'Does'],
      [
        ['Multiple A records', 'Crude round-robin load balancing across addresses'],
        ['**Latency / geo routing**', 'Answers with the nearest region’s address — how a CDN and a multi-region app steer traffic'],
        ['**Weighted routing**', 'Sends 5% of clients to a new version — a blue/green or canary lever'],
        ['**Health checks + failover**', 'Stops returning an address once it stops passing checks'],
        ['Private zones', 'Internal names that resolve only inside your VPC'],
      ],
    ),
    note(
      'Route 53 does all five, and its `.53` name is the port. Its **latency-based routing** plus a health check is the standard answer to “how would you fail over between regions” in a system design interview.',
    ),
    p(
      'And the joke you will hear in every outage postmortem — **“it’s always DNS”** — is earned. DNS is the first thing every request touches, it is cached in four places that disagree, its failures are slow rather than loud, and an expired domain or a deleted record takes everything with it.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Point a name at an IP', 'A record (AAAA for IPv6)'],
      ['Point a name at another name', 'CNAME — never at the apex'],
      ['Point the apex at an AWS resource', 'Route 53 ALIAS'],
      ['Prepare a migration', 'Lower the TTL a full old-TTL in advance'],
      ['Check what the world sees', '`dig @8.8.8.8 name`'],
      ['Check what is actually configured', '`dig @your-nameserver name`'],
      ['See the full resolution path', '`dig name +trace`'],
      ['Fail over between regions', 'Health checks plus latency or failover routing'],
    ]),

    h('Interview'),
    asked([
      ['Walk me through a DNS lookup.', 'Browser, OS, router and resolver caches; on a miss the resolver asks root, then the TLD, then the authoritative server, and caches the answer for its TTL.'],
      ['Recursive vs iterative query?', 'The client asks recursively — “get me the answer”; the resolver queries iteratively, following referrals.'],
      ['A vs CNAME vs ALIAS?', 'A maps to an IP, CNAME maps to another name and costs an extra lookup, ALIAS is a provider record that acts like a CNAME at the apex.'],
      ['Why can a CNAME not sit at the apex?', 'The apex must carry NS and SOA records, and a CNAME cannot coexist with other records.'],
      ['What is a TTL and how does it affect a migration?', 'How long resolvers may cache a record; lower it well before the change or the old value stays out there.'],
      ['UDP or TCP?', 'UDP 53 normally; TCP when the response exceeds 512 bytes or for zone transfers.'],
      ['How would you fail over between regions?', 'DNS health checks with failover or latency-based routing, on records with a short TTL.'],
      ['What does DNSSEC do?', 'Signs records so a resolver can verify authenticity — it authenticates, it does not encrypt.'],
    ]),

    links(
      wiki('Domain_Name_System', 'Domain Name System'),
      rfc(1035, 'RFC 1035 — Domain names'),
      awsDoc('Route53/latest/DeveloperGuide/routing-policy.html', 'Route 53 routing policies'),
    ),
  ],
};
