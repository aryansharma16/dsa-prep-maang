import { cheat, code, h, links, p, sh, table, wiki } from '../blocks.js';

/*
  The revision page: every table in the track, in one place, with nothing new
  in it. Deliberately almost all tables and almost no prose — this is the page
  you open an hour before an interview, and prose is not what that hour is for.
*/
export const doc = {
  blocks: [
    p(
      'Everything in the track worth having in your head, as tables. Nothing new is taught here — each table is lifted from the topic that explains it, so if a row surprises you, that topic is the one to reread.',
    ),

    h('The layers'),
    table(
      ['OSI', 'Layer', 'Protocols', 'Device', 'Unit'],
      [
        ['7', 'Application', 'HTTP, DNS, SSH, SMTP, gRPC', 'Gateway, WAF', 'Message'],
        ['6', 'Presentation', 'TLS, JPEG, UTF-8', '—', 'Message'],
        ['5', 'Session', 'TLS sessions, RPC', '—', 'Message'],
        ['4', 'Transport', '**TCP, UDP**, QUIC', 'L4 load balancer (NLB)', 'Segment / datagram'],
        ['3', 'Network', '**IP**, ICMP, BGP', '**Router**', 'Packet'],
        ['2', 'Data link', 'Ethernet, WiFi, ARP', '**Switch**', 'Frame'],
        ['1', 'Physical', 'Cables, fibre, radio', 'Hub, repeater', 'Bits'],
      ],
    ),
    p('TCP/IP collapses this to four: Application (7–5), Transport (4), Internet (3), Link (2–1).'),

    h('Ports'),
    table(
      ['Port', 'Service', 'Port', 'Service'],
      [
        ['20 / 21', 'FTP data / control', '443', '**HTTPS**'],
        ['**22**', '**SSH, SFTP**', '465 / 587', 'SMTP over TLS / submission'],
        ['**25**', 'SMTP', '636', 'LDAPS'],
        ['**53**', '**DNS**', '**3306**', '**MySQL**'],
        ['67 / 68', 'DHCP server / client', '3389', 'RDP'],
        ['**80**', '**HTTP**', '**5432**', '**PostgreSQL**'],
        ['110 / 995', 'POP3 / POP3S', '5672', 'AMQP / RabbitMQ'],
        ['123', 'NTP', '**6379**', '**Redis**'],
        ['143 / 993', 'IMAP / IMAPS', '8080', 'HTTP alternate'],
        ['161', 'SNMP', '9200', 'Elasticsearch'],
        ['389', 'LDAP', '27017', 'MongoDB'],
      ],
    ),
    p('Ranges: **0–1023** well-known (root to bind), **1024–49151** registered, **49152–65535** ephemeral.'),

    h('TCP vs UDP'),
    table(
      ['', 'TCP', 'UDP'],
      [
        ['Connection', 'Handshake first', 'None'],
        ['Reliable / ordered', 'Yes / yes', 'No / no'],
        ['Flow + congestion control', 'Yes', 'No'],
        ['Header', '20 bytes', '8 bytes'],
        ['Model', 'Byte stream', 'Messages'],
        ['Used by', 'HTTP/1.1 & /2, SSH, SMTP, databases', 'DNS, DHCP, NTP, media, **QUIC → HTTP/3**'],
      ],
    ),
    p('Open: **SYN, SYN-ACK, ACK**. Close: **FIN, ACK, FIN, ACK**, then `TIME_WAIT` on the side that closed last.'),

    h('HTTP status codes'),
    table(
      ['Code', 'Means', 'Code', 'Means'],
      [
        ['101', 'Switching Protocols — WebSocket', '**404**', 'Not Found'],
        ['**200**', 'OK', '409', 'Conflict'],
        ['**201**', 'Created — send `Location`', '422', 'Unprocessable — validation'],
        ['204', 'No Content', '**429**', 'Too Many Requests — send `Retry-After`'],
        ['301 / 308', 'Moved permanently', '**500**', 'Internal Server Error'],
        ['302 / 307', 'Moved temporarily', '**502**', 'Bad Gateway — upstream broken'],
        ['**304**', 'Not Modified — cached copy is fine', '**503**', 'Service Unavailable — no healthy target'],
        ['**401**', 'Unauthenticated', '**504**', 'Gateway Timeout — upstream too slow'],
        ['**403**', 'Authenticated, not allowed', '', ''],
      ],
    ),

    h('HTTP methods'),
    table(
      ['Method', 'Safe', 'Idempotent', 'Body'],
      [
        ['`GET`', 'Yes', 'Yes', 'No'],
        ['`HEAD`', 'Yes', 'Yes', 'No'],
        ['`OPTIONS`', 'Yes', 'Yes', 'No'],
        ['`POST`', 'No', '**No**', 'Yes'],
        ['`PUT`', 'No', 'Yes', 'Yes'],
        ['`PATCH`', 'No', 'Not necessarily', 'Yes'],
        ['`DELETE`', 'No', 'Yes', 'Rarely'],
      ],
    ),

    h('HTTP versions'),
    table(
      ['Version', 'Transport', 'Added'],
      [
        ['1.0', 'TCP', 'One request per connection'],
        ['**1.1**', 'TCP', 'Keep-alive, `Host` — one request at a time per connection'],
        ['**2**', 'TCP', 'Multiplexed streams, binary framing, HPACK header compression'],
        ['**3**', '**QUIC / UDP**', 'Per-stream ordering, TLS 1.3 built in, 0-RTT, connection migration'],
      ],
    ),

    h('DNS record types'),
    table(
      ['Type', 'Maps to', 'Type', 'Maps to'],
      [
        ['**A**', 'IPv4 address', '**NS**', 'Authoritative nameservers'],
        ['**AAAA**', 'IPv6 address', 'SOA', 'Zone metadata'],
        ['**CNAME**', 'Another name — never at the apex', 'PTR', 'IP → name (reverse)'],
        ['ALIAS', 'Provider record; CNAME-like **at the apex**', 'SRV', 'Host **and port** for a service'],
        ['**MX**', 'Mail servers, with priority', 'CAA', 'Who may issue certificates'],
        ['**TXT**', 'Free text — SPF, DKIM, verification', '', ''],
      ],
    ),
    p('Resolution: browser → OS → router → recursive resolver → **root → TLD → authoritative**. UDP 53, TCP when >512 bytes.'),

    h('Private address ranges'),
    table(
      ['Range', 'CIDR', 'Where'],
      [
        ['10.0.0.0 – 10.255.255.255', '`10.0.0.0/8`', 'VPCs, corporate networks'],
        ['172.16.0.0 – 172.31.255.255', '`172.16.0.0/12`', 'Docker default bridge'],
        ['192.168.0.0 – 192.168.255.255', '`192.168.0.0/16`', 'Home networks'],
        ['127.0.0.1', '`127.0.0.0/8`', 'Loopback'],
        ['169.254.0.0 – 169.254.255.255', '`169.254.0.0/16`', 'Link-local — **DHCP failed**; `.169.254` is cloud metadata'],
      ],
    ),

    h('CIDR'),
    table(
      ['CIDR', 'Mask', 'Addresses', 'Usable', 'On AWS'],
      [
        ['`/32`', '255.255.255.255', '1', '1', '1'],
        ['`/29`', '255.255.255.248', '8', '6', '3'],
        ['`/28`', '255.255.255.240', '16', '14', '11'],
        ['`/27`', '255.255.255.224', '32', '30', '27'],
        ['`/26`', '255.255.255.192', '64', '62', '59'],
        ['`/24`', '255.255.255.0', '256', '254', '251'],
        ['`/20`', '255.255.240.0', '4,096', '4,094', '4,091'],
        ['`/16`', '255.255.0.0', '65,536', '65,534', '65,531'],
      ],
    ),
    p('Usable = 2^(32−prefix) − 2 (network + broadcast); AWS reserves **five** per subnet.'),

    h('Latency numbers'),
    table(
      ['Operation', 'Time'],
      [
        ['L1 cache', '1 ns'],
        ['Main memory', '100 ns'],
        ['SSD random read', '~100 µs'],
        ['**Round trip in a data centre**', '**0.5 ms**'],
        ['Round trip within a region', '1–5 ms'],
        ['**Round trip cross-country**', '**10–20 ms**'],
        ['**Round trip transatlantic**', '**70–90 ms**'],
        ['**Round trip halfway round the world**', '**200–300 ms**'],
      ],
    ),
    p('Cold HTTPS request ≈ **4 round trips**: DNS + TCP + TLS 1.3 + the request itself.'),

    h('Cache-Control'),
    table(
      ['Directive', 'Means'],
      [
        ['`max-age=N`', 'Fresh for N seconds, anywhere'],
        ['`s-maxage=N`', 'Fresh for N seconds in **shared** caches only'],
        ['`public` / `private`', 'Shared caches may store / **browser only**'],
        ['`no-cache`', '**Store, but revalidate every time**'],
        ['`no-store`', 'Never store it at all'],
        ['`immutable`', 'Do not even revalidate on refresh'],
        ['`stale-while-revalidate=N`', 'Serve stale, refresh in the background'],
        ['`Vary: <header>`', 'These request headers are part of the cache key'],
      ],
    ),

    h('AWS networking'),
    table(
      ['Concept', 'AWS', 'Note'],
      [
        ['Private network', 'VPC', 'Pick a `/16`, never overlapping'],
        ['Network segment', 'Subnet', 'Lives in exactly **one** AZ'],
        ['Router', 'Route table', 'Always static; `0.0.0.0/0 → IGW` **is** what makes a subnet public'],
        ['Internet access both ways', 'Internet gateway', 'Free'],
        ['Outbound only', 'NAT gateway', 'Hourly **plus per GB** — the surprise bill'],
        ['Host firewall', 'Security group', '**Stateful**, allow-only, can reference another SG'],
        ['Subnet firewall', 'Network ACL', '**Stateless**, allow + deny, needs ephemeral return ports'],
        ['L7 load balancer', 'ALB', 'Path/host routing, TLS termination, WebSockets'],
        ['L4 load balancer', 'NLB', 'Static IPs, raw TCP/UDP, passthrough'],
        ['DNS', 'Route 53', 'ALIAS at the apex; health checks + latency routing for failover'],
        ['Certificates', 'ACM', 'Free; **CloudFront needs `us-east-1`**'],
        ['Private service access', 'VPC endpoint', 'S3 and DynamoDB gateway endpoints are **free**'],
      ],
    ),

    h('Debugging'),
    table(
      ['Question', 'Command'],
      [
        ['Does the name resolve?', '`dig name +short`, `dig @ns name`'],
        ['Is the host reachable?', '`ping -c 5 host`'],
        ['Where does the path stop?', '`mtr host`'],
        ['Is the port open?', '`nc -zv host port`'],
        ['Does the app answer?', '`curl -v url`'],
        ['Where did the time go?', '`curl -w` — dns / connect / tls / ttfb'],
        ['What is listening here?', '`ss -lntp`'],
        ['Which states are the sockets in?', '`ss -s`'],
        ['Did the packets arrive?', '`sudo tcpdump -i any -n port N`'],
      ],
    ),
    table(
      ['Symptom', 'Means'],
      [
        ['**Refused**', 'Host reached, nothing listening — check the process and bind address'],
        ['**Timeout**', 'Dropped — firewall, security group, NACL, route'],
        ['**Reset**', 'Torn down mid-connection — crash or proxy timeout'],
        ['**502**', 'Upstream gave a bad answer'],
        ['**503**', 'No healthy targets'],
        ['**504**', 'Upstream too slow'],
        ['`169.254.x.x`', 'DHCP failed'],
        ['Fails at exactly 60 s', 'An idle timeout owns that number'],
        ['Only large requests fail', 'Path MTU'],
      ],
    ),

    h('The one-liners'),
    code(
      sh(`
IP stays the same end to end; MAC changes at every hop.
A subnet is public because its route table points 0.0.0.0/0 at an internet gateway.
Refused means you got there. Timeout means you did not.
no-cache stores and revalidates; no-store never writes it down.
Longest prefix wins.
Smaller CIDR number = bigger network.
502 = bad answer. 504 = no answer.
Bandwidth is the width of the road; latency is its length.
It's always DNS.
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Revise the layers', 'Please Do Not Throw Sausage Pizza Away'],
      ['Quote ports', '22, 53, 80, 443, 3306, 5432, 6379'],
      ['Quote status codes', '200, 201, 204, 301, 304, 401, 403, 404, 429, 500, 502, 503, 504'],
      ['Quote a latency', '0.5 ms in a data centre, 70 ms transatlantic, 250 ms antipodean'],
      ['Size a subnet', '`/24` = 251 usable on AWS'],
      ['Name the AWS box', 'VPC, subnet, route table, IGW, NAT, SG, NACL, ALB, Route 53'],
    ]),

    links(
      wiki('Internet_protocol_suite', 'Internet protocol suite'),
      wiki('List_of_TCP_and_UDP_port_numbers', 'Port numbers'),
      wiki('List_of_HTTP_status_codes', 'HTTP status codes'),
    ),
  ],
};
