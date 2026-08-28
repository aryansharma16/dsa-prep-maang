import { asked, awsDoc, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The one topic in the track with arithmetic in it, and the only place the
  ceiling was hard to set: a network engineer drills subnet maths, a developer
  needs to read /24 confidently, size a VPC and never be surprised by five
  reserved addresses. So: the powers of two, one worked VPC split, and stop.
*/
export const doc = {
  blocks: [
    p(
      'A **subnet** is a slice of an address range that behaves as one network: everything inside it can talk directly, and anything outside it goes through a router. **CIDR notation** — the `/24` in `10.0.1.0/24` — is how you write the size of that slice. This is the one piece of arithmetic in the track, and you need it every time you create a VPC.',
    ),

    h('What the slash means'),
    p(
      'The number after the slash is **how many bits are fixed as the network**. The rest are free for hosts. `/24` means 24 bits fixed, 8 bits free, so 2⁸ = 256 addresses.',
    ),
    code(
      sh(`
10.0.1.0/24
10.0.1.xxxxxxxx        24 bits fixed, 8 free
                       range: 10.0.1.0  ->  10.0.1.255      (256 addresses)

10.0.0.0/16
10.0.xxxxxxxx.xxxxxxxx 16 bits fixed, 16 free
                       range: 10.0.0.0  ->  10.0.255.255    (65,536 addresses)
`),
    ),
    tip(
      '**Smaller number = bigger network.** `/8` is enormous, `/32` is one address. It counts fixed bits, not hosts, and that inversion is the only thing that trips people up.',
    ),

    h('The table to memorise'),
    table(
      ['CIDR', 'Mask', 'Addresses', 'Usable (normal)', 'Usable (AWS)'],
      [
        ['`/32`', '255.255.255.255', '1', '1 — a single host', '1'],
        ['`/29`', '255.255.255.248', '8', '6', '3'],
        ['`/28`', '255.255.255.240', '16', '14', '11'],
        ['`/27`', '255.255.255.224', '32', '30', '27'],
        ['`/26`', '255.255.255.192', '64', '62', '59'],
        ['`/24`', '255.255.255.0', '256', '254', '251'],
        ['`/20`', '255.255.240.0', '4,096', '4,094', '4,091'],
        ['`/16`', '255.255.0.0', '65,536', '65,534', '65,531'],
      ],
    ),
    p(
      'Two subtractions to remember. Normally you lose **two** addresses per subnet: the first is the *network address* and the last is the *broadcast address*. On AWS you lose **five**: those two plus the VPC router, the DNS resolver, and one reserved for future use. A `/28` on AWS gives you eleven usable IPs, which is a genuinely common surprise when a subnet fills up.',
    ),

    h('Reading one without a calculator'),
    p('Three tricks cover almost everything you will meet:'),
    ul(
      '**Powers of two, backwards from /32.** `/32` is 1 address, `/31` is 2, `/30` is 4, `/29` is 8, `/28` is 16 — each step down doubles.',
      '**The friendly boundaries.** `/8`, `/16` and `/24` fall exactly on the dots: `10.0.0.0/8` is “anything starting 10.”, `/16` is “10.0.”, `/24` is “10.0.1.”.',
      '**Blocks within an octet.** A `/26` splits an octet into four blocks of 64: `.0–.63`, `.64–.127`, `.128–.191`, `.192–.255`. A `/28` splits it into sixteen blocks of 16. Ask "which block does this address land in" rather than doing binary arithmetic.',
    ),
    code(
      sh(`
Is 10.0.1.130 inside 10.0.1.128/26?

/26 -> blocks of 64 -> 128 starts a block covering .128 to .191
130 is in that range  ->  yes
`),
    ),

    h('Why subnet at all'),
    ul(
      '**Isolation.** A database subnet with no route to the internet cannot be reached from it, whatever your application code does. This is the single biggest security win in a cloud network.',
      '**Blast radius.** A broadcast storm or a misconfigured host affects one subnet, not everything.',
      '**Routing and availability.** On AWS a subnet lives in exactly one **availability zone**, so subnets are how you spread across zones. That constraint is what shapes the layout below.',
    ),

    h('A VPC, split the way it is actually done'),
    p(
      'Give the VPC a `/16` — 65,536 addresses, far more than you need, and there is no charge for unused private space. Then carve a `/20` per subnet, two subnets per zone, three zones:',
    ),
    table(
      ['Subnet', 'CIDR', 'Zone', 'Holds'],
      [
        ['public-a', '`10.0.0.0/20`', 'eu-west-1a', 'Load balancer, NAT gateway, bastion'],
        ['public-b', '`10.0.16.0/20`', 'eu-west-1b', 'Load balancer'],
        ['public-c', '`10.0.32.0/20`', 'eu-west-1c', 'Load balancer'],
        ['private-a', '`10.0.48.0/20`', 'eu-west-1a', 'App servers, containers, Lambdas'],
        ['private-b', '`10.0.64.0/20`', 'eu-west-1b', 'App servers'],
        ['private-c', '`10.0.80.0/20`', 'eu-west-1c', 'App servers, RDS'],
      ],
    ),
    p(
      'That is six subnets of 4,091 usable addresses each, using `10.0.0.0/20` through `10.0.80.0/20` and leaving most of the `/16` free for the subnets you have not thought of yet. **Leave room.** Resizing a subnet later means recreating it, and everything in it.',
    ),
    warn(
      'Never overlap CIDR ranges between networks you might one day connect. Two VPCs that are both `10.0.0.0/16` **cannot be peered**, and the fix is rebuilding one of them. Pick a scheme up front — `10.0.0.0/16` for production, `10.1.0.0/16` for staging, `10.2.0.0/16` for the office VPN — and write it down.',
    ),
    note(
      '`0.0.0.0/0` means **every address** — zero bits fixed. You will meet it constantly as “the default route” in a route table and as “from anywhere” in a security group rule. In the second place it deserves a second look.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Size a VPC', '`/16` — plenty of room, costs nothing'],
      ['Size a subnet', '`/20` or `/24`, one per availability zone'],
      ['Count usable hosts', '2^(32−prefix) − 2, and − 5 on AWS'],
      ['Say “one specific host”', '`/32`'],
      ['Say “anywhere”', '`0.0.0.0/0`'],
      ['Check whether an address is in a range', 'Find the block: `/26` is blocks of 64, `/28` blocks of 16'],
      ['Avoid a peering disaster', 'Non-overlapping ranges per environment, decided on day one'],
    ]),

    h('Interview'),
    asked([
      ['What does /24 mean?', '24 bits are the network prefix, leaving 8 host bits — 256 addresses, 254 usable.'],
      ['How many usable hosts in a /26?', '64 addresses, 62 usable — 59 on AWS, which reserves five per subnet.'],
      ['Why subnet a network at all?', 'Isolation, smaller broadcast domains and blast radius, and per-zone routing in the cloud.'],
      ['What is 0.0.0.0/0?', 'Every address — the default route, or “from anywhere” in a firewall rule.'],
      ['How would you lay out a VPC?', 'A /16 VPC, a public and a private /20 subnet in each of three availability zones, with room left over.'],
      ['Why must VPC CIDRs not overlap?', 'Overlapping ranges cannot be peered or routed between — the addresses would be ambiguous.'],
    ]),

    links(
      wiki('Classless_Inter-Domain_Routing', 'CIDR'),
      wiki('Subnetwork', 'Subnetwork'),
      awsDoc('vpc/latest/userguide/subnet-sizing.html', 'Subnet sizing in a VPC'),
    ),
  ],
};
