import { asked, cheat, code, h, links, note, p, rfc, sh, table, tip, ul, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A machine that has just joined a network knows nothing: no address of its own, no gateway, no resolver. **DHCP** is the protocol that hands it all three in about a tenth of a second, and it is the answer to "what happens when I connect to WiFi" at the layer below the one people usually answer at.',
    ),

    h('The four messages — DORA'),
    code(
      sh(`
client                                          DHCP server
  |--- DISCOVER ------ broadcast ---------------->|   "anyone there? I have no address"
  |<-- OFFER --------- "you can have 10.0.1.42" --|
  |--- REQUEST ------- broadcast ---------------->|   "I'll take it" (told to everyone,
  |                                               |    so other servers withdraw theirs)
  |<-- ACK ----------- "it's yours for 24h" ------|
`),
    ),
    p(
      'The mnemonic is **DORA**: Discover, Offer, Request, Acknowledge. The first and third are broadcasts, and they have to be: the client has no address yet, so it cannot be spoken to directly and cannot address anyone directly either. It sends from `0.0.0.0` to `255.255.255.255`, on UDP ports 67 and 68.',
    ),
    note(
      'The REQUEST is broadcast rather than sent to the chosen server on purpose. If two DHCP servers both offered, the broadcast tells the loser its offer was declined so it can put that address back in the pool.',
    ),

    h('What you actually receive'),
    p('An address is only the first of them, and the rest are why the whole exchange is worth understanding:'),
    table(
      ['Given', 'Without it'],
      [
        ['**IP address** + subnet mask', 'You have no identity on the network'],
        ['**Default gateway**', 'You can reach your own subnet and nothing else'],
        ['**DNS servers**', 'Everything by name fails; raw IPs still work'],
        ['**Lease time**', 'You would never know when to renew'],
        ['NTP servers, domain, MTU, routes (optional)', 'Usually defaults are fine'],
      ],
    ),
    tip(
      'This maps directly onto the classic broken-network triage. Ping your gateway: if that works, layer 1–3 is fine. Ping `1.1.1.1`: if that works, routing is fine. Ping `google.com`: if *that* fails, you have a DNS problem, and the DNS server almost certainly came from DHCP.',
    ),

    h('The lease'),
    p(
      'An address is **borrowed**, not owned. A lease is typically 24 hours at home and can be minutes on a busy public network. The client tries to renew at 50% of the lease (`T1`) directly with the server that granted it — a two-message REQUEST/ACK, no broadcast — and if that fails, tries again at 87.5% (`T2`) by broadcasting. Only if both fail does it start over with DISCOVER.',
    ),
    ul(
      'Leases are why an address can change after you have been away — someone else took it.',
      'They are why servers get **reservations**: the DHCP server is told "this MAC always gets this address", so the machine still uses DHCP but the answer never changes.',
      'They are why a short lease is used on conference WiFi: addresses come back into the pool quickly.',
    ),

    h('When DHCP fails'),
    p(
      'A host that gets no answer self-assigns a **link-local** address from `169.254.0.0/16` (called APIPA on Windows). Two machines on the same wire that both do this can actually talk to each other, and to nothing else.',
    ),
    warn(
      'Seeing `169.254.x.x` in `ip addr` is not a mysterious network problem — it is one specific fact: **no DHCP server answered.** Check the cable or WiFi association first, then whether the DHCP server or relay is alive.',
    ),

    h('Across subnets, and in the cloud'),
    p(
      'DHCP is broadcast-based, and routers do not forward broadcasts — so strictly you would need a DHCP server on every subnet. Real networks use a **DHCP relay** on the router, which forwards the request as unicast to a central server. That is the only piece of this you might have to say in an interview beyond DORA.',
    ),
    p(
      'On AWS you never run any of it. Every VPC has DHCP built in: launch an instance and it gets an address from the subnet range, the VPC router as its gateway, and the **Amazon-provided DNS resolver** at the `.2` address of the VPC range (`10.0.0.2` for `10.0.0.0/16`). What you can configure is a **DHCP options set** — for example to point instances at your own DNS servers instead.',
    ),
    code(
      sh(`
10.0.0.0/16 VPC
  10.0.0.0   network address        (reserved)
  10.0.0.1   VPC router / gateway   (reserved)
  10.0.0.2   Amazon DNS resolver    (reserved)
  10.0.0.3   reserved for future
  ...
  10.0.255.255 broadcast            (reserved)
`),
    ),
    p('Those are five of the addresses `subnetting-and-cidr` told you AWS takes out of every subnet. This is where they went.'),

    h('Cheatsheet'),
    cheat([
      ['Recite the exchange', 'DORA — Discover, Offer, Request, Acknowledge'],
      ['Name the ports', 'UDP 67 (server) and 68 (client)'],
      ['List what DHCP gives you', 'Address, mask, gateway, DNS, lease'],
      ['Diagnose `169.254.x.x`', 'No DHCP server answered'],
      ['Pin an address without static config', 'A DHCP reservation by MAC'],
      ['Serve DHCP across subnets', 'A DHCP relay on the router'],
      ['Change DNS for a whole VPC', 'A DHCP options set'],
    ]),

    h('Interview'),
    asked([
      ['What is DHCP for?', 'Handing a joining host its IP address, subnet mask, default gateway, DNS servers and a lease.'],
      ['Walk me through DORA.', 'Discover broadcast, Offer from a server, Request broadcast accepting one, Acknowledge confirming the lease.'],
      ['Why are two of those broadcasts?', 'The client has no address yet, and the broadcast REQUEST tells other servers their offers were declined.'],
      ['What is a DHCP lease?', 'A time-limited grant of an address; the client renews at half-time and falls back to the full exchange if that fails.'],
      ['What does a 169.254 address mean?', 'DHCP failed and the host self-assigned a link-local address.'],
      ['How does DHCP work across subnets?', 'A DHCP relay on the router forwards the broadcast to a central server as unicast.'],
    ]),

    links(
      wiki('Dynamic_Host_Configuration_Protocol', 'DHCP'),
      rfc(2131, 'RFC 2131 — DHCP'),
    ),
  ],
};
