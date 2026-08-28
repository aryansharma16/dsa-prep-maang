import { asked, awsDoc, cheat, code, h, links, note, p, sh, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A **VPC** — virtual private cloud — is your own private network inside AWS: an address range you choose, divided into subnets you control, with routing rules you write. Nothing in this section is a new idea. It is the previous six sections with Amazon’s names on them, and that mapping is the fastest way to learn it.',
    ),

    h('The mapping'),
    table(
      ['Networking concept', 'AWS'],
      [
        ['A private network / LAN', '**VPC**'],
        ['A network segment', '**Subnet** — and it lives in exactly one availability zone'],
        ['A router and its table', '**Route table**, attached per subnet'],
        ['The default gateway to the internet', '**Internet gateway (IGW)**'],
        ['NAT for outbound-only', '**NAT gateway**'],
        ['A host firewall', '**Security group** — stateful'],
        ['A subnet firewall', '**Network ACL** — stateless'],
        ['A DHCP server', 'Built in; configurable via a **DHCP options set**'],
        ['A DNS resolver', 'The `.2` address of the VPC range'],
      ],
    ),

    h('Building one, in the order you would actually build it'),
    p('**1. Choose a CIDR.** A `/16` gives 65,536 addresses and costs nothing. Do not overlap it with anything you may ever connect to.'),
    code(
      sh(`
VPC  10.0.0.0/16
  public-a   10.0.0.0/20    eu-west-1a
  public-b   10.0.16.0/20   eu-west-1b
  private-a  10.0.48.0/20   eu-west-1a
  private-b  10.0.64.0/20   eu-west-1b
`),
    ),
    p(
      '**2. Subnets, at least two availability zones.** An AZ is a physically separate data centre; a subnet cannot span two. Spreading across AZs is how you survive one of them failing, and load balancers and RDS both *require* subnets in at least two.',
    ),
    p(
      '**3. An internet gateway**, attached to the VPC. It is free, it is highly available, and it does nothing until a route table points at it.',
    ),
    p('**4. Route tables** — and this is the step that defines everything:'),
    code(
      sh(`
public route table                 private route table
  10.0.0.0/16 -> local               10.0.0.0/16 -> local
  0.0.0.0/0   -> igw-abc123          0.0.0.0/0   -> nat-xyz789
`),
    ),
    note(
      '**A subnet is “public” for exactly one reason: its route table sends `0.0.0.0/0` to an internet gateway.** Not a naming convention, not a tag, not a setting. There is no “public” checkbox — and knowing that one sentence answers a surprising share of AWS networking interview questions.',
    ),
    p(
      '**5. A NAT gateway** in a public subnet, so private instances can reach the internet outbound — to call an API, pull an image, fetch a package — without being reachable themselves.',
    ),

    h('What goes where'),
    table(
      ['Resource', 'Subnet', 'Why'],
      [
        ['Load balancer (ALB/NLB)', '**Public**', 'Users must reach it'],
        ['NAT gateway', '**Public**', 'It needs the internet gateway'],
        ['Bastion / jump host', 'Public — or better, none at all', 'Prefer SSM Session Manager'],
        ['Application servers, containers', '**Private**', 'Only the load balancer needs to reach them'],
        ['RDS, ElastiCache', '**Private**', 'Only the app needs to reach them'],
        ['Lambda with VPC access', 'Private', 'And it needs NAT or endpoints for outbound'],
      ],
    ),
    tip(
      'The whole point is that **only the load balancer is exposed**. An attacker who finds a vulnerability in your app cannot connect to your database from the internet, because there is no route to it — not "there is a rule against it", but no route at all. That is a much stronger property than a firewall rule, and it is worth saying that way.',
    ),

    h('The addresses AWS takes'),
    p('Five per subnet, which is why a `/28` gives eleven usable addresses rather than sixteen. In `10.0.0.0/24`:'),
    table(
      ['Address', 'Reserved for'],
      [
        ['`10.0.0.0`', 'The network address'],
        ['`10.0.0.1`', 'The VPC router'],
        ['`10.0.0.2`', 'The Amazon DNS resolver'],
        ['`10.0.0.3`', 'Future use'],
        ['`10.0.0.255`', 'Broadcast (reserved, though AWS does not support broadcast)'],
      ],
    ),

    h('Public IPs, and DNS inside the VPC'),
    ul(
      'Every instance gets a **private** IP from its subnet, for its whole life.',
      'A **public** IP can be auto-assigned, but it changes on stop/start. An **Elastic IP** is one you own and can move — use it when something must be allowlisted by address.',
      'A public IP is **not configured on the instance**. The instance only ever sees its private address; AWS translates at the edge. This is why `ip addr` on an EC2 box never shows the public address, and why people think something is broken.',
      'Instances resolve each other by internal DNS names, and a **Route 53 private hosted zone** gives you your own internal names — `db.internal` — that resolve only inside the VPC.',
    ),

    h('The default VPC, and why to leave it'),
    warn(
      'Every account has a **default VPC** where every subnet is public and instances get public IPs automatically. It is designed for a five-minute demo. Building anything real in it means your database is one security-group mistake away from the internet, which is exactly the class of failure the private-subnet design removes structurally.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Size a VPC', '`/16`, non-overlapping with everything else you own'],
      ['Make a subnet public', 'A route `0.0.0.0/0 → internet gateway`'],
      ['Give private instances outbound access', 'A NAT gateway in a public subnet'],
      ['Survive an AZ failure', 'Subnets in at least two availability zones'],
      ['Protect a database', 'Private subnet, plus a security group scoped to the app'],
      ['Keep a stable public address', 'An Elastic IP'],
      ['Name things internally', 'A Route 53 private hosted zone'],
    ]),

    h('Interview'),
    asked([
      ['What is a VPC?', 'A logically isolated virtual network in AWS with its own CIDR, subnets, route tables and gateways.'],
      ['What makes a subnet public?', 'A route table entry sending 0.0.0.0/0 to an internet gateway — nothing else.'],
      ['Why put a database in a private subnet?', 'There is no route from the internet to it at all, which is stronger than a firewall rule.'],
      ['How does a private instance reach the internet?', 'Outbound through a NAT gateway in a public subnet; nothing can initiate inbound.'],
      ['Why must subnets span availability zones?', 'A subnet lives in one AZ, so multi-AZ subnets are how you survive a data-centre failure — and ALB and RDS require it.'],
      ['Why does my instance not show its public IP?', 'AWS translates it at the edge; the instance only ever sees its private address.'],
      ['How many usable IPs in a /28 on AWS?', 'Eleven — AWS reserves five per subnet.'],
    ]),

    links(
      awsDoc('vpc/latest/userguide/what-is-amazon-vpc.html', 'What is Amazon VPC'),
      awsDoc('vpc/latest/userguide/VPC_Route_Tables.html', 'Route tables'),
    ),
  ],
};
