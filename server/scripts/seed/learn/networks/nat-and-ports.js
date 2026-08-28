import { asked, awsDoc, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Your laptop has a private address like `192.168.1.42`, which no router on the internet will carry. Yet you browse the web. The box doing that is **NAT** — network address translation — and it works by rewriting addresses in packets as they pass through, keeping a table so it can rewrite the replies back.',
    ),

    h('The translation, in one table'),
    p(
      'Strictly this is **PAT** — port address translation, also called NAT overload — because the port number is what makes many machines fit behind one address. Everyone calls it NAT.',
    ),
    code(
      sh(`
Laptop  192.168.1.42:51000  ->  github.com:443
Router rewrites the source and remembers:

  inside                 outside                      destination
  192.168.1.42:51000  <-> 203.0.113.5:40001   <->   140.82.121.4:443
  192.168.1.51:51000  <-> 203.0.113.5:40002   <->   140.82.121.4:443
  192.168.1.42:51001  <-> 203.0.113.5:40003   <->   1.1.1.1:443

Reply arrives for 203.0.113.5:40001 -> table says 192.168.1.42:51000 -> forwarded.
`),
    ),
    p(
      'Two machines can even pick the same source port — the router allocates a different outside port for each, and the table keeps them apart. That is the whole mechanism: **rewrite on the way out, reverse it on the way back**.',
    ),

    h('Why it exists, and what it accidentally became'),
    ul(
      '**The reason:** IPv4 addresses ran out. NAT let an ISP give a household one address instead of forty.',
      '**The side effect:** nothing outside can start a connection *inwards*, because there is no table entry until you create one by going out first. People call this a firewall. **It is not a firewall** — it is an absence of a route back — but in practice it is why your laptop is not portscanned all day.',
      '**The cost:** true end-to-end addressing is gone. Peer-to-peer, VoIP, and gaming all need workarounds (STUN, TURN, UPnP, hole punching) that exist purely because of NAT.',
    ),
    note(
      'IPv6 has enough addresses that NAT is unnecessary — every device can hold a public address. The security people liked about NAT is then provided properly, by a stateful firewall that says “no unsolicited inbound”.',
    ),

    h('Getting traffic back in: port forwarding'),
    p(
      'To run a game server or a webcam at home you must add a **static** entry yourself: "anything arriving on my public address port 25565, send to `192.168.1.50:25565`". That is port forwarding, and it is the manual version of the row NAT normally creates automatically.',
    ),
    table(
      ['Want', 'Mechanism'],
      [
        ['Outbound from many devices on one public IP', 'NAT/PAT — automatic'],
        ['Inbound to one specific device', '**Port forwarding** — configured by hand'],
        ['Inbound to whichever device asks', 'UPnP — convenient, and a known security hole'],
        ['Two peers behind separate NATs', 'STUN to discover addresses, TURN to relay when hole punching fails'],
      ],
    ),

    h('The same idea in AWS, with different names'),
    p(
      'This is where NAT stops being trivia and starts being a bill. In a VPC there are two gateways with confusingly similar names, and the difference is exactly the direction traffic can start in:',
    ),
    table(
      ['', 'Internet gateway (IGW)', 'NAT gateway'],
      [
        ['Attached to', 'The VPC', 'One **public** subnet'],
        ['Used by', 'Resources with **public** IPs', 'Resources with **private** IPs only'],
        ['Inbound connections', '**Yes** — anyone can reach a public instance', '**No** — outbound only'],
        ['Typical occupant', 'Load balancer, bastion', 'App servers in private subnets'],
        ['Cost', 'Free', 'Hourly **plus per GB processed**'],
      ],
    ),
    p(
      'The standard layout: private subnets route `0.0.0.0/0` to a NAT gateway that lives in a public subnet, whose own route to `0.0.0.0/0` is the internet gateway. Your app servers can call Stripe and pull Docker images; nothing on the internet can call them.',
    ),
    code(
      sh(`
private subnet route table        public subnet route table
  10.0.0.0/16  -> local             10.0.0.0/16  -> local
  0.0.0.0/0    -> nat-abc123        0.0.0.0/0    -> igw-xyz789
`),
    ),
    warn(
      'A NAT gateway is one of the most common surprise line items on an AWS bill: it charges **per gigabyte processed**, and a private subnet pulling container images or writing to S3 over the internet pays for every byte. The fix is a **VPC endpoint** for S3 and friends, which keeps that traffic inside AWS and off the NAT gateway entirely — see `connecting-networks`.',
    ),
    tip(
      '“My Lambda in a VPC cannot reach the internet” is nearly always this: it is in a private subnet with no route to a NAT gateway. And “my instance has a public IP but still cannot be reached” is nearly always the other half — no internet gateway route, or a security group with no inbound rule.',
    ),

    h('Seeing your own NAT'),
    code(
      sh(`
ip addr            # 192.168.1.42     <- what your machine thinks it is
curl ifconfig.me   # 203.0.113.5      <- what the internet sees
`),
    ),
    p(
      'Those two lines being different is NAT, and running them once makes the whole idea concrete. Everyone in your building will print the same second number.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Share one public IP across a network', 'NAT/PAT'],
      ['Let outside traffic reach one inside machine', 'Port forwarding'],
      ['Give a VPC subnet outbound-only internet', 'NAT gateway in a public subnet'],
      ['Let the internet reach an instance', 'Public IP + internet gateway route + security group rule'],
      ['Cut the NAT gateway bill', 'VPC endpoints for S3, ECR and the rest'],
      ['See your public address', '`curl ifconfig.me`'],
    ]),

    h('Interview'),
    asked([
      ['What is NAT?', 'A router rewriting private source addresses to one public address and reversing it for replies, tracked by port in a translation table.'],
      ['Why can nobody connect to my laptop at home?', 'No NAT table entry exists until you initiate a connection outward, so there is no way back in.'],
      ['Is NAT a firewall?', 'No — it blocks unsolicited inbound as a side effect of having no route back, but it enforces no policy.'],
      ['Internet gateway vs NAT gateway?', 'IGW is two-way for public IPs; NAT gateway is outbound-only for private subnets, and it costs per GB.'],
      ['What does NAT break?', 'End-to-end addressing — peer-to-peer and VoIP need STUN, TURN or hole punching to work around it.'],
      ['Does IPv6 need NAT?', 'No; there are enough addresses, and a stateful firewall provides the inbound protection instead.'],
    ]),

    links(
      wiki('Network_address_translation', 'Network address translation'),
      awsDoc('vpc/latest/userguide/vpc-nat-gateway.html', 'NAT gateways'),
    ),
  ],
};
