import { asked, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Debugging a network problem is a process of elimination up the layers, and each tool answers exactly one question. Knowing which question each answers — and running them in the right order — turns “the site is down” into a specific broken thing in about ninety seconds.',
    ),

    h('The order to reach for them'),
    table(
      ['#', 'Question', 'Tool'],
      [
        ['1', 'Does the name resolve?', '`dig`'],
        ['2', 'Is the host reachable?', '`ping`'],
        ['3', 'Where does the path stop?', '`traceroute` / `mtr`'],
        ['4', 'Is the port open?', '`nc -zv`'],
        ['5', 'Does the app answer correctly?', '`curl -v`'],
        ['6', 'What is listening here?', '`ss -lntp`'],
        ['7', 'What is actually on the wire?', '`tcpdump`'],
      ],
    ),
    tip(
      'Start at the layer you doubt, not at the bottom. If `curl` returns a 502, DNS and TCP obviously worked — skip to the application. The list is an order of *elimination*, not a ritual.',
    ),

    h('dig — what DNS really says'),
    code(
      sh(`
dig example.com +short              # just the answer
dig example.com MX                  # a specific record type
dig example.com +trace              # the full walk: root -> TLD -> authoritative
dig @8.8.8.8 example.com            # what a public resolver sees
dig @ns1.example.com example.com    # what the AUTHORITATIVE server says — the truth
`),
    ),
    p(
      'The last two together settle every "my DNS change has not taken effect" argument: if the authoritative server has the new value and the public resolver has the old one, you are waiting on TTL and nothing is wrong. `nslookup` does the same job with worse output; `dig` is the one to learn.',
    ),

    h('ping — reachability and round-trip time'),
    code(
      sh(`
ping -c 5 example.com
ping -c 100 -i 0.2 host | tail -3     # loss percentage over a burst
`),
    ),
    warn(
      '**No reply does not mean the host is down.** Ping is ICMP, and huge numbers of hosts and firewalls drop ICMP as policy — AWS security groups block it by default. A failed ping is weak evidence; a successful one is strong evidence. Never conclude "the server is down" from ping alone.',
    ),

    h('traceroute and mtr — where the path stops'),
    code(
      sh(`
traceroute example.com
mtr example.com                       # traceroute + ping, continuously, per hop
`),
    ),
    p(
      '`mtr` is the better tool and fewer people know it: it shows **loss and latency per hop, updating live**, which is how you tell "hop 6 is congested" from "hop 6 does not answer ICMP but forwards fine". Loss at one hop that disappears at later hops is the second one — the hop is rate-limiting its own replies, not dropping your traffic.',
    ),

    h('nc and curl — is the port open, is the app alive'),
    code(
      sh(`
nc -zv api.example.com 443            # -z scan only, -v say what happened
nc -zv -w 3 db.internal 5432          # with a 3s timeout

curl -v https://api.example.com/health
curl -I https://example.com                          # headers only
curl -s -o /dev/null -w '%{http_code} %{time_total}s\\n' https://example.com
curl --resolve example.com:443:10.0.1.5 https://example.com/   # bypass DNS
`),
    ),
    p(
      'That last flag is worth remembering: it lets you test a **specific server** by name — right `Host` header, right certificate name — before DNS points at it. It is how you verify a new instance ahead of a cutover.',
    ),
    note(
      'The three outcomes of `nc` are the most informative signal in this list. **Connected** — path and process both fine. **Refused** — you reached the host, nothing is listening. **Timed out** — packets are being dropped, so look at a firewall, security group or route.',
    ),

    h('ss — what is happening on this machine'),
    code(
      sh(`
ss -lntp                    # LISTENING TCP sockets, with the process
ss -tan state established | wc -l          # how many open connections
ss -s                                      # summary by state
lsof -i :3000                              # who holds port 3000
`),
    ),
    p(
      '`ss` replaced `netstat` and is faster on a busy machine. The three answers you want from it: *is my app actually listening*, *on which address* (`127.0.0.1` versus `0.0.0.0` — the cause of half of all "works locally" bugs), and *how many connections are open and in which state* — which is how the `CLOSE_WAIT` and `TIME_WAIT` diagnoses from `tcp-handshake` are made.',
    ),

    h('tcpdump — the last resort, and sometimes the only answer'),
    code(
      sh(`
sudo tcpdump -i any -n port 443 and host 10.0.1.5
sudo tcpdump -i any -n 'tcp[tcpflags] & (tcp-syn|tcp-rst) != 0'   # SYNs and RSTs only
sudo tcpdump -i any -w capture.pcap port 5432                     # for Wireshark
`),
    ),
    p(
      'Reach for it when the higher-level tools disagree with each other — when the client says timeout and the server’s logs show nothing, `tcpdump` on both ends tells you whether the packets ever arrived. It answers the one question nothing else can: **did the traffic get here at all?**',
    ),

    h('And the one you already have open'),
    p('The browser devtools **Network** tab is a first-class debugging tool and it answers questions the command line makes hard:'),
    ul(
      'The **Timing** panel splits a request into DNS, connect, TLS, waiting (server) and download — the same breakdown as `curl -w`, per request, for free.',
      'The **Protocol** column (right-click the headers to add it) shows `h2`/`h3`, so you can see what your CDN is actually negotiating.',
      '`Status` plus the response headers tells you whether a CORS failure was a missing header or a preflight rejection.',
      'Disable cache, throttle to Slow 3G, and watch the waterfall — most “slow page” problems are visible in ten seconds here.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Check DNS truthfully', '`dig @authoritative-ns name`'],
      ['Check reachability', '`ping` — but a failure proves little'],
      ['Find where the path breaks', '`mtr`'],
      ['Check a port', '`nc -zv host port`'],
      ['Check the app', '`curl -v`, or `-w` for timings'],
      ['Test a server before DNS moves', '`curl --resolve`'],
      ['See listeners and connection states', '`ss -lntp`, `ss -s`'],
      ['Prove packets arrived', '`tcpdump` on both ends'],
    ]),

    h('Interview'),
    asked([
      ['A service is unreachable — what do you run first?', 'dig to check the name, then ping or nc to see whether the host and port answer, then curl for the application.'],
      ['Why is a failed ping weak evidence?', 'ICMP is widely blocked by firewalls and security groups; the host may be perfectly healthy.'],
      ['How do you check what DNS really returns?', 'dig against the authoritative nameserver, and against a public resolver to see the cached view.'],
      ['How do you tell a firewall from a stopped process?', 'Refused means the packet arrived and nothing listened; a timeout means it was dropped.'],
      ['How do you find what is listening on a port?', '`ss -lntp` or `lsof -i :port`.'],
      ['When would you use tcpdump?', 'When the two ends disagree — to prove whether packets arrived at all.'],
    ]),

    links(
      wiki('Ping_(networking_utility)', 'ping'),
      wiki('Traceroute', 'traceroute'),
      wiki('Tcpdump', 'tcpdump'),
    ),
  ],
};
