import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';
import { seeAlso } from './shapes.js';

export const doc = {
  blocks: [
    p(
      'The security a design round expects you to have thought about: **encryption in both states, secrets that are not in the repository, least privilege, and a handful of named attacks with named defences.** Not a security course — the parts that change an architecture.',
    ),

    h('Defence in depth'),
    diagram(
      `
   edge          WAF · DDoS absorption · TLS · rate limiting
     │
   gateway       authentication · coarse authz · request size caps
     │
   service       object-level authz · input validation · output encoding
     │
   data          encryption at rest · least-privilege DB user ·
                 no dynamic SQL
     │
   infra         private subnets · security groups · no public DB
     │
   operations    secret rotation · audit logs · patching

   no single layer is trusted. every one of them assumes
   the one above it has already been bypassed.
`,
      'Six layers, none of them sufficient alone',
    ),

    h('Encryption, in both states'),
    table(
      ['', 'In transit', 'At rest'],
      [
        ['Protects against', 'Interception on the network', 'Stolen disks, snapshots, backups'],
        ['Mechanism', 'TLS 1.3', 'Disk or field-level encryption'],
        ['Cost', 'Negligible today', 'Negligible with hardware acceleration'],
        ['**Internal traffic too?**', '**Yes** — mTLS between services', 'Yes'],
        ['Does not protect against', 'A compromised endpoint', '**A compromised application** — it decrypts for you'],
      ],
    ),
    warn(
      'Disk encryption protects against someone stealing the disk, **not against an attacker with application access** — the application has the key and decrypts on read. For genuinely sensitive fields, encrypt at the field level with a separately managed key.',
    ),
    tip(
      '**Crypto-shredding** is the field-level pattern worth knowing: encrypt each user\'s personal data with a per-user key. Deleting that one key makes the data unrecoverable everywhere at once — including in backups and append-only logs, which is otherwise the hardest part of a GDPR deletion request.',
    ),

    h('Secrets'),
    table(
      ['Where secrets live', 'Verdict'],
      [
        ['In the repository', '**Never.** Git remembers forever, even after a delete'],
        ['In environment variables', 'Acceptable; visible in process listings and crash dumps'],
        ['In a secrets manager', '**Right** — Vault, AWS Secrets Manager, KMS'],
        ['Injected at runtime, never written to disk', 'Better'],
        ['**Short-lived, auto-rotated**', '**Best** — a leaked credential expires on its own'],
      ],
    ),
    p(
      'The best property of a secret is **a short life**. A static database password leaked into a log is a problem until someone notices; a fifteen-minute credential is a problem for fifteen minutes.',
    ),

    h('Least privilege'),
    table(
      ['Component', 'Should have'],
      [
        ['Application DB user', '`SELECT`, `INSERT`, `UPDATE` on its own tables. Not `DROP`, not `SUPER`'],
        ['Service credentials', 'Only the scopes it uses'],
        ['Deploy role', 'Deploy permissions, not data access'],
        ['Read replicas', 'A read-only user, enforced'],
        ['Object storage', 'A prefix, not the whole bucket'],
      ],
    ),
    tip(
      'An application that connects as the database owner turns **any SQL injection into a full database compromise**. The same bug against a user with only `SELECT` and `INSERT` on four tables is a data leak — bad, but recoverable.',
    ),

    h('The attacks to name'),
    table(
      ['Attack', 'Is', 'Defence'],
      [
        ['**SQL injection**', 'Input treated as query structure', '**Parameterised queries.** Not escaping'],
        ['**XSS**', 'Input rendered as script', 'Context-aware output encoding; CSP'],
        ['**CSRF**', 'A forged request using the victim\'s cookie', '`SameSite` cookies, CSRF tokens'],
        ['**SSRF**', 'Making the server fetch an internal URL', 'Allowlist destinations; block link-local addresses'],
        ['**IDOR**', 'Accessing another user\'s object by id', '**Object-level authorization**'],
        ['**DDoS**', 'Overwhelming volume', 'CDN and scrubbing, rate limiting, autoscaling'],
        ['**Credential stuffing**', 'Reused passwords from other breaches', 'MFA, rate limiting, breach-password checks'],
        ['**Supply chain**', 'A compromised dependency', 'Lockfiles, scanning, minimal dependencies'],
      ],
    ),
    warn(
      'SSRF deserves attention in a design round because it is **an architectural bug, not a coding one**. Any feature that fetches a user-supplied URL — webhooks, image imports, link previews — can be pointed at internal services and the cloud metadata endpoint.',
    ),

    h('DDoS, by layer'),
    flow(['Volumetric', 'Protocol', 'Application'], 'Three kinds, three defences'),
    table(
      ['Layer', 'Attack', 'Defence'],
      [
        ['**Network (L3/4)**', 'Volumetric floods', 'Anycast CDN and provider scrubbing. Not something you absorb yourself'],
        ['**Protocol**', 'SYN floods, slowloris', 'SYN cookies, connection timeouts, a proxy in front'],
        ['**Application (L7)**', 'Expensive endpoints hit repeatedly', '**Rate limiting, CAPTCHA, caching, WAF rules**'],
      ],
    ),
    p(
      'Only the third layer is your design\'s problem. The first two are bought from a provider — **and the L7 answer is mostly "make the expensive path cheap or limited"**, which is ordinary engineering.',
    ),

    h('The design-round checklist'),
    table(
      ['Question', 'One-line answer'],
      [
        ['How is data protected in transit?', 'TLS everywhere, mTLS between services'],
        ['And at rest?', 'Encrypted volumes; field-level for sensitive data'],
        ['Where are secrets?', 'A secrets manager, short-lived and rotated'],
        ['How do you stop injection?', 'Parameterised queries, validation at the boundary'],
        ['How do you stop IDOR?', 'Scope every query by the caller\'s identity'],
        ['What about DDoS?', 'CDN and scrubbing at the edge, rate limits at the gateway'],
        ['Who can see production data?', 'Least privilege, audited, time-bound access'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'The security decisions that change an architecture'],
      ['Why it matters', 'It is asked late in a round, and a blank answer stands out'],
      ['Use when', 'Wrapping up — two or three sentences is enough'],
      ['Trade-off', 'Every layer costs latency or engineering time; skipping them costs more'],
      [
        '30-second answer',
        '"Defence in depth: TLS everywhere including between services, encrypted at rest with field-level encryption for sensitive data, secrets in a manager and short-lived, and every component on least privilege — an app connecting as the database owner turns injection into total compromise. Parameterised queries, object-level authorization against IDOR, and URL allowlists for anything fetching user-supplied links. DDoS is a CDN problem at L3 and a rate-limiting problem at L7."',
      ],
    ]),
    asked([
      ['How do you defend against DDoS?', 'Volumetric at the edge with an anycast CDN and scrubbing; application-layer with rate limiting, caching and WAF rules.'],
      ['Where should secrets live?', 'A secrets manager, injected at runtime, short-lived and rotated. Never in the repository.'],
      ['Does encryption at rest protect against a hacked app?', 'No. The application holds the key. Use field-level encryption with separate key management.'],
      ['What is SSRF and why does it matter here?', 'Making your server fetch an internal URL. Any webhook or link-preview feature is a candidate.'],
      ['Why does least privilege matter so much?', 'It decides whether one injection bug is a data leak or a full compromise.'],
    ]),

    seeAlso('Computer Networks', 'HTTPS and TLS', 'the handshake, certificates and what TLS actually guarantees'),
    links(
      wiki('Defense_in_depth_(computing)', 'Defence in depth'),
      wiki('Principle_of_least_privilege', 'Least privilege'),
    ),
  ],
};
