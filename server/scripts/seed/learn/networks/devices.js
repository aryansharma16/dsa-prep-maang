import { asked, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Five or six boxes make up every network you will meet, and the only thing you need to keep straight is **which layer each one reads**. A device that reads MAC addresses can only move traffic inside one network; a device that reads IP addresses can move it between networks. Everything else follows from that one line.',
    ),

    h('The boxes'),
    table(
      ['Device', 'Layer', 'Reads', 'Does'],
      [
        ['**NIC** (network card)', '1–2', '—', 'Puts frames on the wire; owns the MAC address'],
        ['Hub', '1', 'Nothing', 'Repeats every bit to every port. Obsolete — kept for the exam question'],
        ['**Switch**', '2', 'MAC', 'Learns which MAC is on which port and forwards only there'],
        ['**Router**', '3', 'IP', 'Joins different networks; forwards by IP using a routing table'],
        ['**Gateway**', '3', 'IP', 'The router your machine sends everything non-local to'],
        ['Access point', '2', 'MAC', 'A switch whose wire is radio — WiFi'],
        ['Modem', '1', '—', 'Converts your ISP’s signal (cable, DSL, fibre) into Ethernet'],
        ['**Firewall**', '3–7', 'Whatever it is asked to', 'Allows or denies traffic by rule'],
      ],
    ),
    note(
      'Your home “router” is four of these in one plastic box: a modem, a router, a switch and a wireless access point — plus a firewall and a DHCP server. That is why one device does so much in this list.',
    ),

    h('Switch vs router — the answer they want'),
    table(
      ['', 'Switch', 'Router'],
      [
        ['Layer', '2', '3'],
        ['Address it forwards on', 'MAC', 'IP'],
        ['Scope', 'One network / LAN', 'Between networks'],
        ['Table it keeps', 'MAC address table (learned)', 'Routing table (configured or learned)'],
        ['Unknown destination', 'Floods to every port', 'Sends to the default route, or drops'],
        ['Broadcast traffic', 'Forwards it', '**Blocks it**'],
        ['On AWS', 'Implicit inside a subnet', 'The subnet’s route table'],
      ],
    ),
    p(
      'The last row is the one that repays memorising. **A router is a broadcast boundary.** That single property is what stops a thousand-machine office being drowned by ARP, and it is why "one big flat network" stops working at scale.',
    ),

    h('Collision and broadcast domains'),
    ul(
      'A **collision domain** is a set of devices whose signals can collide. A hub made one big one; a switch gives every port its own, which is why switches replaced hubs entirely.',
      'A **broadcast domain** is the set of devices a broadcast reaches. A switch forwards broadcasts, so it does not split one; **a router does**.',
      'Rule of thumb: *switch = many collision domains, one broadcast domain. Router = one broadcast domain per interface.*',
    ),

    h('How a switch learns'),
    p(
      'A switch starts knowing nothing. When a frame arrives on port 3 from MAC `aa:bb:...`, it records "that MAC lives on port 3". When a frame is addressed to a MAC it has not seen, it **floods** — sends it to every port but the one it came in on — and learns from the reply. After a few seconds of traffic the table is complete and almost nothing is flooded.',
    ),
    code(
      sh(`
MAC address table
  aa:bb:cc:00:01  ->  port 3
  aa:bb:cc:00:02  ->  port 7
  aa:bb:cc:00:09  ->  port 1   (the router)
`),
    ),

    h('Where these live in the cloud'),
    p(
      'AWS does not sell you a switch. It sells you the *behaviour* of one, and knowing the mapping is what makes the cloud section of this track feel familiar rather than new:',
    ),
    table(
      ['Physical thing', 'AWS equivalent'],
      [
        ['Switch / LAN segment', 'A **subnet**'],
        ['Router + routing table', 'The subnet’s **route table**'],
        ['Default gateway to the internet', '**Internet gateway** (or a NAT gateway for outbound-only)'],
        ['Firewall on the machine', '**Security group** — stateful, per instance'],
        ['Firewall at the network edge', '**Network ACL** — stateless, per subnet'],
        ['Load balancer appliance', '**ALB / NLB**'],
      ],
    ),
    tip(
      'When a cloud question confuses you, ask what the physical version would be. "Why can my instance not reach the internet" is "is there a route to a gateway, and does the firewall allow it" — the same two questions you would ask about a laptop.',
    ),
    warn(
      'Hubs are gone, and saying "a switch is like a hub but smarter" invites the follow-up "what makes it smarter". The answer is the MAC table: a hub repeats blindly, a switch forwards to one port.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Move traffic inside one network', 'Switch — layer 2, MAC'],
      ['Move traffic between networks', 'Router — layer 3, IP'],
      ['Stop broadcast traffic spreading', 'A router — it does not forward broadcasts'],
      ['Name what a switch learns', 'MAC address → port, from traffic it sees'],
      ['Name the AWS version of a router', 'The subnet’s route table'],
      ['Name the AWS version of a host firewall', 'A security group'],
    ]),

    h('Interview'),
    asked([
      ['Switch vs router?', 'A switch forwards frames by MAC within one network; a router forwards packets by IP between networks.'],
      ['Why did switches replace hubs?', 'A hub repeats every bit to every port — one collision domain; a switch forwards only to the right port.'],
      ['What is a default gateway?', 'The router a host sends anything outside its own subnet to.'],
      ['What is a broadcast domain, and what limits it?', 'Everything a broadcast reaches; a router is the boundary, a switch is not.'],
      ['How does a switch know where to send a frame?', 'It learns source MAC per port from traffic, and floods when the destination is unknown.'],
      ['What is the cloud equivalent of a switch and a router?', 'A subnet, and that subnet’s route table.'],
    ]),

    links(
      wiki('Network_switch', 'Network switch'),
      wiki('Router_(computing)', 'Router'),
      wiki('Broadcast_domain', 'Broadcast domain'),
    ),
  ],
};
