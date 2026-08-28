import { asked, cheat, h, links, note, p, table, ul, warn, wiki } from '../blocks.js';

/*
  The ceiling matters more here than anywhere else in the track. This is not a
  security course: no exploitation, no tooling, no attack methodology. It is the
  five attacks a developer needs to be able to *name and defend against* in an
  interview or a design review, and the six defaults that cover most of them.
*/
export const doc = {
  blocks: [
    p(
      'This is the developer-level version: the attacks you should be able to name and reason about, and the defaults that stop most of them. It is not a security course — the goal is that a design review or an interview question about network security does not catch you out.',
    ),

    h('The threats, and what actually stops each'),
    table(
      ['Attack', 'What happens', 'The defence'],
      [
        ['**Sniffing / eavesdropping**', 'Someone on the path reads your traffic', '**TLS everywhere.** That is the whole answer'],
        ['**Man-in-the-middle**', 'Someone sits between and relays — reading and altering', '**TLS with certificate validation.** Encryption alone is not enough'],
        ['**Spoofing**', 'Forged source address — ARP, IP or DNS', 'Authentication above the network layer; DNSSEC; ignore untrusted headers'],
        ['**DDoS**', 'Overwhelming traffic from many sources', 'A CDN or scrubbing provider, rate limits, autoscaling'],
        ['**Port scanning / exposure**', 'Finding services you did not mean to publish', 'Default-deny firewalls; private subnets'],
        ['**Replay**', 'Capturing a valid request and re-sending it', 'Nonces, timestamps, short-lived tokens, TLS'],
      ],
    ),
    p(
      'Notice how many rows say TLS. On a shared network — café WiFi, a hotel, a conference — **encryption in transit is not an enhancement, it is the entire perimeter.** ARP has no authentication, DNS answers can be forged, and any of that is harmless if the payload is encrypted and the certificate is checked.',
    ),

    h('Man-in-the-middle, and why the padlock matters'),
    p(
      'The attack in one line: instead of you talking to the bank, you talk to the attacker and the attacker talks to the bank, relaying everything. Both connections can be perfectly encrypted. What breaks the attack is not encryption — it is **authentication**: the attacker cannot produce a certificate for `yourbank.com` that chains to a trusted root.',
    ),
    warn(
      'Which is why "just click through the certificate warning" is genuinely dangerous, and why disabling certificate verification to make a client work — `rejectUnauthorized: false`, `curl -k`, `verify=False` — removes the one thing standing between your traffic and anyone on the path. If it is in your code to get past a self-signed certificate, add the CA instead.',
    ),

    h('DDoS, at three layers'),
    table(
      ['Layer', 'Example', 'Mitigation'],
      [
        ['**L3/L4 volumetric**', 'UDP flood, amplification, SYN flood', 'Absorbed upstream — a CDN or scrubbing provider; SYN cookies'],
        ['**L7 application**', 'Thousands of requests to your most expensive endpoint', 'Rate limiting per IP and per key, WAF rules, caching, a queue'],
        ['**Amplification**', 'Small forged request to an open DNS/NTP server, huge reply sent to the victim', 'Do not run open resolvers; providers filter spoofed sources'],
      ],
    ),
    p(
      'The honest developer answer is that you do not defend against a large volumetric attack yourself — **you buy a bigger front door**. Cloudflare, CloudFront with Shield, or equivalent, absorbing traffic across hundreds of PoPs. What you own is layer 7: rate limits, cheap health endpoints, caching, and making sure one expensive query cannot be triggered a thousand times a second.',
    ),

    h('Firewall, WAF, security group'),
    table(
      ['', 'Works at', 'Decides on', 'Example'],
      [
        ['**Firewall**', 'L3/L4', 'IP, port, protocol', 'iptables, a network ACL'],
        ['**Security group**', 'L3/L4, per instance', 'Port and source, **stateful**', 'AWS — “allow 443 from anywhere”'],
        ['**WAF**', 'L7', 'The HTTP request itself', 'Blocking SQL injection patterns, bad bots, per-path rate limits'],
        ['**IDS / IPS**', 'Varies', 'Traffic patterns', 'Detects or blocks known-bad behaviour'],
      ],
    ),
    note(
      'A WAF is worth naming precisely because it is the only one on that list that can see a SQL-injection string — the others see a TCP connection to port 443 and nothing more. It is a useful layer and never a replacement for parameterised queries.',
    ),

    h('VPNs and zero trust'),
    p(
      'A **VPN** builds an encrypted tunnel so a remote machine behaves as if it were on a private network. Two quite different uses share the name: the corporate one (reach internal systems from home) and the consumer one (hide your traffic from the local network and your ISP).',
    ),
    p(
      'The direction of travel in industry is away from "inside the VPN is trusted": that model gives an attacker who gets one foothold the entire internal network. **Zero trust** says authenticate and authorise **every** request regardless of where it came from — which in practice means mTLS between services, short-lived credentials, and no implicit trust from being on a particular subnet. You do not need to implement it; you should be able to explain why "we are inside the VPC" is not an authorisation argument.',
    ),

    h('The defaults that cover most of it'),
    ul(
      '**HTTPS everywhere, HSTS on**, and no exceptions for internal services on shared networks.',
      '**Default-deny inbound.** Open the ports you need, from the sources that need them. A database open to `0.0.0.0/0` is the single most common serious misconfiguration in the cloud.',
      '**Private subnets** for anything that does not need to be reachable — see `vpc-and-subnets`.',
      '**Rate limit** every public endpoint, and harder on the expensive and unauthenticated ones.',
      '**Never trust client-supplied headers** for identity — `X-Forwarded-For` included, unless it came from your own proxy.',
      '**Rotate and expire.** Short-lived tokens, auto-renewing certificates, no long-lived static credentials on instances — use a role.',
    ),
    warn(
      'One more, because it is a networking bug with a security consequence: an application that fetches a URL supplied by a user can be pointed at `169.254.169.254` and asked to read the instance’s own credentials. That is **SSRF**, it is a top-ten web vulnerability, and the network-side mitigations are IMDSv2 and egress rules that stop an app calling the metadata service at all.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Stop eavesdropping', 'TLS, everywhere, with validation on'],
      ['Stop a man-in-the-middle', 'Certificate validation — never disable it'],
      ['Survive a volumetric DDoS', 'A CDN or scrubbing provider in front'],
      ['Defend an expensive endpoint', 'Rate limits, caching, a queue, a WAF rule'],
      ['Reduce the attack surface', 'Default-deny, private subnets, no public database'],
      ['Avoid trusting the network', 'Authenticate every request — zero trust'],
      ['Protect instance credentials', 'IMDSv2, roles not keys, egress rules'],
    ]),

    h('Interview'),
    asked([
      ['What is a man-in-the-middle attack and what stops it?', 'An attacker relaying between two parties; certificate validation in TLS stops it, encryption alone does not.'],
      ['How would you defend a public API against DDoS?', 'Absorb volumetric traffic at a CDN, rate limit per IP and key at layer 7, cache aggressively, and autoscale.'],
      ['Firewall vs WAF?', 'A firewall filters by IP, port and protocol; a WAF inspects the HTTP request itself.'],
      ['Security group vs firewall rule?', 'A security group is a stateful, instance-level allow-list — return traffic is automatic.'],
      ['Why is TLS enough on café WiFi?', 'Layer 2 and DNS can be spoofed freely, but a validated certificate means an interceptor cannot impersonate the server.'],
      ['What is zero trust?', 'Authenticating and authorising every request regardless of network location, rather than trusting anything inside a perimeter.'],
      ['What is SSRF and what is its network defence?', 'Tricking a server into fetching an internal URL such as the metadata endpoint; IMDSv2 and egress restrictions.'],
    ]),

    links(
      wiki('Man-in-the-middle_attack', 'Man-in-the-middle attack'),
      wiki('Denial-of-service_attack', 'Denial-of-service attack'),
      wiki('Zero_trust_security_model', 'Zero trust'),
    ),
  ],
};
