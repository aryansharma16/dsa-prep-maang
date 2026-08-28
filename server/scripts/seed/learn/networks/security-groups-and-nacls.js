import { asked, awsDoc, cheat, code, h, links, note, p, sh, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'AWS gives you two firewalls and asks you to understand both. **Security groups** wrap an instance; **network ACLs** wrap a subnet. They are asked about together in every AWS interview because the comparison is a neat test of whether you know what "stateful" means.',
    ),

    h('The comparison'),
    table(
      ['', 'Security group', 'Network ACL'],
      [
        ['Wraps', 'An instance / ENI', 'A whole subnet'],
        ['**State**', '**Stateful** — return traffic is automatic', '**Stateless** — you must allow both directions'],
        ['Rules', '**Allow only**', 'Allow **and deny**'],
        ['Evaluation', 'All rules; any match allows', '**In number order**, first match wins'],
        ['Default (created)', 'Deny all inbound, allow all outbound', 'Allow all both ways'],
        ['Can reference', 'Another **security group**', 'CIDR ranges only'],
        ['How many apply', 'Several per instance, all combined', 'Exactly one per subnet'],
      ],
    ),

    h('Stateful, in one example'),
    p(
      'This is the row that matters and it is easy to make concrete. A web server with an inbound rule allowing 443:',
    ),
    code(
      sh(`
SECURITY GROUP (stateful)
  in:  allow tcp 443 from 0.0.0.0/0
  out: (nothing needed)
  -> a request arrives on 443, the response goes back automatically.

NETWORK ACL (stateless)
  in:   100 allow tcp 443 from 0.0.0.0/0
  out:  100 allow tcp 1024-65535 to 0.0.0.0/0     <- WITHOUT THIS, NOTHING WORKS
  -> the reply leaves from port 443 to the client's EPHEMERAL port, and the
     ACL has no idea it is a reply. You must allow that range explicitly.
`),
    ),
    warn(
      '**“Requests go out but nothing comes back”** is the signature of a stateless rule missing its ephemeral-port return path. It is the single most common NACL bug, and naming the ephemeral range 1024–65535 in an interview shows you have actually met it.',
    ),

    h('The feature that makes security groups pleasant'),
    p(
      'A security group rule can name **another security group** as its source. That is a level above CIDR ranges: you are writing a rule about a *role*, not about an address that will change.',
    ),
    code(
      sh(`
sg-alb    in: 443 from 0.0.0.0/0
sg-app    in: 3000 from sg-alb        <- "whatever is in the load balancer group"
sg-db     in: 5432 from sg-app        <- "whatever is in the app group"
`),
    ),
    p(
      'Autoscale the app from two instances to fifty and nothing needs editing. This chained pattern — public only at the load balancer, each tier accepting only from the tier in front — is the answer to “how would you secure a three-tier application on AWS”, and it is worth being able to draw in three lines like that.',
    ),
    tip(
      'A security group can even reference **itself**, which is how you let members of a cluster talk to each other — nodes in the same group, on the cluster port, and nothing else.',
    ),

    h('When you actually need a NACL'),
    p(
      'Most architectures use security groups and leave the default allow-all NACL alone. Reach for a NACL when you need something a security group structurally cannot do:',
    ),
    ul(
      '**Deny.** Security groups cannot express "block this IP range" — there are no deny rules. Blocking an abusive source at the subnet edge needs a NACL.',
      '**A guarantee across a whole subnet**, independent of anyone’s per-instance configuration. A compliance control saying "nothing in the database subnet may reach the internet" belongs here.',
      '**Defence in depth**, on the assumption that a security group will one day be misconfigured.',
    ),

    h('Reading a connectivity failure'),
    p('When traffic does not flow, walk the list in this order — it is ordered by how often each one is the answer:'),
    table(
      ['#', 'Check', 'Symptom if wrong'],
      [
        ['1', 'Security group **inbound** on the destination', 'Timeout'],
        ['2', 'Security group **outbound** on the source (if changed from the default)', 'Timeout'],
        ['3', 'The **route table** has a path at all', 'Timeout'],
        ['4', 'NACL **both directions**, including ephemeral ports', 'Timeout, often one-way'],
        ['5', 'Is the process actually listening, on the right interface?', '**Connection refused**'],
        ['6', 'Host firewall on the instance (`iptables`, `ufw`)', 'Timeout'],
      ],
    ),
    note(
      'The distinction from `ports-and-sockets` pays off here. **Refused means your packet arrived and nothing was listening** — so the network path is fine and the problem is the application or its bind address. **Timeout means it never arrived**, so look at security groups, routes and NACLs. Getting this the right way round saves an hour every time.',
    ),
    p(
      'AWS also has a purpose-built tool: **VPC Reachability Analyzer** traces a path between two resources and tells you which rule blocked it. It is the fastest way to settle these arguments and remarkably few people know it exists.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Firewall one instance', 'Security group — stateful, allow-only'],
      ['Firewall a whole subnet', 'Network ACL — stateless, allow and deny'],
      ['Block a specific IP range', 'A NACL deny rule — security groups cannot'],
      ['Let a tier talk to the tier behind it', 'Reference the source security group, not a CIDR'],
      ['Fix “goes out, nothing comes back”', 'Allow ephemeral ports 1024–65535 on the NACL'],
      ['Diagnose a timeout', 'Security group, then route table, then NACL'],
      ['Diagnose a refusal', 'The app is not listening, or bound to `127.0.0.1`'],
    ]),

    h('Interview'),
    asked([
      ['Security group vs network ACL?', 'Instance-level, stateful, allow-only versus subnet-level, stateless, allow-and-deny evaluated in order.'],
      ['What does stateful mean here?', 'Return traffic for an allowed connection is permitted automatically — no matching outbound rule needed.'],
      ['Why did my NACL break replies?', 'Stateless rules need an explicit outbound allow for the client’s ephemeral port range.'],
      ['Can a security group deny traffic?', 'No — it is allow-only; use a NACL for denies.'],
      ['How do you secure a three-tier app?', 'Public only on the load balancer group, app accepts from the LB group, database accepts from the app group.'],
      ['Timeout vs connection refused in a VPC?', 'Timeout means the packet was dropped — security group, route or NACL; refused means it arrived and nothing was listening.'],
    ]),

    links(
      awsDoc('vpc/latest/userguide/vpc-security-groups.html', 'Security groups'),
      awsDoc('vpc/latest/userguide/vpc-network-acls.html', 'Network ACLs'),
    ),
  ],
};
