import { asked, cheat, code, h, links, note, p, sh, table, tip, ul, warn, wiki } from '../blocks.js';

/*
  The topic that has to assume nothing, and the one that sets the ceiling for
  the whole track: everything here is defined in terms a developer will use
  again three sections later, and nothing is defined because a textbook would.
*/
export const doc = {
  blocks: [
    p(
      'A **network** is two or more machines that can send each other messages. That is the whole definition. Everything else in this track is detail about three things it needs: **nodes** (the machines), **links** (the wire or radio between them) and **protocols** (the agreed rules for what a message looks like and what happens when one goes missing).',
    ),
    p(
      'The protocol part is the one people skip and the one that matters. Two machines connected by a perfect cable can still do nothing useful if one sends JSON and the other expects XML, or if neither has agreed what to do when a message arrives twice. **A network is an agreement far more than it is a cable.**',
    ),

    h('The three words you will use every day'),
    table(
      ['Word', 'Means', 'In your world'],
      [
        ['**Node** (host)', 'Anything with an address that can send or receive', 'Your laptop, an EC2 instance, a phone, a printer'],
        ['**Link**', 'The medium between two nodes', 'Ethernet cable, WiFi, fibre between cities'],
        ['**Protocol**', 'The rules for the conversation', 'HTTP, TCP, DNS, TLS'],
      ],
    ),

    h('Networks by size'),
    p(
      'You will hear these as acronyms in interviews and in AWS docs. They are just scale labels, and only two of them earn much of your attention.',
    ),
    table(
      ['Name', 'Scale', 'Example'],
      [
        ['**LAN** — local area network', 'One building or one floor', 'Your home WiFi; a VPC subnet'],
        ['**WAN** — wide area network', 'Cities, countries', 'The link between two data centres; the internet itself'],
        ['MAN — metropolitan', 'One city', 'A campus or municipal network'],
        ['PAN — personal', 'A few metres', 'Bluetooth to your headphones'],
        ['**VPN** — virtual private network', 'A private network built *over* a public one', 'Your laptop joining the office LAN from a café'],
      ],
    ),
    note(
      'A **VPC** on AWS is the cloud version of a LAN: a private network you define, with its own address range, that happens to live in Amazon’s data centre. Section 7 of this track is that idea in full.',
    ),

    h('The internet, the Internet, and the web'),
    ul(
      'An **internet** (lowercase) is any set of networks joined together.',
      'The **Internet** (capital) is *the* one — a global mesh of independently owned networks that agree to route each other’s packets.',
      'The **web** is one application running on it: documents and APIs served over HTTP. Email, SSH, video calls and game traffic all use the internet and none of them is the web.',
    ),
    p(
      'Nobody owns the internet. It is tens of thousands of independently run networks — ISPs, universities, clouds, content providers — each called an **autonomous system**, agreeing to pass traffic to one another. That decentralisation is why it survives failures, and also why an outage at one provider can be someone else’s problem entirely and still break your site.',
    ),

    h('Two shapes for an application'),
    table(
      ['Shape', 'How it works', 'Used by'],
      [
        ['**Client–server**', 'Many clients talk to one (logical) server that holds the data and the rules', 'Almost everything you will build: web apps, APIs, databases'],
        ['**Peer-to-peer**', 'Every node is both client and server; no central authority', 'BitTorrent, blockchain networks, WebRTC media between two browsers'],
      ],
    ),
    p(
      'Client–server wins for applications because the server is a single place to put the truth: authorisation, consistency and “who is allowed to change this row” all become tractable. Peer-to-peer wins when the resource being shared *is* the participants’ own bandwidth or storage, and when no single party is trusted to hold it.',
    ),
    tip(
      'A hybrid is common and worth naming in a design interview: a video call uses a **server for signalling** — who is in the room, what their addresses are — and then **peer-to-peer for the media**, because relaying every frame of video through a data centre is the expensive part.',
    ),

    h('See your own network'),
    code(
      sh(`
ip addr            # your addresses (macOS: ifconfig)
ip route           # where packets go by default
ping 1.1.1.1       # can I reach the internet at all?
traceroute 1.1.1.1 # every network between me and it
`),
    ),
    p(
      '`traceroute` is the one to actually run once. Each line is a different organisation’s router — your home box, your ISP, an exchange point, then the destination’s network. That printout *is* the internet: a chain of strangers agreeing to forward your packet.',
    ),
    warn(
      'Nothing about this is guaranteed reliable. Packets are dropped, duplicated, delayed and reordered as a matter of routine. Every guarantee you enjoy — “my JSON arrived intact and in order” — is software rebuilding it on top, and that software is TCP. It is worth carrying that assumption from the first page: **the network is unreliable by default, and reliability is a feature somebody paid for.**',
    ),

    h('Cheatsheet'),
    cheat([
      ['Describe a network in one sentence', 'Nodes, links, protocols'],
      ['Name the network in a building', 'LAN — and a VPC subnet is the cloud version'],
      ['Name the private network over a public one', 'VPN'],
      ['Distinguish the internet from the web', 'The web is one application on top of it — HTTP'],
      ['Decide client–server vs peer-to-peer', 'Is there truth someone must own? Then client–server'],
      ['See the path to a host', '`traceroute` / `tracert`'],
    ]),

    h('Interview'),
    asked([
      ['What is a computer network?', 'Nodes that can exchange messages over links, following shared protocols.'],
      ['Internet vs web?', 'The internet is the network of networks; the web is one application on it, served over HTTP.'],
      ['LAN vs WAN?', 'A LAN is one site and privately owned; a WAN spans sites and usually crosses providers.'],
      ['What is a VPN?', 'An encrypted tunnel that makes a machine behave as if it were on a remote private network.'],
      ['Client–server vs peer-to-peer?', 'Central authority holding the data versus every node serving every other; pick by whether someone must own the truth.'],
      ['Who owns the internet?', 'Nobody — it is tens of thousands of autonomous systems agreeing to route each other’s traffic.'],
    ]),

    links(
      wiki('Computer_network', 'Computer network'),
      wiki('Internet', 'Internet'),
      wiki('Peer-to-peer', 'Peer-to-peer'),
    ),
  ],
};
