import { asked, awsDoc, cheat, code, h, links, note, p, sh, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'One request, from a browser to your container, named service by service. This is the topic that turns everything before it into an architecture you could draw on a whiteboard — and “walk me through what happens when a user hits your app” is a standard question for anyone claiming AWS experience.',
    ),

    h('The path'),
    code(
      sh(`
browser
  |  1. DNS: app.example.com  ->  Route 53
  v
CloudFront (optional CDN)        cache hit? done. TLS terminated here (cert in us-east-1)
  |  2. miss -> origin
  v
Application Load Balancer        TLS terminated (cert from ACM), routes on path/host
  |  3. picks a healthy target
  v
Target group -> ECS task / EC2 / Lambda      in a PRIVATE subnet
  |  4.
  v
RDS / ElastiCache / S3           private subnet or a VPC endpoint
`),
    ),

    h('Each box, and what it is for'),
    table(
      ['Service', 'Is', 'The one thing to know'],
      [
        ['**Route 53**', 'DNS', 'Use an **ALIAS** record at the apex; health checks give you failover'],
        ['**ACM**', 'Certificates', 'Free and auto-renewing — but **CloudFront needs the cert in `us-east-1`**'],
        ['**CloudFront**', 'CDN', 'Caches at the edge, absorbs spikes and DDoS, terminates TLS near the user'],
        ['**ALB**', 'L7 load balancer', 'Path and host routing, WebSockets, health checks, one target group per service'],
        ['**NLB**', 'L4 load balancer', 'Raw TCP/UDP, **static IPs**, extreme throughput'],
        ['**API Gateway**', 'Managed API front end', 'Auth, throttling, per-route keys — heavier and pricier than an ALB'],
        ['**WAF**', 'L7 firewall', 'Attaches to CloudFront, ALB or API Gateway'],
        ['**Target group**', 'The pool behind a listener', 'Where the port mapping and health check live'],
      ],
    ),

    h('ALB or NLB'),
    table(
      ['Choose ALB when', 'Choose NLB when'],
      [
        ['It is HTTP or HTTPS', 'It is not HTTP — a database proxy, MQTT, raw TCP'],
        ['You want path or host routing', 'You need a **static IP** for a partner’s allowlist'],
        ['You want WAF, auth or sticky cookies', 'You need extreme throughput or very low latency'],
        ['You want redirects and fixed responses at the edge', 'You need TLS passthrough — the balancer must not decrypt'],
      ],
    ),
    tip(
      'The default answer is the ALB, and saying so with the reason is better than hedging: it speaks HTTP, so it can route on path, run health checks that mean something, and terminate TLS. Reach for an NLB when one of the four things in the right column is a hard requirement.',
    ),

    h('Where TLS is terminated, and why it matters'),
    ul(
      '**CloudFront** terminates first, near the user. That is where the handshakes get cheap.',
      '**The ALB** terminates the second hop, with an ACM certificate. Behind it, plain HTTP to the container is normal and safe — it is inside your VPC.',
      'Your app therefore sees `http://` and must read **`X-Forwarded-Proto`** to know the user was on HTTPS. Get this wrong and you get redirect loops and cookies that refuse to set `Secure`.',
      'If the network between the ALB and the app must also be encrypted — a regulated environment — use **re-encryption**: HTTPS to the target as well.',
    ),
    warn(
      'The `us-east-1` rule for CloudFront certificates catches everyone once. Your app is in `eu-west-1`, the ALB certificate is in `eu-west-1`, and CloudFront refuses to see it — because CloudFront is a global service whose certificates live in North Virginia. Two certificates for one domain is the normal, correct outcome.',
    ),

    h('A concrete listener setup'),
    code(
      sh(`
ALB listener :80
  -> redirect to HTTPS, 301                      (a fixed action, no target needed)

ALB listener :443  (cert: ACM *.example.com)
  rule 1: host app.example.com, path /api/*  ->  tg-api      (ECS, port 3000)
  rule 2: host app.example.com, path /*      ->  tg-web      (ECS, port 8080)
  rule 3: default                            ->  fixed 404

tg-api   health check GET /health   30s   2 healthy / 2 unhealthy
         deregistration delay 30s
`),
    ),
    p(
      'Two things in there are worth copying. The port-80 listener redirects rather than serving, so plain HTTP never reaches your app. And both services sit under **one hostname on different paths**, which means the browser sees a single origin — no CORS between your frontend and your API.',
    ),

    h('Where Lambda and API Gateway fit'),
    p(
      'A Lambda can sit behind an ALB, behind API Gateway, or behind a Function URL. The choice is not about networking so much as about what you want managed:',
    ),
    table(
      ['Front', 'Gives you', 'Costs'],
      [
        ['**ALB → Lambda**', 'Same routing as your containers, cheap at volume', 'No API keys, no per-route throttling'],
        ['**API Gateway**', 'Auth, usage plans, throttling, request validation, WebSocket APIs', 'More expensive; another set of concepts'],
        ['**Function URL**', 'A URL, instantly', 'Almost no features — good for webhooks and internal tools'],
      ],
    ),
    note(
      'A Lambda **outside** a VPC has ordinary internet access. Put it **inside** one — to reach RDS — and it inherits the private subnet’s rules: it now needs a NAT gateway or VPC endpoints for anything outbound, including the AWS APIs. That surprise is a very common “my Lambda started timing out” story.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Point a domain at an ALB', 'A Route 53 **ALIAS** record — works at the apex, free queries'],
      ['Get free certificates', 'ACM — and a second one in `us-east-1` for CloudFront'],
      ['Route `/api` and `/` to different services', 'ALB listener rules with two target groups'],
      ['Force HTTPS', 'A port-80 listener that redirects 301'],
      ['Know the user was on HTTPS', '`X-Forwarded-Proto`'],
      ['Get a static IP for a partner allowlist', 'An NLB'],
      ['Cache and absorb spikes', 'CloudFront in front of the ALB'],
      ['Deploy without dropping requests', 'Deregistration delay plus graceful shutdown'],
    ]),

    h('Interview'),
    asked([
      ['Trace a request through an AWS stack.', 'Route 53 resolves to CloudFront or the ALB, TLS terminates there, the ALB picks a healthy target in a private subnet, which queries RDS or the cache.'],
      ['ALB vs NLB?', 'L7 with path/host routing and TLS termination versus L4 with static IPs, raw TCP and higher throughput.'],
      ['Where should TLS terminate?', 'At the edge — CloudFront or the ALB — with re-encryption to targets only when the internal hop must be encrypted too.'],
      ['Why do I need two certificates for one domain?', 'CloudFront only accepts certificates issued in us-east-1; the regional ALB uses one in its own region.'],
      ['How does the app know the user used HTTPS?', 'The X-Forwarded-Proto header added by the load balancer.'],
      ['ALB or API Gateway in front of Lambda?', 'ALB for cheap consistent routing alongside containers; API Gateway when you need auth, throttling or usage plans.'],
      ['Why did my Lambda lose internet access?', 'Putting it in a VPC means private-subnet rules apply — it needs a NAT gateway or VPC endpoints.'],
    ]),

    links(
      awsDoc('elasticloadbalancing/latest/application/introduction.html', 'Application Load Balancer'),
      awsDoc('AmazonCloudFront/latest/DeveloperGuide/Introduction.html', 'Amazon CloudFront'),
      awsDoc('Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html', 'Alias vs non-alias records'),
    ),
  ],
};
