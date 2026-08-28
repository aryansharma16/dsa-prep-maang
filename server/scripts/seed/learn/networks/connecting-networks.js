import { asked, awsDoc, cheat, code, h, links, note, p, sh, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Sooner or later one private network has to reach another: two VPCs, an office, a partner, or an AWS service you would rather not reach over the public internet. There are five mechanisms and each answers a different question, which is exactly how an interviewer will ask about them.',
    ),

    h('The five, and when each is right'),
    table(
      ['Mechanism', 'Connects', 'Use when'],
      [
        ['**VPC peering**', 'Two VPCs, one-to-one', 'A handful of VPCs; simple, cheap, no bandwidth limit'],
        ['**Transit Gateway**', 'Many VPCs and on-prem, hub and spoke', 'More than a few VPCs — peering becomes n² connections'],
        ['**Site-to-Site VPN**', 'Your office/data centre to a VPC, over the internet', 'You need on-prem connectivity today, encrypted, cheaply'],
        ['**Direct Connect**', 'Your data centre to AWS on a private circuit', 'Consistent latency and large sustained volume; weeks to provision'],
        ['**VPC endpoint / PrivateLink**', 'Your VPC to an AWS or partner **service**', 'You want S3, SQS or a SaaS without going over the internet'],
      ],
    ),

    h('Peering, and its two catches'),
    p(
      'A peering connection joins two VPCs so instances address each other by private IP. It is simple and it has two limitations that get asked about:',
    ),
    ul(
      '**No transitive routing.** If A peers with B and B peers with C, **A cannot reach C**. Every pair needs its own connection — which is n(n−1)/2 connections, and why Transit Gateway exists.',
      '**No overlapping CIDRs.** Two `10.0.0.0/16` VPCs can never be peered; the addresses would be ambiguous. This is the reason `subnetting-and-cidr` insisted on planning ranges up front.',
      'And it is not automatic: after accepting the peering you must add **routes on both sides** and open the **security groups** — which, helpfully, can reference a security group in the peered VPC.',
    ),

    h('VPC endpoints — the one that saves real money'),
    p(
      'By default, an instance in a private subnet calling `s3.amazonaws.com` goes out through the **NAT gateway**, over the public internet, and back into AWS. You pay per gigabyte for the privilege and the traffic leaves your network. A **VPC endpoint** creates a private path instead.',
    ),
    table(
      ['Type', 'How', 'For'],
      [
        ['**Gateway endpoint**', 'A route table entry — **free**', '**S3 and DynamoDB only**'],
        ['**Interface endpoint** (PrivateLink)', 'An ENI with a private IP in your subnet — hourly + per GB', 'Almost every other AWS service, and partner SaaS'],
      ],
    ),
    tip(
      'The gateway endpoint for S3 is free, takes two minutes, and removes S3 traffic from your NAT gateway bill entirely. If a private subnet reads or writes S3 at any volume, it is the highest ratio of saving to effort in this whole track.',
    ),
    p(
      '**PrivateLink** is the same idea turned into a product: a service — Amazon’s, or another company’s — appears as a private IP **inside your VPC**. No internet gateway, no NAT, no public exposure on either side, and it works even if both networks use overlapping ranges, because only that one endpoint is exposed.',
    ),

    h('Reaching a private instance without a bastion'),
    p(
      'The traditional answer is a **bastion host**: a small public instance you SSH into, and from there into the private ones. It works, and it means keeping a public instance with port 22 open and SSH keys distributed.',
    ),
    p('The modern answer is **SSM Session Manager**, and it is worth knowing because it is strictly better:'),
    code(
      sh(`
aws ssm start-session --target i-0abc123                    # a shell, no SSH, no open port

aws ssm start-session --target i-0abc123 \\
  --document-name AWS-StartPortForwardingSessionToRemoteHost \\
  --parameters '{"host":["db.internal"],"portNumber":["5432"],"localPortNumber":["5432"]}'
`),
    ),
    ul(
      '**No inbound port at all** — the instance’s agent connects outward to SSM.',
      '**No SSH keys** — access is IAM, so it is revoked by removing a permission.',
      '**Audited** — every session is logged to CloudTrail, and can be recorded to S3.',
      'The second command is an SSH tunnel’s replacement: a local port forwarded to a database in a private subnet.',
    ),
    warn(
      'A bastion is not wrong, but it is a public host with a listening port, credentials to manage and no audit trail by default. If a design question asks how you reach private infrastructure, saying "SSM Session Manager, or a bastion if the tooling requires SSH" is the stronger answer.',
    ),

    h('Hybrid: VPN or Direct Connect'),
    table(
      ['', 'Site-to-Site VPN', 'Direct Connect'],
      [
        ['Path', 'Encrypted tunnel over the public internet', 'A dedicated private circuit'],
        ['Setup', 'Hours', '**Weeks** — a physical cross-connect'],
        ['Bandwidth', 'Up to ~1.25 Gbps per tunnel', '1–100 Gbps'],
        ['Latency', 'Variable — it is the internet', '**Consistent**'],
        ['Cost', 'Low', 'High'],
        ['Typical', 'The starting point, and the backup', 'Sustained volume, or a compliance requirement'],
      ],
    ),
    note(
      'The common production pattern is **both**: Direct Connect for the primary path, a VPN as automatic failover. That pairing is a good thing to mention — it shows you are thinking about the circuit being cut, which is the failure mode Direct Connect actually has.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Join two VPCs', 'Peering — non-overlapping CIDRs, routes on both sides'],
      ['Join many VPCs', 'Transit Gateway — peering does not scale or transit'],
      ['Reach S3 from a private subnet cheaply', 'A **gateway endpoint** — free'],
      ['Reach another AWS or SaaS service privately', 'An interface endpoint / PrivateLink'],
      ['Reach a private instance', 'SSM Session Manager, not a bastion'],
      ['Tunnel to a private database', 'SSM port forwarding, or `ssh -L` via a bastion'],
      ['Connect an office', 'Site-to-Site VPN now, Direct Connect if volume justifies it'],
    ]),

    h('Interview'),
    asked([
      ['VPC peering vs Transit Gateway?', 'Peering is one-to-one and non-transitive, so n VPCs need n² links; Transit Gateway is a hub that routes between all of them.'],
      ['Why can two VPCs fail to peer?', 'Overlapping CIDR ranges — the addresses would be ambiguous.'],
      ['What is a VPC endpoint for?', 'Reaching AWS services privately without a NAT gateway or the public internet; the S3 gateway endpoint is free.'],
      ['What is PrivateLink?', 'Exposing a service as a private IP inside a consumer’s VPC, with no internet path and no CIDR coordination.'],
      ['How do you reach an instance in a private subnet?', 'SSM Session Manager — outbound agent, IAM-controlled, audited — or a bastion host if SSH is required.'],
      ['VPN vs Direct Connect?', 'An encrypted tunnel over the internet, cheap and quick, versus a dedicated circuit with consistent latency, expensive and slow to provision.'],
    ]),

    links(
      awsDoc('vpc/latest/peering/what-is-vpc-peering.html', 'VPC peering'),
      awsDoc('vpc/latest/privatelink/what-is-privatelink.html', 'AWS PrivateLink'),
      awsDoc('systems-manager/latest/userguide/session-manager.html', 'SSM Session Manager'),
    ),
  ],
};
