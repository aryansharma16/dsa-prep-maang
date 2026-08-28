import { asked, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'An **IP address** is where a machine sits in the network, written so that routers can aggregate it. IPv4 is 32 bits — four numbers 0–255, `192.168.1.7` — which allows about 4.3 billion addresses. That ran out, and the two responses to running out are the reason half of this page exists: **NAT** and **IPv6**.',
    ),

    h('The anatomy of an address'),
    p(
      'Every address is split into a **network part** and a **host part**, and the split is decided by the **subnet mask**. `10.0.1.7` with mask `255.255.255.0` (written `/24`) means: the first 24 bits are the network `10.0.1.0`, the last 8 identify the host on it. `subnetting-and-cidr` is that arithmetic in full — for now, `/24` means "the first three numbers are the neighbourhood".',
    ),
    code(
      sh(`
10.0.1.7 / 24
└──┬───┘ └┬┘
network  host      network 10.0.1.0, hosts .1 to .254
`),
    ),

    h('Public vs private'),
    p(
      'Three ranges are reserved for private networks. They are not routable on the internet — no ISP will forward them — so they can be reused by every home and every VPC on earth, which is what NAT then works around.',
    ),
    table(
      ['Range', 'CIDR', 'Size', 'Where you see it'],
      [
        ['`10.0.0.0` – `10.255.255.255`', '`10.0.0.0/8`', '16.7M', '**AWS VPCs**, corporate networks'],
        ['`172.16.0.0` – `172.31.255.255`', '`172.16.0.0/12`', '1M', 'Docker’s default bridge, some VPCs'],
        ['`192.168.0.0` – `192.168.255.255`', '`192.168.0.0/16`', '65k', 'Home routers'],
      ],
    ),
    note(
      'Your laptop’s `192.168.1.x` exists in millions of houses at once. Uniqueness is only required *within* one network, and NAT is what maps the whole house onto the single public address your ISP gave the router.',
    ),

    h('The special addresses'),
    table(
      ['Address', 'Means'],
      [
        ['`127.0.0.1` / `::1`', '**Loopback** — this machine. Traffic never leaves the kernel'],
        ['`0.0.0.0`', 'As a *bind* address: “every interface on this machine”. As a *route*: “everywhere else”'],
        ['`169.254.x.x`', '**Link-local** — self-assigned because DHCP failed. Seeing one means "I never got an address"'],
        ['`169.254.169.254`', 'The **cloud metadata service** — on AWS, where an instance reads its own role credentials'],
        ['`255.255.255.255`', 'Broadcast to everyone on this network'],
        ['`x.x.x.0` / `x.x.x.255` in a /24', 'Network address and broadcast address — not usable by a host'],
      ],
    ),
    warn(
      '`0.0.0.0` bites everyone once. Binding your dev server to `127.0.0.1` makes it unreachable from a container, a phone on the same WiFi, or the outside world; binding to `0.0.0.0` exposes it on **every** interface, which is right in a container and dangerous on a laptop in a café.',
    ),
    tip(
      'On an EC2 instance, `curl http://169.254.169.254/latest/meta-data/` prints the instance’s own metadata. That endpoint is also why SSRF is so dangerous in AWS — a server tricked into fetching a URL can fetch *that* one — and why IMDSv2, which requires a token, exists.',
    ),

    h('Static vs dynamic'),
    ul(
      '**Dynamic** — a DHCP server hands you an address on a lease. Every phone and laptop; the default for an EC2 instance too.',
      '**Static** — configured by hand. Servers, printers, routers: anything other machines must find at a fixed address.',
      '**Reserved / elastic** — assigned dynamically but always the same for you. AWS calls this an **Elastic IP**: a public address you own and can move between instances, which is how a failover keeps the same address.',
    ),

    h('IPv6, briefly'),
    p(
      'IPv6 is 128 bits, written as eight groups of hex: `2001:0db8:85a3:0000:0000:8a2e:0370:7334`, usually shortened by dropping leading zeros and collapsing one run of zero groups to `::`. The address space is large enough that the phrase people use — an address for every grain of sand — is an understatement.',
    ),
    table(
      ['', 'IPv4', 'IPv6'],
      [
        ['Size', '32 bits, 4.3 billion', '128 bits, 3.4 × 10³⁸'],
        ['Notation', '`192.168.1.1`', '`2001:db8::1`'],
        ['NAT', 'Universal, out of necessity', 'Not needed — every device can have a public address'],
        ['Address resolution', 'ARP', 'NDP (ICMPv6)'],
        ['Config', 'DHCP', 'SLAAC (self-configuring) or DHCPv6'],
        ['Fragmentation by routers', 'Allowed', 'Removed — sender does path MTU discovery'],
        ['Header', 'Variable length, checksum', 'Fixed 40 bytes, no checksum — faster to route'],
      ],
    ),
    p(
      'Adoption is slow because NAT worked well enough and IPv4 refuses to die. In practice you will run **dual stack** — both at once — and your code should never assume an address is four numbers. In Node, `req.socket.remoteAddress` can perfectly well hand you `::ffff:203.0.113.5`, an IPv4 address in IPv6 clothing, and code that splits on `.` breaks on it.',
    ),

    h('Seeing yours'),
    code(
      sh(`
ip addr                          # every interface and address (Linux)
ipconfig /all                    # Windows
curl ifconfig.me                 # the PUBLIC address the world sees you as
ip route get 1.1.1.1             # which interface and gateway would be used
`),
    ),
    p(
      'The gap between `ip addr` (a private `192.168.x.x`) and `curl ifconfig.me` (a public address) *is* NAT, and it is the next topic but one.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Give a machine an address in a VPC', '`10.0.0.0/8` — the private range AWS defaults to'],
      ['Bind a server so containers can reach it', '`0.0.0.0`, never `127.0.0.1`'],
      ['Recognise “DHCP failed”', 'A `169.254.x.x` address'],
      ['Read instance metadata on AWS', '`169.254.169.254` — and lock it down with IMDSv2'],
      ['Keep a fixed public address across restarts', 'An Elastic IP'],
      ['Handle a client IP safely in code', 'Accept IPv6 and IPv4-mapped forms; never parse by splitting on dots'],
    ]),

    h('Interview'),
    asked([
      ['Public vs private IP?', 'Private ranges (10/8, 172.16/12, 192.168/16) are not routed on the internet and are reused everywhere behind NAT.'],
      ['What is 127.0.0.1 versus 0.0.0.0?', 'Loopback — this machine only — versus “all interfaces” when binding, or “default route” in a routing table.'],
      ['What does a 169.254 address mean?', 'DHCP failed and the host self-assigned a link-local address.'],
      ['Why has IPv4 not run out in practice?', 'NAT lets a whole network share one public address, and CIDR made allocation efficient.'],
      ['What does IPv6 change besides size?', 'No NAT needed, NDP instead of ARP, autoconfiguration, a fixed simpler header, no router fragmentation.'],
      ['What is an Elastic IP?', 'A public IPv4 address you own and can reattach to another instance — a stable address across failover.'],
    ]),

    links(
      wiki('IP_address', 'IP address'),
      wiki('Private_network', 'Private network'),
      wiki('IPv6', 'IPv6'),
    ),
  ],
};
